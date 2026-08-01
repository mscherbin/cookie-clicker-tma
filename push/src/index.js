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

// The `?v=` here is a cache-buster for Telegram's Mini App cache: Telegram
// caches the app by URL, so a fresh query string forces it to reload index.html
// (and thus the freshly-versioned css/js). Bump this to the current frontend
// version on every deploy that must reach players immediately. Must also be
// updated in BotFather's Menu Button URL (that launch path bypasses the worker).
const GAME_URL = 'https://mscherbin.github.io/cookie-clicker-tma/?v=64';
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

// Monday-anchored week number (UTC). 1970-01-01 was a Thursday; the +3 shifts
// the boundary so each week starts Monday 00:00 UTC. Used to reset the weekly
// referral leaderboard.
function weekId(ts) {
  return Math.floor((Math.floor(ts / 86400000) + 3) / 7);
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
// Referrer's reward when their invite becomes active: 10 minutes of the
// REFERRER's own current production (their cps × 600s), floored for
// referrers who've barely started. The bigger your empire, the more each
// successful invite is worth.
const REFERRER_BONUS_SECONDS = 600; // 10 min of the referrer's own cps
const REFERRER_BONUS_MIN = 200; // floor, for referrers with ~0 cps so far

// Cookie-army boost curve knobs, read from the D1 `config` table so they can
// be retuned by editing a row instead of shipping a release. These are only
// the fallback if the table/rows are missing or unreadable; the client keeps
// its own matching fallback for the offline / pre-checkin case.
const REF_BOOST_MAX_DEFAULT = 1.0; // ceiling: +100% production
const REF_BOOST_TAU_DEFAULT = 25;  // growth constant: ~63% of MAX at 25 friends
// Layer 2: active friends extend the full-rate offline window (client applies
// it; these are the fallbacks if the config rows are missing).
const OFFLINE_BASE_HOURS_DEFAULT = 2;
const OFFLINE_MAX_EXTRA_DEFAULT = 8;
const OFFLINE_TAU_DEFAULT = 35;

// Paid "2x offline income" boost via Telegram Stars (currency XTR).
const OFFLINE_BOOST_STARS = 15; // price in Stars
const OFFLINE_BOOST_MULT = 2;   // multiplier applied to the frozen offline amount

// Paid "remove offline cap for 24h" boost.
const NOCAP_BOOST_STARS = 30;                 // price in Stars
const NOCAP_BOOST_DURATION_MS = 24 * 3600 * 1000; // 24h window per purchase

// Paid "x2 production for 1h" boost.
const PROD2X_BOOST_STARS = 10;              // price in Stars
const PROD2X_BOOST_DURATION_MS = 3600 * 1000; // 1h window per purchase

// Paid one-time "+10% production forever" boost. The +10% itself is applied
// client-side; the server just owns the has_permanent_production_boost flag.
const PERM_PROD_STARS = 200; // price in Stars (one-time)

// Paid one-time "skip the clicker": removes the click-count requirement on
// click upgrades (applied client-side); the server owns the has_click_bypass flag.
const CLICK_BYPASS_STARS = 100; // price in Stars (one-time)

// Anti-farm for /prestige/confirm: a new confirmed prestige needs at least this
// much wall-clock time since the last one. Any legit prestige takes far longer
// (you must re-buy all content), so this only ever blocks scripted hammering.
const PRESTIGE_MIN_INTERVAL_MS = 60 * 1000;

// Per-upgrade paid "skip the progress gate" prices (Stars). Server-authoritative
// — the client sends only the upgrade id, never a price. An id absent here is
// simply not skippable (this is also what keeps referral-locked content out:
// it's never listed). Must mirror the `skipStars` fields in game.js UPGRADES.
const UPGRADE_SKIP_PRICES = {
  click_u4: 20,
  click_t2_1: 40,
  click_t2_2: 60,
};

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

// The config rarely changes, but /checkin runs constantly, so cache it in
// isolate memory for a short TTL rather than hitting D1 on every request.
// A tuning edit propagates within CONFIG_TTL_MS across all isolates.
const CONFIG_TTL_MS = 60 * 1000;
let _configCache = null;
let _configCacheTs = 0;

async function getEconomyConfig(env) {
  const now = Date.now();
  if (_configCache && now - _configCacheTs < CONFIG_TTL_MS) return _configCache;
  const cfg = {
    refBoostMax: REF_BOOST_MAX_DEFAULT,
    refBoostTau: REF_BOOST_TAU_DEFAULT,
    offlineBaseHours: OFFLINE_BASE_HOURS_DEFAULT,
    offlineMaxExtra: OFFLINE_MAX_EXTRA_DEFAULT,
    offlineTau: OFFLINE_TAU_DEFAULT,
    // Referral boost event: a manually-scheduled window that multiplies the
    // one-time referral reward (Layer 1). Toggled before traffic pushes.
    refEventActive: false,
    refEventMultiplier: 1,
    refEventStart: 0, // ms epoch; 0 = no lower bound
    refEventEnd: 0,   // ms epoch; 0 = no upper bound
  };
  if (env.DB) {
    try {
      const rows = await env.DB.prepare(
        "SELECT key, value FROM config WHERE key IN ('ref_boost_max', 'ref_boost_tau', 'offline_base_hours', 'offline_max_extra_hours', 'offline_tau', 'ref_event_active', 'ref_event_multiplier', 'ref_event_start', 'ref_event_end')"
      ).all();
      const map = {};
      for (const r of (rows.results || [])) map[r.key] = Number(r.value);
      if (Number.isFinite(map.ref_boost_max)) cfg.refBoostMax = map.ref_boost_max;
      if (Number.isFinite(map.ref_boost_tau) && map.ref_boost_tau > 0) cfg.refBoostTau = map.ref_boost_tau;
      if (Number.isFinite(map.offline_base_hours)) cfg.offlineBaseHours = map.offline_base_hours;
      if (Number.isFinite(map.offline_max_extra_hours)) cfg.offlineMaxExtra = map.offline_max_extra_hours;
      if (Number.isFinite(map.offline_tau) && map.offline_tau > 0) cfg.offlineTau = map.offline_tau;
      cfg.refEventActive = map.ref_event_active > 0;
      if (Number.isFinite(map.ref_event_multiplier) && map.ref_event_multiplier > 0) cfg.refEventMultiplier = map.ref_event_multiplier;
      if (Number.isFinite(map.ref_event_start)) cfg.refEventStart = map.ref_event_start;
      if (Number.isFinite(map.ref_event_end)) cfg.refEventEnd = map.ref_event_end;
    } catch (e) { /* table may not exist yet — fall back to defaults */ }
  }
  _configCache = cfg;
  _configCacheTs = now;
  return cfg;
}

// Whether the referral boost event is live right now: master switch on, inside
// the [start, end] window (0 bounds = open-ended), and the multiplier actually
// boosts (> 1). Everything reads through this one predicate.
function refEventActiveNow(cfg, now) {
  if (!cfg.refEventActive || !(cfg.refEventMultiplier > 1)) return false;
  if (cfg.refEventStart && now < cfg.refEventStart) return false;
  if (cfg.refEventEnd && now > cfg.refEventEnd) return false;
  return true;
}

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
            // Layer 1 one-time reward, scaled by the referral event multiplier
            // while a boost event is live (used before traffic pushes).
            const cfg = await getEconomyConfig(env);
            const eventMult = refEventActiveNow(cfg, now) ? cfg.refEventMultiplier : 1;
            await grantReward(env, userId, REFEREE_WELCOME_BONUS * eventMult);
            const referrerCps = await getKnownCps(env, referrerId);
            const referrerBonus = Math.max(REFERRER_BONUS_MIN, referrerCps * REFERRER_BONUS_SECONDS);
            await grantReward(env, referrerId, referrerBonus * eventMult);
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

  // Telegram Stars payment flow. pre_checkout_query MUST be answered within
  // 10s or Telegram auto-cancels the payment — answer immediately.
  if (update.pre_checkout_query) {
    await tgCall(env, 'answerPreCheckoutQuery', { pre_checkout_query_id: update.pre_checkout_query.id, ok: true });
    return jsonResponse({ ok: true });
  }

  const msg = update.message;
  if (msg && msg.successful_payment) {
    await handleSuccessfulPayment(env, msg);
    return jsonResponse({ ok: true });
  }
  if (msg && msg.refunded_payment) {
    await handleRefundedPayment(env, msg);
    return jsonResponse({ ok: true });
  }

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

// GET /online?key=<ADMIN_KEY> — live activity snapshot from KV metadata (no
// per-user reads). "online" = pinged /checkin in the last 5 min (checkin fires
// every ~2 min while playing, so 5 min ≈ "in the app right now"); "day" = DAU
// (last 24h); "total" = everyone ever registered.
async function handleOnline(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }
  const now = Date.now();
  const FIVE_MIN = 5 * 60 * 1000;
  const DAY = 24 * 3600 * 1000;
  let total = 0, online = 0, day = 0;
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const data = k.metadata;
      if (!data || !data.chatId) continue;
      total++;
      const ago = now - (data.lastActiveTs || 0);
      if (ago <= FIVE_MIN) online++;
      if (ago <= DAY) day++;
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
  return jsonResponse({ ok: true, online, day, total });
}

