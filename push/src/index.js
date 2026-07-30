// Cloudflare Worker: retention push notifications for the Cookie Clicker Telegram Mini App.
//
// - POST /checkin  — called by the mini app on every load. Validates Telegram
//   initData, then records "this user was just active" so the scheduled job
//   knows not to (yet) nag them.
// - scheduled()     — runs on a cron trigger. Does two things:
//     1. For every known user, checks how long it's been since they were
//        last active and sends at most one push per inactivity stage (never
//        repeats a stage, resets when they check in again).
//     2. Checks whether a scheduled event (Happy Hour / Weekend) just started
//        and, if so, broadcasts an announcement to every known user — once
//        per occurrence, tracked via an eventflag:* KV marker.

const GAME_URL = 'https://mscherbin.github.io/cookie-clicker-tma/';
// Must match game.js's OFFLINE_FULL_RATE_SECONDS / OFFLINE_RATE / computeOfflineGain.
const OFFLINE_FULL_RATE_SECONDS = 2 * 3600;
const OFFLINE_RATE = 0.1;

// Fires ~15min before the full-rate offline window runs out — motivation to
// come back peaks right before the slowdown, while it's still avoidable,
// not after the player has already been earning at 10% for hours.
const STAGE_EARLY_MS = OFFLINE_FULL_RATE_SECONDS * 1000 - 15 * 60 * 1000;
const STAGE_PILING_MS = 5 * 3600 * 1000; // ~5h: "cookies piling up"
const STAGE_REWARD_MS = 24 * 3600 * 1000; // 24h: "daily reward + cookies waiting"

function computeOfflineGain(elapsedSeconds, cps) {
  if (elapsedSeconds <= OFFLINE_FULL_RATE_SECONDS) return elapsedSeconds * cps;
  return OFFLINE_FULL_RATE_SECONDS * cps + (elapsedSeconds - OFFLINE_FULL_RATE_SECONDS) * cps * OFFLINE_RATE;
}

// Same schedule as game.js's Happy Hour / Weekend event math — keep these two
// in sync if the schedule ever changes.
const HAPPY_HOUR_START_HOURS_UTC = [6, 18]; // twice a day, 12h apart
const HAPPY_HOUR_DURATION_H = 1;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function getHappyHourWindows(d) {
  return HAPPY_HOUR_START_HOURS_UTC.map(h => ({
    start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h)),
    end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h + HAPPY_HOUR_DURATION_H)),
    startHour: h,
  }));
}

function getWeekendWindow(d) {
  const day = d.getUTCDay(); // 0 = Sun, 6 = Sat
  if (day !== 6 && day !== 0) return null;
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const satMidnight = midnight - (day === 0 ? 1 : 0) * 86400000;
  return { start: new Date(satMidnight), end: new Date(satMidnight + 2 * 86400000) };
}

// Returns the events active right now, each tagged with an occurrenceKey that
// stays constant for the whole duration of that specific occurrence — used to
// make sure we broadcast "event started" exactly once per occurrence. Happy
// Hour's key includes the start hour since there are two occurrences a day.
function getActiveEvents(now) {
  const events = [];
  const activeHH = getHappyHourWindows(now).find(w => now >= w.start && now < w.end);
  if (activeHH) {
    events.push({
      id: 'happyHour',
      occurrenceKey: `${dateKey(now)}-${activeHH.startHour}`,
      text: '🎉 Печеньковый час начался! Все печеньки x2 следующий час — заходи скорее.',
    });
  }
  const we = getWeekendWindow(now);
  if (we && now >= we.start && now < we.end) {
    events.push({
      id: 'weekend',
      occurrenceKey: dateKey(we.start),
      text: '🎊 Печеньковые выходные начались! x1.5 к производству и золотые печеньки падают вдвое чаще — весь уик-энд.',
    });
  }
  return events;
}

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

async function hmacSha256(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return new Uint8Array(sig);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Verifies the Telegram WebApp initData signature per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function validateInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const enc = new TextEncoder();
  const secretKey = await hmacSha256(enc.encode('WebAppData'), enc.encode(botToken));
  const computed = await hmacSha256(secretKey, enc.encode(dataCheckString));
  if (bytesToHex(computed) !== hash) return null;

  const userJson = params.get('user');
  if (!userJson) return null;
  const user = JSON.parse(userJson);
  const authDate = Number(params.get('auth_date') || '0');
  return { user, authDate };
}

