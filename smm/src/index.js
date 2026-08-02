// ============================================================================
// Cookie Clicker — SMM worker (channel auto-posting).
//
// Standalone Cloudflare Worker, separate from the game push worker (../push).
// It ONLY schedules and publishes posts to a Telegram channel; it has no
// webhook and never touches game state. Kept separate so the game worker and
// the marketing worker deploy independently.
//
// Shared with the game:
//   - BOT_TOKEN  (secret) — posts as @bestcookieclickerbot; the bot must be an
//     ADMIN of the target channel with "post messages" rights.
//   - the same D1 database (binding DB → cookie-clicker-analytics): reads the
//     `config` table (channel_id / autopost_enabled) and owns `scheduled_posts`.
//   - ADMIN_KEY (secret) — gates every /admin/* endpoint, same value/idea as the
//     game worker's ADMIN_KEY.
//
// Nothing posts until channel_id is set AND autopost_enabled = '1' (safe
// default: off). See README.md for the full go-live checklist.
// ============================================================================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// Generic Telegram Bot API call. Returns the parsed JSON ({ ok, result, ... }).
async function tgCall(env, method, payload) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Read a raw string value from the shared key/value `config` table.
async function getConfigStr(env, key) {
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind(key).first();
    return row ? row.value : null;
  } catch (e) { return null; }
}

function isAdminReq(url, env) {
  return !!env.ADMIN_KEY && url.searchParams.get('key') === env.ADMIN_KEY;
}

// sendMessage payload for one queued post. NOTE: channels allow URL buttons
// only — NOT web_app buttons — so the CTA is a t.me deep link, not a Mini App
// button (the link still opens the bot / launches the Mini App on tap).
function buildPostPayload(channelId, p) {
  const payload = {
    chat_id: channelId,
    text: p.text,
    disable_web_page_preview: p.disable_preview ? true : false,
  };
  if (p.parse_mode) payload.parse_mode = p.parse_mode;
  if (p.button_text && p.button_url) {
    payload.reply_markup = { inline_keyboard: [[{ text: p.button_text, url: p.button_url }]] };
  }
  return payload;
}

// Cron step: publish every due, pending post (oldest first, capped per tick).
async function publishDuePosts(env) {
  if (!env.DB) return;
  const channelId = await getConfigStr(env, 'channel_id');
  const enabled = await getConfigStr(env, 'autopost_enabled');
  if (!channelId || enabled !== '1') return; // off until explicitly configured
  const now = Date.now();
  let due;
  try {
    due = await env.DB.prepare(
      "SELECT * FROM scheduled_posts WHERE status = 'pending' AND publish_at <= ? ORDER BY publish_at ASC LIMIT 10"
    ).bind(now).all();
  } catch (e) { return; } // table not migrated yet — degrade silently
  for (const p of (due.results || [])) {
    // Atomically claim the row so two overlapping cron ticks can't double-post.
    const claim = await env.DB.prepare(
      "UPDATE scheduled_posts SET status = 'sending' WHERE id = ? AND status = 'pending'"
    ).bind(p.id).run();
    if (!claim.meta || !claim.meta.changes) continue; // another tick took it
    const res = await tgCall(env, 'sendMessage', buildPostPayload(channelId, p));
    if (res && res.ok) {
      await env.DB.prepare(
        "UPDATE scheduled_posts SET status = 'sent', tg_message_id = ?, sent_at = ?, error = NULL WHERE id = ?"
      ).bind(res.result.message_id, Date.now(), p.id).run();
    } else {
      await env.DB.prepare(
        "UPDATE scheduled_posts SET status = 'failed', error = ? WHERE id = ?"
      ).bind(JSON.stringify(res).slice(0, 800), p.id).run();
    }
  }
}