// GET /webhook-info?key=<ADMIN_KEY> — proxies getWebhookInfo so we can check
// allowed_updates (must include pre_checkout_query for Stars) without exposing
// the bot token.
async function handleWebhookInfo(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }
  const res = await tgCall(env, 'getWebhookInfo', {});
  return jsonResponse(res);
}

// POST /fix-webhook?key=<ADMIN_KEY> — re-registers the webhook with the update
// types the payment flow needs (message + pre_checkout_query), keeping the
// same URL and secret token.
async function handleFixWebhook(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }
  const res = await tgCall(env, 'setWebhook', {
    url: 'https://cookie-clicker-tma-push.mscherbin.workers.dev/telegram-webhook',
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ['message', 'pre_checkout_query'],
  });
  return jsonResponse(res);
}

// POST /create-offline-invoice { initData, amount } — the client taps "claim
// x2 for Stars". We FREEZE `amount` (the offline earnings at this moment) into
// a pending star_invoices row and return a Telegram Stars invoice link. The
// credit (amount*2) is granted only later, by the successful_payment webhook.
async function handleCreateOfflineInvoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ ok: false, error: 'bad_amount' }, 400);
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const invoiceId = crypto.randomUUID();
  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    await env.DB.prepare('INSERT INTO star_invoices (invoice_id, user_id, amount, status, created_ts) VALUES (?, ?, ?, ?, ?)')
      .bind(invoiceId, userId, amount, 'pending', now).run();
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const res = await tgCall(env, 'createInvoiceLink', {
    title: 'Удвоить офлайн-доход',
    description: 'Забери 2× накопленных офлайн-печенек мгновенно, без рекламы.',
    payload: invoiceId, // echoed back verbatim in successful_payment.invoice_payload
    currency: 'XTR',
    prices: [{ label: '×2 офлайн-доход', amount: OFFLINE_BOOST_STARS }],
  });
  if (!res || !res.ok || !res.result) {
    return jsonResponse({ ok: false, error: 'invoice_failed' }, 502);
  }
  return jsonResponse({ ok: true, link: res.result });
}