// ---------- Analytics + referral rewards (D1) ----------
const REFEREE_WELCOME_BONUS = 300; // flat starter gift for whoever clicked the link
const REFERRER_BONUS_SECONDS = 1.5 * 3600; // ~1.5h of the referrer's own current cps
const REFERRER_BONUS_MIN = 200; // floor, for referrers with ~0 cps so far

// Every user who ever triggers any event gets a `users` row (idempotent —
// ON CONFLICT DO NOTHING). This is what referrer-id validation checks
// against: a referral only counts if the referrer id has itself shown up
// here from a real event, not an arbitrary number someone typed into
// /start.
async function ensureUser(env, userId, now) {
  await env.DB.prepare('INSERT INTO users (user_id, first_seen_ts) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING')
    .bind(userId, now).run();
}

async function grantReward(env, userId, amount) {
  if (!(amount > 0)) return;
  await env.DB.prepare('UPDATE users SET pending_reward = pending_reward + ? WHERE user_id = ?')
    .bind(amount, userId).run();
}

// Best-effort read of a user's last-known cps from the push worker's own KV
// store (populated by every /checkin) — used to size the referrer's reward
// relative to their actual production, not a flat number for everyone.
async function getKnownCps(env, userId) {
  const raw = await env.USERS.get(`user:${userId}`);
  if (!raw) return 0;
  try { return JSON.parse(raw).cps || 0; } catch (e) { return 0; }
}

// Inserts a raw event row, then derives things automatically so callers
// only ever report what actually happened (bot_start, ref_click, app_open,
// first_click, first_upgrade) — never the derived stages or rewards
// themselves:
//   - d1_return: the first event on a calendar day after this user's very
//     first-ever event, logged once.
//   - ref_install: this user's first app_open after a ref_click. Also the
//     moment referrer_id gets validated and attached (once, only if the
//     referrer is a real known user, and never to yourself).
//   - ref_active: this user's first first_click/d1_return after ref_click.
//     Grants both the referee's welcome bonus and the referrer's bonus,
//     exactly once — gated on the same "does ref_active already exist"
//     check that guards the event row itself, so there's no separate
//     idempotency flag to keep in sync.
async function logEvent(env, userId, eventName, refCode) {
  const now = Date.now();
  await ensureUser(env, userId, now);

  await env.DB.prepare('INSERT INTO events (user_id, event, ref_code, ts) VALUES (?, ?, ?, ?)')
    .bind(userId, eventName, refCode || null, now).run();

  if (eventName !== 'd1_return') {
    const first = await env.DB.prepare('SELECT MIN(ts) as firstTs FROM events WHERE user_id = ?').bind(userId).first();
    if (first && first.firstTs && first.firstTs < now) {
      const firstDay = new Date(first.firstTs).toISOString().slice(0, 10);
      const thisDay = new Date(now).toISOString().slice(0, 10);
      if (thisDay > firstDay) {
        const already = await env.DB.prepare("SELECT 1 FROM events WHERE user_id = ? AND event = 'd1_return' LIMIT 1").bind(userId).first();
        if (!already) {
          await env.DB.prepare('INSERT INTO events (user_id, event, ref_code, ts) VALUES (?, ?, ?, ?)')
            .bind(userId, 'd1_return', null, now).run();
        }
      }
    }
  }

  if (eventName === 'app_open' || eventName === 'first_click' || eventName === 'd1_return') {
    const refRow = await env.DB.prepare("SELECT ref_code FROM events WHERE user_id = ? AND event = 'ref_click' ORDER BY ts ASC LIMIT 1").bind(userId).first();
    if (refRow && refRow.ref_code) {
      const derived = eventName === 'app_open' ? 'ref_install' : 'ref_active';
      const already = await env.DB.prepare('SELECT 1 FROM events WHERE user_id = ? AND event = ? LIMIT 1').bind(userId, derived).first();
      if (!already) {
        await env.DB.prepare('INSERT INTO events (user_id, event, ref_code, ts) VALUES (?, ?, ?, ?)')
          .bind(userId, derived, refRow.ref_code, now).run();

        if (derived === 'ref_install') {
          const match = /^ref(\d+)$/.exec(refRow.ref_code);
          if (match) {
            const referrerId = Number(match[1]);
            if (referrerId !== userId) {
              const referrerExists = await env.DB.prepare('SELECT 1 FROM users WHERE user_id = ?').bind(referrerId).first();
              if (referrerExists) {
                // Only ever set once — a user's referrer can't be reassigned
                // by a later, unrelated ref_click.
                await env.DB.prepare('UPDATE users SET referrer_id = ? WHERE user_id = ? AND referrer_id IS NULL')
                  .bind(referrerId, userId).run();
              }
            }
          }
        }

        if (derived === 'ref_active') {
          const userRow = await env.DB.prepare('SELECT referrer_id FROM users WHERE user_id = ?').bind(userId).first();
          const referrerId = userRow && userRow.referrer_id;
          if (referrerId) {
            await grantReward(env, userId, REFEREE_WELCOME_BONUS);
            const referrerCps = await getKnownCps(env, referrerId);
            const referrerBonus = Math.max(REFERRER_BONUS_MIN, referrerCps * REFERRER_BONUS_SECONDS);
            await grantReward(env, referrerId, referrerBonus);
          }
        }
      }
    }
  }
}

