// Cloudflare Worker: retention push notifications for the Cookie Clicker Telegram Mini App.
//
// - POST /checkin  — called by the mini app on every load. Validates Telegram
//   initData, then records "this user was just active" so the scheduled job
//   knows not to (yet) nag them.
// - scheduled()     — runs on a cron trigger. For every known user, checks how
//   long it's been since they were last active and sends at most one push per
//   inactivity stage (never repeats a stage, resets when they check in again).

const GAME_URL = 'https://mscherbin.github.io/cookie-clicker-tma/';
const STAGE1_MS = 5 * 3600 * 1000; // ~5h: "cookies piling up"
const STAGE2_MS = 24 * 3600 * 1000; // 24h: "daily reward + cookies waiting"

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  await env.USERS.put(key, JSON.stringify({
    chatId: user.id,
    lastActiveTs: now,
    pushStage: 0,
    lastDailyClaim: Number(body.lastDailyClaim) || 0,
    cps: Number(body.cps) || 0,
  }));

  return jsonResponse({ ok: true });
}

function stage1Text(data) {
  const approxCookies = Math.round((data.cps || 0) * (STAGE1_MS / 1000));
  const cookiesLine = approxCookies > 0 ? ` Уже накопилось ~${approxCookies} 🍪.` : '';
  return `🍪 Твои печеньки скучают без присмотра!${cookiesLine} Заходи, пока курсоры не разбежались.`;
}

function stage2Text() {
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
    const list = await env.USERS.list({ cursor });
    for (const k of list.keys) {
      const raw = await env.USERS.get(k.name);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const elapsed = Date.now() - data.lastActiveTs;

      if (data.pushStage < 1 && elapsed >= STAGE1_MS) {
        await sendPush(env, data.chatId, stage1Text(data));
        data.pushStage = 1;
        await env.USERS.put(k.name, JSON.stringify(data));
      } else if (data.pushStage < 2 && elapsed >= STAGE2_MS) {
        await sendPush(env, data.chatId, stage2Text());
        data.pushStage = 2;
        await env.USERS.put(k.name, JSON.stringify(data));
      }
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
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

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runPushCycle(env));
  },
};