// POST /create-nocap-invoice { initData } — the "remove offline cap for 24h"
// boost. No client value to freeze: the effect is a pure time window the server
// owns. On payment the webhook extends boost_expires_at by 24h.
async function handleCreateNocapInvoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const invoiceId = crypto.randomUUID();
  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    await env.DB.prepare('INSERT INTO star_invoices (invoice_id, user_id, amount, status, created_ts, kind) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(invoiceId, userId, 0, 'pending', now, 'nocap_24h').run();
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const res = await tgCall(env, 'createInvoiceLink', {
    title: 'Снять кап офлайна на 24 часа',
    description: 'Офлайн-доход на 100% без замедления целые сутки.',
    payload: invoiceId,
    currency: 'XTR',
    prices: [{ label: 'Без ограничений 24ч', amount: NOCAP_BOOST_STARS }],
  });
  if (!res || !res.ok || !res.result) {
    return jsonResponse({ ok: false, error: 'invoice_failed' }, 502);
  }
  return jsonResponse({ ok: true, link: res.result });
}

// POST /create-boost2x-invoice { initData } — the "x2 production for 1h" boost.
// Like nocap, a pure server-owned time window (boost2x_expires_at).
async function handleCreateBoost2xInvoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const invoiceId = crypto.randomUUID();
  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    await env.DB.prepare('INSERT INTO star_invoices (invoice_id, user_id, amount, status, created_ts, kind) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(invoiceId, userId, 0, 'pending', now, 'prod2x_1h').run();
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const res = await tgCall(env, 'createInvoiceLink', {
    title: '×2 производство на 1 час',
    description: 'Удвой выпечку печенья на целый час.',
    payload: invoiceId,
    currency: 'XTR',
    prices: [{ label: '×2 производство 1ч', amount: PROD2X_BOOST_STARS }],
  });
  if (!res || !res.ok || !res.result) {
    return jsonResponse({ ok: false, error: 'invoice_failed' }, 502);
  }
  return jsonResponse({ ok: true, link: res.result });
}

// POST /create-perm-invoice { initData } — one-time "+10% forever" boost.
// CRITICAL: refuse BEFORE creating the invoice if the user already owns it, so
// they can never be charged a second, real payment for something they have.
// (charge_id idempotency wouldn't help here — a second purchase is a separate
// genuine payment.)
async function handleCreatePermInvoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    const owned = await env.DB.prepare('SELECT has_permanent_production_boost AS h FROM users WHERE user_id = ?').bind(userId).first();
    if (owned && owned.h) return jsonResponse({ ok: false, error: 'already_owned' }, 409);
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const invoiceId = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO star_invoices (invoice_id, user_id, amount, status, created_ts, kind) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(invoiceId, userId, 0, 'pending', now, 'perm_prod').run();
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const res = await tgCall(env, 'createInvoiceLink', {
    title: '+10% к производству навсегда',
    description: 'Разовая покупка: +10% к выпечке печенья без срока действия.',
    payload: invoiceId,
    currency: 'XTR',
    prices: [{ label: '+10% навсегда', amount: PERM_PROD_STARS }],
  });
  if (!res || !res.ok || !res.result) {
    return jsonResponse({ ok: false, error: 'invoice_failed' }, 502);
  }
  return jsonResponse({ ok: true, link: res.result });
}