async function handleEvent(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'bad_json' }, 400);
  }

  const ALLOWED_EVENTS = new Set(['app_open', 'first_click', 'first_upgrade']);
  if (!ALLOWED_EVENTS.has(body.event)) return jsonResponse({ ok: false, error: 'bad_event' }, 400);

  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);

  await logEvent(env, result.user.id, body.event);
  return jsonResponse({ ok: true });
}

// Telegram calls this on every message once a webhook is registered (see
// push/README.md for the setWebhook command). Only handles /start — that's
// all we need for bot_start / ref_click attribution.
async function handleTelegramWebhook(request, env) {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  let update;
  try {
    update = await request.json();
  } catch (e) {
    return jsonResponse({ ok: true }); // don't make Telegram retry on a malformed body
  }

  const msg = update.message;
  if (msg && msg.text && msg.text.startsWith('/start') && msg.from) {
    const userId = msg.from.id;
    await logEvent(env, userId, 'bot_start');
    const startParam = msg.text.trim().split(/\s+/)[1];
    if (startParam) {
      await logEvent(env, userId, 'ref_click', startParam);
    }
  }

  return jsonResponse({ ok: true });
}

// GET /funnel?key=<ADMIN_KEY> — distinct-user counts per event, the
// simplest useful view of the funnel. Not a strict sequential-conversion
// funnel yet; good enough to sanity-check the pipeline is capturing data,
// query push/schema.sql's `events` table directly (via `wrangler d1
// execute`) for real funnel/cohort SQL once there's enough data to matter.
async function handleFunnel(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  const stages = await env.DB.prepare(
    'SELECT event, COUNT(DISTINCT user_id) as users FROM events GROUP BY event ORDER BY users DESC'
  ).all();

  return jsonResponse({ ok: true, stages: stages.results });
}

async function handleCheckin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'bad_json' }, 400);
  }

  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) {
    return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  }

  const { user } = result;
  const key = `user:${user.id}`;
  const now = Date.now();
  const displayName = (user.first_name || user.username || 'Игрок').slice(0, 40);
  const data = {
    chatId: user.id,
    lastActiveTs: now,
    pushStage: 0,
    lastDailyClaim: Number(body.lastDailyClaim) || 0,
    cps: Number(body.cps) || 0,
    totalBaked: Number(body.totalBaked) || 0,
    displayName,
  };
  // Mirroring `data` into KV metadata lets list-all operations (leaderboard,
  // the push cron, broadcasts) read every user's fields straight off list()
  // results — no per-key get() needed. That matters a lot: Workers caps the
  // number of subrequests per invocation (50 on the free plan, 1000 on
  // paid), and a get()-per-user loop would blow through that once there are
  // more than a few dozen/thousand registered users, regardless of how many
  // are actually active. list() only costs one subrequest per 1000 keys.
  await env.USERS.put(key, JSON.stringify(data), { metadata: data });

  // Claim-on-checkin: reads whatever referral reward has accumulated for
  // this user since their last checkin and zeroes it out, decrementing by
  // exactly the amount just read (not resetting to 0) so a reward granted
  // concurrently by someone else's ref_active isn't clobbered mid-request.
  let pendingReward = 0;
  if (env.DB) {
    try {
      await logEvent(env, user.id, 'app_open');
      const row = await env.DB.prepare('SELECT pending_reward FROM users WHERE user_id = ?').bind(user.id).first();
      if (row && row.pending_reward > 0) {
        pendingReward = row.pending_reward;
        await env.DB.prepare('UPDATE users SET pending_reward = pending_reward - ? WHERE user_id = ?')
          .bind(pendingReward, user.id).run();
      }
    } catch (e) { /* analytics/rewards must never break checkin */ }
  }

  return jsonResponse({ ok: true, pendingReward });
}