// POST /admin/schedule-post?key=... — enqueue one or many posts. Body is either
// a single post object, { post: {...} }, or { posts: [ {...}, ... ] }. Each:
//   { publish_at?: ms epoch, publish_in_minutes?: n (from now), text: string,
//     parse_mode?: 'HTML'|'' (default 'HTML'), button_text?, button_url?,
//     disable_preview?: bool (default true) }
async function handleSchedulePost(request, env) {
  const url = new URL(request.url);
  if (!isAdminReq(url, env)) return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const list = Array.isArray(body.posts) ? body.posts : (body.post ? [body.post] : [body]);
  const now = Date.now();
  const ids = [];
  for (const p of list) {
    if (!p || typeof p.text !== 'string' || !p.text.trim()) {
      return jsonResponse({ ok: false, error: 'missing_text' }, 400);
    }
    const publishAt = Number.isFinite(p.publish_at)
      ? p.publish_at
      : now + (Number(p.publish_in_minutes) || 0) * 60000;
    const parseMode = p.parse_mode === undefined ? 'HTML' : (p.parse_mode || '');
    const disablePreview = p.disable_preview === false ? 0 : 1;
    const r = await env.DB.prepare(
      'INSERT INTO scheduled_posts (publish_at, text, parse_mode, button_text, button_url, disable_preview, status, created_at) VALUES (?, ?, ?, ?, ?, ?, \'pending\', ?)'
    ).bind(publishAt, p.text, parseMode, p.button_text || null, p.button_url || null, disablePreview, now).run();
    ids.push(r.meta ? r.meta.last_row_id : null);
  }
  return jsonResponse({ ok: true, scheduled: ids.length, ids });
}

// GET /admin/posts?key=...[&status=pending|sent|failed|canceled|all][&limit=n]
// The queue view: id, when, status, a text preview, and the channel config.
async function handleListPosts(request, env) {
  const url = new URL(request.url);
  if (!isAdminReq(url, env)) return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);
  const status = url.searchParams.get('status') || 'pending';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const cols = 'id, publish_at, status, tg_message_id, sent_at, error, substr(text, 1, 90) AS preview';
  let res;
  try {
    if (status === 'all') {
      res = await env.DB.prepare(`SELECT ${cols} FROM scheduled_posts ORDER BY publish_at ASC LIMIT ?`).bind(limit).all();
    } else {
      res = await env.DB.prepare(`SELECT ${cols} FROM scheduled_posts WHERE status = ? ORDER BY publish_at ASC LIMIT ?`).bind(status, limit).all();
    }
  } catch (e) { return jsonResponse({ ok: false, error: 'query_failed', detail: String(e) }, 500); }
  return jsonResponse({
    ok: true,
    channel_id: await getConfigStr(env, 'channel_id'),
    autopost_enabled: await getConfigStr(env, 'autopost_enabled'),
    now: Date.now(),
    posts: res.results || [],
  });
}

// POST /admin/post-now?key=... — send one post immediately (also the smoke
// test for "is the bot really an admin of the channel?"). Same body shape as a
// single post above (minus scheduling fields).
async function handlePostNow(request, env) {
  const url = new URL(request.url);
  if (!isAdminReq(url, env)) return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  const channelId = await getConfigStr(env, 'channel_id');
  if (!channelId) return jsonResponse({ ok: false, error: 'no_channel' }, 400);
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  if (typeof body.text !== 'string' || !body.text.trim()) return jsonResponse({ ok: false, error: 'missing_text' }, 400);
  const p = {
    text: body.text,
    parse_mode: body.parse_mode === undefined ? 'HTML' : (body.parse_mode || ''),
    button_text: body.button_text,
    button_url: body.button_url,
    disable_preview: body.disable_preview === false ? 0 : 1,
  };
  const res = await tgCall(env, 'sendMessage', buildPostPayload(channelId, p));
  if (res && res.ok) return jsonResponse({ ok: true, message_id: res.result.message_id });
  return jsonResponse({ ok: false, error: 'send_failed', detail: res }, 502);
}

// POST /admin/cancel-post?key=... Body: { id } — cancel a still-pending post.
async function handleCancelPost(request, env) {
  const url = new URL(request.url);
  if (!isAdminReq(url, env)) return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return jsonResponse({ ok: false, error: 'bad_id' }, 400);
  const r = await env.DB.prepare("UPDATE scheduled_posts SET status = 'canceled' WHERE id = ? AND status = 'pending'").bind(id).run();
  return jsonResponse({ ok: true, canceled: r.meta ? r.meta.changes : 0 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Lightweight health/status check (no secrets leaked): confirms the worker
    // is up and whether autoposting is armed. Does not require the admin key.
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({ ok: true, worker: 'cookie-clicker-tma-smm' });
    }

    if (url.pathname === '/admin/schedule-post' && request.method === 'POST') {
      return handleSchedulePost(request, env);
    }
    if (url.pathname === '/admin/posts' && request.method === 'GET') {
      return handleListPosts(request, env);
    }
    if (url.pathname === '/admin/post-now' && request.method === 'POST') {
      return handlePostNow(request, env);
    }
    if (url.pathname === '/admin/cancel-post' && request.method === 'POST') {
      return handleCancelPost(request, env);
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(publishDuePosts(env));
  },
};