// POST /create-clickskip-invoice { initData } — one-time "skip the clicker".
// Same ownership-first guard as perm_prod: refuse before creating the invoice
// if already owned, so a second real payment can never be taken.
async function handleCreateClickskipInvoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    const owned = await env.DB.prepare('SELECT has_click_bypass AS h FROM users WHERE user_id = ?').bind(userId).first();
    if (owned && owned.h) return jsonResponse({ ok: false, error: 'already_owned' }, 409);
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const invoiceId = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO star_invoices (invoice_id, user_id, amount, status, created_ts, kind) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(invoiceId, userId, 0, 'pending', now, 'click_bypass').run();
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const res = await tgCall(env, 'createInvoiceLink', {
    title: 'Открыть клик-апгрейды без кликов',
    description: 'Разовая покупка: снимает требование по числу кликов у клик-апгрейдов.',
    payload: invoiceId,
    currency: 'XTR',
    prices: [{ label: 'Без кликов', amount: CLICK_BYPASS_STARS }],
  });
  if (!res || !res.ok || !res.result) {
    return jsonResponse({ ok: false, error: 'invoice_failed' }, 502);
  }
  return jsonResponse({ ok: true, link: res.result });
}

// POST /create-upgrade-skip-invoice { initData, upgradeId } — buy an instant
// unlock of a single progress-gated upgrade. Price comes from UPGRADE_SKIP_PRICES
// (server-authoritative; the client-sent id is validated against it). Refuses if
// already paid-unlocked, same as perm_prod — organic (click) unlock is guarded
// client-side (the server doesn't track clicks).
async function handleCreateUpgradeSkipInvoice(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  const upgradeId = String(body.upgradeId || '');
  const price = UPGRADE_SKIP_PRICES[upgradeId];
  if (!price) return jsonResponse({ ok: false, error: 'not_skippable' }, 400);
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    const row = await env.DB.prepare('SELECT paid_unlocked_upgrades AS pu FROM users WHERE user_id = ?').bind(userId).first();
    const owned = parseIdList(row && row.pu);
    if (owned.includes(upgradeId)) return jsonResponse({ ok: false, error: 'already_owned' }, 409);
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const invoiceId = crypto.randomUUID();
  try {
    await env.DB.prepare('INSERT INTO star_invoices (invoice_id, user_id, amount, status, created_ts, kind, upgrade_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(invoiceId, userId, 0, 'pending', now, 'upgrade_skip', upgradeId).run();
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const res = await tgCall(env, 'createInvoiceLink', {
    title: 'Мгновенная разблокировка апгрейда',
    description: 'Снимает прогресс-требование у выбранного апгрейда (покупка за печеньки — как обычно).',
    payload: invoiceId,
    currency: 'XTR',
    prices: [{ label: 'Разблокировка', amount: price }],
  });
  if (!res || !res.ok || !res.result) {
    return jsonResponse({ ok: false, error: 'invoice_failed' }, 502);
  }
  return jsonResponse({ ok: true, link: res.result });
}

// Parse a comma-separated id list column into a clean array.
function parseIdList(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

// successful_payment webhook. Idempotent via a conditional status flip: the
// UPDATE only takes effect the first time (pending -> paid), so a retried or
// duplicate webhook for the same invoice/charge never credits twice. Credits
// the FROZEN amount*2 (not a recomputed value) into pending_paid_cookies.
async function handleSuccessfulPayment(env, msg) {
  if (!env.DB) return;
  const sp = msg.successful_payment;
  const chargeId = sp && sp.telegram_payment_charge_id;
  const invoiceId = sp && sp.invoice_payload;
  const userId = msg.from && msg.from.id;
  if (!chargeId || !invoiceId || !userId) return;
  try {
    const inv = await env.DB.prepare('SELECT amount, kind, upgrade_id FROM star_invoices WHERE invoice_id = ? AND status = ?')
      .bind(invoiceId, 'pending').first();
    if (!inv) return; // unknown invoice, or already processed
    const upd = await env.DB.prepare("UPDATE star_invoices SET status = 'paid', charge_id = ?, paid_ts = ? WHERE invoice_id = ? AND status = 'pending'")
      .bind(chargeId, Date.now(), invoiceId).run();
    if (!upd.meta || upd.meta.changes === 0) return; // lost the race — already processed
    await ensureUser(env, userId, Date.now());
    if (inv.kind === 'nocap_24h' || inv.kind === 'prod2x_1h') {
      // Time-window boosts: extend from the later of (current expiry, now) so
      // buying while active adds a full window instead of overwriting the tail.
      const col = inv.kind === 'nocap_24h' ? 'boost_expires_at' : 'boost2x_expires_at';
      const dur = inv.kind === 'nocap_24h' ? NOCAP_BOOST_DURATION_MS : PROD2X_BOOST_DURATION_MS;
      const row = await env.DB.prepare(`SELECT ${col} AS e FROM users WHERE user_id = ?`).bind(userId).first();
      const base = Math.max((row && Number.isFinite(row.e) ? row.e : 0), Date.now());
      await env.DB.prepare(`UPDATE users SET ${col} = ? WHERE user_id = ?`)
        .bind(base + dur, userId).run();
    } else if (inv.kind === 'perm_prod') {
      // One-time permanent +10% flag. Idempotent (the conditional invoice flip
      // guarantees this runs once; setting to 1 is idempotent regardless).
      await env.DB.prepare('UPDATE users SET has_permanent_production_boost = 1 WHERE user_id = ?')
        .bind(userId).run();
    } else if (inv.kind === 'click_bypass') {
      // One-time "skip the clicker" flag. Idempotent, same as perm_prod.
      await env.DB.prepare('UPDATE users SET has_click_bypass = 1 WHERE user_id = ?')
        .bind(userId).run();
    } else if (inv.kind === 'upgrade_skip') {
      // Per-upgrade paid unlock: add the upgrade id to the user's set. The
      // conditional invoice flip above guarantees this runs once per invoice;
      // the set add is idempotent regardless.
      const row = await env.DB.prepare('SELECT paid_unlocked_upgrades AS pu FROM users WHERE user_id = ?').bind(userId).first();
      const set = parseIdList(row && row.pu);
      if (inv.upgrade_id && !set.includes(inv.upgrade_id)) set.push(inv.upgrade_id);
      await env.DB.prepare('UPDATE users SET paid_unlocked_upgrades = ? WHERE user_id = ?')
        .bind(set.join(','), userId).run();
    } else {
      // offline_2x (default): credit the frozen amount x2.
      const credit = (inv.amount || 0) * OFFLINE_BOOST_MULT;
      await env.DB.prepare('UPDATE users SET pending_paid_cookies = pending_paid_cookies + ? WHERE user_id = ?')
        .bind(credit, userId).run();
    }
  } catch (e) { console.log('successful_payment error', e); }
}

// refunded_payment webhook. Log only — we never claw back cookies (they may be
// spent already; retroactive rollback is unreliable). Manual review handles abuse.
async function handleRefundedPayment(env, msg) {
  if (!env.DB) return;
  const rp = msg.refunded_payment;
  const chargeId = rp && rp.telegram_payment_charge_id;
  const userId = msg.from && msg.from.id;
  if (!chargeId) return;
  try {
    await env.DB.prepare('INSERT OR IGNORE INTO refunds (charge_id, user_id, amount, ts) VALUES (?, ?, ?, ?)')
      .bind(chargeId, userId || null, rp.total_amount || 0, Date.now()).run();
    await env.DB.prepare("UPDATE star_invoices SET status = 'refunded' WHERE charge_id = ?").bind(chargeId).run();
  } catch (e) { console.log('refund error', e); }
}

// POST /prestige/confirm { initData } — the client calls this at the moment it
// confirms an ascension. The server owns prestige_count (the leaderboard's
// primary rank key), so it can never be inflated by editing client state:
// prestige_count only ever grows here, gated by an anti-farm check.
async function handlePrestigeConfirm(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    const row = await env.DB.prepare('SELECT prestige_count AS pc, last_prestige_at AS lpa, is_prestige_pioneer AS pion FROM users WHERE user_id = ?').bind(userId).first();
    const prestigeCount = (row && Number.isFinite(row.pc)) ? row.pc : 0;
    const lastAt = (row && Number.isFinite(row.lpa)) ? row.lpa : 0;

    // Anti-farm: after the first prestige, require both a minimum interval AND
    // at least one real session (app_open) since the last one. A script can't
    // manufacture app_open rows without a valid initData checkin, and the
    // interval caps the rate regardless.
    if (lastAt > 0) {
      const sinceMs = now - lastAt;
      if (sinceMs < PRESTIGE_MIN_INTERVAL_MS) {
        return jsonResponse({ ok: false, error: 'too_soon', retryAfterMs: PRESTIGE_MIN_INTERVAL_MS - sinceMs, prestigeCount }, 429);
      }
      const ev = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ? AND event = 'app_open' AND ts > ?").bind(userId, lastAt).first();
      if (!ev || !(ev.n > 0)) {
        return jsonResponse({ ok: false, error: 'no_activity', prestigeCount }, 429);
      }
    }

    const newCount = prestigeCount + 1;
    await env.DB.prepare('UPDATE users SET prestige_count = ?, last_prestige_at = ? WHERE user_id = ?')
      .bind(newCount, now, userId).run();

    // Pioneer title on the FIRST prestige only.
    let isPioneer = !!(row && row.pion);
    if (prestigeCount === 0) isPioneer = await maybeGrantPioneer(env, userId, now);

    return jsonResponse({ ok: true, prestigeCount: newCount, isPioneer });
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }
}

// Grants the "prestige pioneer" title if a slot is still open and (optional)
// deadline hasn't passed. The conditional config UPDATE (bump only while under
// the limit, then check it actually changed) keeps two racing first-prestiges
// from over-issuing the last slot.
async function maybeGrantPioneer(env, userId, now) {
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM config WHERE key IN ('pioneer_limit','pioneer_granted','pioneer_deadline_ts')").all();
    const map = {}; for (const r of (rows.results || [])) map[r.key] = Number(r.value);
    const limit = Number.isFinite(map.pioneer_limit) ? map.pioneer_limit : 50;
    const granted = Number.isFinite(map.pioneer_granted) ? map.pioneer_granted : 0;
    const deadline = Number.isFinite(map.pioneer_deadline_ts) ? map.pioneer_deadline_ts : 0;
    if (granted >= limit) return false;
    if (deadline > 0 && now > deadline) return false;
    const upd = await env.DB.prepare("UPDATE config SET value = CAST(value AS INTEGER) + 1 WHERE key = 'pioneer_granted' AND CAST(value AS INTEGER) < ?").bind(limit).run();
    if (!upd.meta || upd.meta.changes === 0) return false; // someone grabbed the last slot
    await env.DB.prepare('UPDATE users SET is_prestige_pioneer = 1 WHERE user_id = ?').bind(userId).run();
    return true;
  } catch (e) { return false; }
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
  // Claim-on-checkin: reads whatever referral reward has accumulated for
  // this user since their last checkin and zeroes it out, decrementing by
  // exactly the amount just read (not resetting to 0) so a reward granted
  // concurrently by someone else's ref_active isn't clobbered mid-request.
  let pendingReward = 0;
  let activeReferrals = 0;
  let maxActiveFriendsEver = 0;
  const curWeek = weekId(now);
  let weeklyReferrals = 0;
  let paidOfflineCredit = 0;
  let boostExpiresAt = 0;
  let boost2xExpiresAt = 0;
  let hasPermProdBoost = false;
  let hasClickBypass = false;
  let serverPrestigeCount = 0;
  let isPrestigePioneer = false;
  let paidUnlockedUpgrades = [];
  if (env.DB) {
    try {
      await logEvent(env, user.id, 'app_open');
      const row = await env.DB.prepare('SELECT pending_reward FROM users WHERE user_id = ?').bind(user.id).first();
      if (row && row.pending_reward > 0) {
        pendingReward = row.pending_reward;
        await env.DB.prepare('UPDATE users SET pending_reward = pending_reward - ? WHERE user_id = ?')
          .bind(pendingReward, user.id).run();
      }
      // "Cookie army": how many people this user referred have become active
      // (reached ref_active). Counted off the validated referrer_id link — so
      // it inherits the anti-self / referrer-must-be-real gating that guards
      // referrer_id, no farming via bare ref_clicks. Drives a permanent
      // client-side production multiplier, so it's returned on every checkin.
      const armyRow = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users u WHERE u.referrer_id = ? AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.user_id AND e.event = 'ref_active')"
      ).bind(user.id).first();
      activeReferrals = (armyRow && armyRow.n) || 0;
      // Peak army size, monotonic. Referral titles read off this, not the live
      // count, so a title never regresses if a friend goes inactive. Fall back
      // to the live count if the column read fails (e.g. before migration).
      maxActiveFriendsEver = activeReferrals;
      await env.DB.prepare('UPDATE users SET max_active_friends_ever = MAX(max_active_friends_ever, ?) WHERE user_id = ?')
        .bind(activeReferrals, user.id).run();
      const maxRow = await env.DB.prepare('SELECT max_active_friends_ever AS m FROM users WHERE user_id = ?').bind(user.id).first();
      if (maxRow && Number.isFinite(maxRow.m)) maxActiveFriendsEver = maxRow.m;

      // Weekly snapshot: on the first checkin of a new week, rebase the
      // baseline to the current peak so this week's score starts at 0. Weekly
      // score = friends recruited since that rebase. This is what lets the
      // weekly leaderboard reset without a cron.
      const wkRow = await env.DB.prepare('SELECT weekly_baseline AS b, weekly_week_id AS w FROM users WHERE user_id = ?').bind(user.id).first();
      let baseline = wkRow && Number.isFinite(wkRow.b) ? wkRow.b : 0;
      const storedWeek = wkRow && Number.isFinite(wkRow.w) ? wkRow.w : 0;
      if (storedWeek !== curWeek) {
        baseline = maxActiveFriendsEver;
        await env.DB.prepare('UPDATE users SET weekly_baseline = ?, weekly_week_id = ? WHERE user_id = ?')
          .bind(baseline, curWeek, user.id).run();
      }
      weeklyReferrals = Math.max(0, maxActiveFriendsEver - baseline);

      // Deliver cookies bought with Stars (2x offline boost), same claim-on-
      // checkin channel as pending_reward. Kept last in the block so a missing
      // column (pre-migration) doesn't abort the reads above.
      const paidRow = await env.DB.prepare('SELECT pending_paid_cookies FROM users WHERE user_id = ?').bind(user.id).first();
      if (paidRow && paidRow.pending_paid_cookies > 0) {
        paidOfflineCredit = paidRow.pending_paid_cookies;
        await env.DB.prepare('UPDATE users SET pending_paid_cookies = pending_paid_cookies - ? WHERE user_id = ?')
          .bind(paidOfflineCredit, user.id).run();
      }
      // Boost windows + permanent flag (server-authoritative); client uses them
      // for the offline split calc, online x2, the permanent +10%, and timers.
      const boostRow = await env.DB.prepare('SELECT boost_expires_at AS e, boost2x_expires_at AS e2, has_permanent_production_boost AS perm, has_click_bypass AS clickbypass, prestige_count AS pc, is_prestige_pioneer AS pion, paid_unlocked_upgrades AS pu FROM users WHERE user_id = ?').bind(user.id).first();
      if (boostRow && Number.isFinite(boostRow.e)) boostExpiresAt = boostRow.e;
      if (boostRow && Number.isFinite(boostRow.e2)) boost2xExpiresAt = boostRow.e2;
      if (boostRow && boostRow.perm) hasPermProdBoost = true;
      if (boostRow && boostRow.clickbypass) hasClickBypass = true;
      if (boostRow && Number.isFinite(boostRow.pc)) serverPrestigeCount = boostRow.pc;
      if (boostRow && boostRow.pion) isPrestigePioneer = true;
      if (boostRow) paidUnlockedUpgrades = parseIdList(boostRow.pu);
    } catch (e) { /* analytics/rewards must never break checkin */ }
  }

  const data = {
    chatId: user.id,
    lastActiveTs: now,
    pushStage: 0,
    lastDailyClaim: Number(body.lastDailyClaim) || 0,
    cps: Number(body.cps) || 0,
    totalBaked: Number(body.totalBaked) || 0,
    displayName,
    maxActiveFriendsEver,
    weeklyReferrals,      // friends recruited this week (for the weekly board)
    weeklyWeekId: curWeek, // which week weeklyReferrals belongs to (stale => 0 on the board)
    prestigeCount: serverPrestigeCount, // server-authoritative; leaderboard's primary rank key
    isPioneer: isPrestigePioneer,       // "prestige pioneer" title flag
    lifetimeCookies: Number(body.lifetimeCookies) || 0, // never-resetting total across runs (client-sent, like cps)
    crumbs: Number(body.crumbs) || 0,   // permanent bonus % (client-sent, like cps); for the rank-badge tooltip
  };
  // Mirroring `data` into KV metadata lets list-all operations (leaderboard,
  // the push cron, broadcasts) read every user's fields straight off list()
  // results — no per-key get() needed. That matters a lot: Workers caps the
  // number of subrequests per invocation (50 on the free plan, 1000 on
  // paid), and a get()-per-user loop would blow through that once there are
  // more than a few dozen/thousand registered users, regardless of how many
  // are actually active. list() only costs one subrequest per 1000 keys.
  await env.USERS.put(key, JSON.stringify(data), { metadata: data });

  // Tunable boost curve knobs, so the client's referralBoost() can be
  // retuned server-side without a frontend release.
  const cfg = await getEconomyConfig(env);
  const refConfig = { max: cfg.refBoostMax, tau: cfg.refBoostTau };
  const offlineConfig = { base: cfg.offlineBaseHours, maxExtra: cfg.offlineMaxExtra, tau: cfg.offlineTau };
  const refEvent = refEventActiveNow(cfg, now)
    ? { active: true, multiplier: cfg.refEventMultiplier, endAt: cfg.refEventEnd || 0 }
    : { active: false };

  return jsonResponse({ ok: true, pendingReward, activeReferrals, maxActiveFriendsEver, refConfig, offlineConfig, refEvent, paidOfflineCredit, boostExpiresAt, boost2xExpiresAt, hasPermProdBoost, hasClickBypass, prestigeCount: serverPrestigeCount, isPioneer: isPrestigePioneer, paidUnlockedUpgrades });
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
        maxActiveFriendsEver: data.maxActiveFriendsEver || 0, // client derives the referral title from this
        prestigeCount: data.prestigeCount || 0, // primary rank key (server-authoritative)
        isPioneer: !!data.isPioneer,
        lifetimeCookies: data.lifetimeCookies || 0, // never-resetting total, shown as a secondary figure
        crumbs: data.crumbs || 0, // this player's permanent bonus % (rank-badge tooltip)
      });
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
  // Prestige first (the most statusful action), current CPS as the tiebreaker
  // within a tier — so a just-ascended player (CPS reset to ~0) still ranks by
  // their prestige tier instead of dropping to the bottom.
  entries.sort((a, b) => (b.prestigeCount - a.prestigeCount) || (b.cps - a.cps));
  // The real pioneer threshold (config-driven), so the client's "Пионер" tooltip
  // states the exact number that was actually granted.
  let pioneerLimit = 50;
  try {
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'pioneer_limit'").first();
    if (row && Number.isFinite(Number(row.value))) pioneerLimit = Number(row.value);
  } catch (e) { /* config table may not exist yet — fall back to default */ }
  return jsonResponse({ ok: true, entries: entries.slice(0, 50), pioneerLimit });
}

