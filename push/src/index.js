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
const STAGE1_MS = 5 * 3600 * 1000; // ~5h: "cookies piling up"
const STAGE2_MS = 24 * 3600 * 1000; // 24h: "daily reward + cookies waiting"

// Same schedule as game.js's Happy Hour / Weekend event math — keep these two
// in sync if the schedule ever changes.
const HAPPY_HOUR_START_UTC = 18;
const HAPPY_HOUR_END_UTC = 20;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function getHappyHourWindow(d) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HAPPY_HOUR_START_UTC));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HAPPY_HOUR_END_UTC));
  return { start, end };
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
// make sure we broadcast "event started" exactly once per occurrence.
function getActiveEvents(now) {
  const events = [];
  const hh = getHappyHourWindow(now);
  if (now >= hh.start && now < hh.end) {
    events.push({
      id: 'happyHour',
      occurrenceKey: dateKey(now),
      text: '🎉 Печеньковый час начался! Все печеньки x2 следующие 2 часа — заходи скорее.',
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
    const list = await env.USERS.list({ prefix: 'user:', cursor });
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

async function broadcastToAllUsers(env, text) {
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const raw = await env.USERS.get(k.name);
      if (!raw) continue;
      let data;
      try { data = JSON.parse(raw); } catch (e) { continue; }
      if (data.chatId) await sendPush(env, data.chatId, text);
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

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([runPushCycle(env), checkAndBroadcastEvents(env)]));
  },
};