async function handleLeaderboard(env) {
  const entries = [];
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const data = k.metadata;
      if (!data) continue; // older record written before metadata was added; heals on next checkin
      entries.push({
        userId: data.chatId,
        name: data.displayName || 'Игрок',
        cps: data.cps || 0,
        totalBaked: data.totalBaked || 0,
      });
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
  entries.sort((a, b) => b.cps - a.cps);
  return jsonResponse({ ok: true, entries: entries.slice(0, 50) });
}

function stageEarlyText() {
  return '⏰ Печеньки скоро замедлятся! Ещё 15 минут — и офлайн-скорость выпечки упадёт в 10 раз. Успей зайти, пока печём на полной ставке.';
}

function stagePilingText(data) {
  const approxCookies = Math.round(computeOfflineGain(STAGE_PILING_MS / 1000, data.cps || 0));
  const cookiesLine = approxCookies > 0 ? ` Уже накопилось ~${approxCookies} 🍪.` : '';
  return `🍪 Твои печеньки скучают без присмотра!${cookiesLine} Заходи, пока курсоры не разбежались.`;
}

function stageRewardText() {
  return '🎁 Ежедневная награда уже ждёт тебя в игре — а печеньки всё это время копились. Не заставляй бабушку печь зря!';
}

async function sendPush(env, chatId, text) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: '🍪 Открыть игру', web_app: { url: GAME_URL } }]],
      },
    }),
  });
}

async function runPushCycle(env) {
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const data = k.metadata;
      if (!data) continue; // older record written before metadata was added; heals on next checkin
      const elapsed = Date.now() - data.lastActiveTs;

      if (data.pushStage < 1 && elapsed >= STAGE_EARLY_MS) {
        await sendPush(env, data.chatId, stageEarlyText());
        data.pushStage = 1;
        await env.USERS.put(k.name, JSON.stringify(data), { metadata: data });
      } else if (data.pushStage < 2 && elapsed >= STAGE_PILING_MS) {
        await sendPush(env, data.chatId, stagePilingText(data));
        data.pushStage = 2;
        await env.USERS.put(k.name, JSON.stringify(data), { metadata: data });
      } else if (data.pushStage < 3 && elapsed >= STAGE_REWARD_MS) {
        await sendPush(env, data.chatId, stageRewardText());
        data.pushStage = 3;
        await env.USERS.put(k.name, JSON.stringify(data), { metadata: data });
      }
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
}

async function broadcastToAllUsers(env, text) {
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const data = k.metadata;
      if (data && data.chatId) await sendPush(env, data.chatId, text);
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
}

// Broadcasts an "event started" push to every known user, exactly once per
// event occurrence (tracked via a short-lived eventflag:* marker in KV).
async function checkAndBroadcastEvents(env) {
  const now = new Date();
  for (const ev of getActiveEvents(now)) {
    const markerKey = `eventflag:${ev.id}:${ev.occurrenceKey}`;
    const already = await env.USERS.get(markerKey);
    if (already) continue;
    await env.USERS.put(markerKey, '1', { expirationTtl: 5 * 24 * 3600 });
    await broadcastToAllUsers(env, ev.text);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === '/checkin' && request.method === 'POST') {
      return handleCheckin(request, env);
    }

    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      return handleLeaderboard(env);
    }

    if (url.pathname === '/event' && request.method === 'POST') {
      return handleEvent(request, env);
    }

    if (url.pathname === '/telegram-webhook' && request.method === 'POST') {
      return handleTelegramWebhook(request, env);
    }

    if (url.pathname === '/funnel' && request.method === 'GET') {
      return handleFunnel(request, env);
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([runPushCycle(env), checkAndBroadcastEvents(env)]));
  },
};