// Referral leaderboard: top referrers by all-time peak army size, plus a
// weekly board of friends recruited during the current week. Both are built
// straight from KV metadata (one list() sweep, no per-user reads). Weekly
// entries whose stored week != the current week are treated as 0 — that's how
// the weekly board resets on the Monday boundary without any cron.
const REFERRAL_TOP_N = 50;

async function handleReferralLeaderboard(env) {
  const curWeek = weekId(Date.now());
  const allTime = [];
  const weekly = [];
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const data = k.metadata;
      if (!data) continue;
      const name = data.displayName || 'Игрок';
      const peak = data.maxActiveFriendsEver || 0;
      if (peak > 0) allTime.push({ userId: data.chatId, name, score: peak });
      const wk = (data.weeklyWeekId === curWeek) ? (data.weeklyReferrals || 0) : 0;
      if (wk > 0) weekly.push({ userId: data.chatId, name, score: wk });
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
  allTime.sort((a, b) => b.score - a.score);
  weekly.sort((a, b) => b.score - a.score);
  return jsonResponse({
    ok: true,
    allTime: allTime.slice(0, REFERRAL_TOP_N),
    weekly: weekly.slice(0, REFERRAL_TOP_N),
  });
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

  // Referral boost event (config-driven). Announced once per occurrence,
  // keyed by its start + multiplier — to re-announce a new run, set a fresh
  // ref_event_start. Fires within one cron tick (~15 min) of the event
  // turning on.
  const cfg = await getEconomyConfig(env);
  if (refEventActiveNow(cfg, Date.now())) {
    const occ = `${cfg.refEventStart || 'manual'}:${cfg.refEventMultiplier}`;
    const markerKey = `eventflag:refevent:${occ}`;
    const already = await env.USERS.get(markerKey);
    if (!already) {
      await env.USERS.put(markerKey, '1', { expirationTtl: 7 * 24 * 3600 });
      const tail = cfg.refEventEnd ? ' Успей позвать друзей!' : '';
      await broadcastToAllUsers(env, `🎉 Событие рефералов! Награда за приглашённых друзей ×${cfg.refEventMultiplier}.${tail}`);
    }
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

    if (url.pathname === '/referral-leaderboard' && request.method === 'GET') {
      return handleReferralLeaderboard(env);
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

    if (url.pathname === '/online' && request.method === 'GET') {
      return handleOnline(request, env);
    }

    if (url.pathname === '/create-offline-invoice' && request.method === 'POST') {
      return handleCreateOfflineInvoice(request, env);
    }

    if (url.pathname === '/create-nocap-invoice' && request.method === 'POST') {
      return handleCreateNocapInvoice(request, env);
    }

    if (url.pathname === '/create-boost2x-invoice' && request.method === 'POST') {
      return handleCreateBoost2xInvoice(request, env);
    }

    if (url.pathname === '/create-perm-invoice' && request.method === 'POST') {
      return handleCreatePermInvoice(request, env);
    }

    if (url.pathname === '/create-clickskip-invoice' && request.method === 'POST') {
      return handleCreateClickskipInvoice(request, env);
    }

    if (url.pathname === '/prestige/confirm' && request.method === 'POST') {
      return handlePrestigeConfirm(request, env);
    }

    if (url.pathname === '/create-upgrade-skip-invoice' && request.method === 'POST') {
      return handleCreateUpgradeSkipInvoice(request, env);
    }

    if (url.pathname === '/webhook-info' && request.method === 'GET') {
      return handleWebhookInfo(request, env);
    }

    if (url.pathname === '/fix-webhook' && request.method === 'POST') {
      return handleFixWebhook(request, env);
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([runPushCycle(env), checkAndBroadcastEvents(env)]));
  },
};
