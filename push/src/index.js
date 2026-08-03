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
const GAME_URL = 'https://mscherbin.github.io/cookie-clicker-tma/?v=90';
const BOT_USERNAME = 'bestcookieclickerbot'; // for the /go redirect deep link
const CHANNEL_LINK = 'https://t.me/bestcookieclicker'; // our announcements channel
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
      msgKey: 'evt.happyHour', // localized per-user at broadcast time
    });
  }
  const we = getWeekendWindow(now);
  if (we && now >= we.start && now < we.end) {
    events.push({
      id: 'weekend',
      occurrenceKey: dateKey(we.start),
      msgKey: 'evt.weekend',
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
    // no-store: our JSON responses are all dynamic (per-user checkin, admin
    // analytics). Without this the Cloudflare edge can cache a GET response by
    // URL and serve stale numbers — e.g. /funnel?period=today would freeze until
    // the cache expired. Nothing here should ever be cached by any intermediary.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders() },
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

// Max age of a Telegram initData string we still accept, in seconds. Guards
// against replay of a captured-but-valid initData (see validateInitData).
const INIT_DATA_MAX_AGE_SEC = 86400; // 24h

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
  // Replay protection: even with a valid HMAC, a captured initData string
  // (logs, sharing, MITM) must not be usable forever. Reject anything older
  // than INIT_DATA_MAX_AGE_SEC. Telegram refreshes initData on each launch, so
  // legitimate clients always send a fresh auth_date.
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SEC) return null;
  // start_param = the ?startapp=<x> value the Mini App was opened with (e.g.
  // 'fb_en'), used for traffic-source attribution. Sanitized by the caller.
  const startParam = params.get('start_param') || null;
  return { user, authDate, startParam };
}

// Sanitize a start_param (from ?startapp=<x> or /start <x>) into a click id /
// source tag: [A-Za-z0-9_-], up to 128 chars. Referral codes (refNNN) are NOT
// sources/subids — they come through the /start referral flow — so we exclude
// them here.
function sanitizeSource(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().slice(0, 128);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(s)) return null;
  if (/^ref\d+$/.test(s)) return null;
  return s;
}

// Read a raw string value from the key/value `config` table (e.g. the Keitaro
// postback URL). No cache — read rarely.
async function getConfigStr(env, key) {
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare('SELECT value FROM config WHERE key = ?').bind(key).first();
    return row ? row.value : null;
  } catch (e) { return null; }
}

// First-touch traffic attribution: on the FIRST entry that carries a start_param
// (Keitaro click id via ?startapp=<subid> or /start <subid>), store it in
// users.kt_subid and mark the coarse source 'keitaro' — both set ONCE and never
// overwritten (WHERE kt_subid IS NULL), so the first click that brought the user
// in wins. The precise per-click id lives in kt_subid (for the S2S postback);
// `source` stays coarse ('keitaro') so /funnel segments don't explode per click.
async function captureAttribution(env, userId, startParam) {
  if (!env.DB) return;
  const clean = sanitizeSource(startParam);
  if (!clean) return;
  // Reverse the /go redirect's dot→dash encoding: Keitaro subids contain dots
  // (e.g. 37o23c7.1f.381o), which Telegram strips from start params, so /go sends
  // them dashed and we restore the original dotted subid here. Keitaro subids have
  // no native dashes, so this is lossless for them (see /go).
  const subid = clean.replace(/-/g, '.');
  try {
    await env.DB.prepare("UPDATE users SET kt_subid = ?, source = COALESCE(source, 'keitaro') WHERE user_id = ? AND kt_subid IS NULL")
      .bind(subid, userId).run();
  } catch (e) { /* column may not be migrated yet — degrade */ }
}

// First-touch geo capture. request.cf.country is Cloudflare's ISO-2 for the
// request's client IP. On /checkin the Mini App's fetch comes straight from the
// player's device, so this is the player's country (used to see whether FB
// traffic lands in the targeted geo). Set once (WHERE country IS NULL), never
// overwritten, so a later trip abroad / VPN can't rewrite the acquisition geo.
// Cloudflare uses 'XX'/'T1' for unknown/Tor — treated as no-geo and skipped.
async function captureCountry(env, userId, request) {
  if (!env.DB) return;
  const cc = request && request.cf && request.cf.country;
  if (!cc || !/^[A-Z]{2}$/.test(cc) || cc === 'XX' || cc === 'T1') return;
  try {
    await env.DB.prepare('UPDATE users SET country = ? WHERE user_id = ? AND country IS NULL')
      .bind(cc, userId).run();
  } catch (e) { /* column may not be migrated yet — degrade */ }
}

// GET /go?kt=<subid> — redirect hop placed BEFORE Telegram in the Keitaro offer
// URL. Telegram's start param allows only [A-Za-z0-9_-] (dots are stripped), so
// we encode the Keitaro subid's dots as dashes here; captureAttribution reverses
// it on capture. Keitaro's own click tracking (fbclid etc.) happens before this
// hop, so it's unaffected.
function handleGo(request, env) {
  const url = new URL(request.url);
  const kt = (url.searchParams.get('kt') || '').replace(/\./g, '-'); // dots → dashes
  const safe = kt.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);       // Telegram start-param charset
  const target = safe
    ? `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(safe)}`
    : `https://t.me/${BOT_USERNAME}`;
  return Response.redirect(target, 302);
}

// Server-to-server (S2S) postback to Keitaro so it can fire the conversion back
// to Facebook. Base URL from a Worker var/secret KEITARO_POSTBACK_URL, else the
// D1 config row `keitaro_postback_url`. Appends ?subid=<>&status=<>. Retries once
// on a network error; logs the outcome. Never throws.
// Build the final Keitaro URL from the configured postback URL. Two supported
// shapes: (a) a full URL with a click-id MACRO ({clickid}/{subid}/{sub_id}) that
// we substitute in place (Keitaro's standard postback template — respects any
// status= already in the URL); (b) a bare base URL, to which we append
// ?subid=<>&status=<>. Avoids duplicated params either way.
function buildKeitaroUrl(base, subid, status) {
  const s = encodeURIComponent(subid);
  if (/\{(clickid|subid|sub_id)\}/i.test(base)) {
    let u = base.replace(/\{(clickid|subid|sub_id)\}/ig, s);
    if (!/[?&]status=/i.test(u)) u += (u.includes('?') ? '&' : '?') + 'status=' + encodeURIComponent(status);
    return u;
  }
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}subid=${s}&status=${encodeURIComponent(status)}`;
}

async function sendKeitaroPostback(env, subid, status) {
  const base = (env.KEITARO_POSTBACK_URL && String(env.KEITARO_POSTBACK_URL)) || await getConfigStr(env, 'keitaro_postback_url');
  if (!base) { console.log(`keitaro: postback URL not configured — skipped (subid=${subid}, status=${status})`); return { ok: false, error: 'no_postback_url' }; }
  const url = buildKeitaroUrl(base, subid, status);
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, { method: 'GET' });
      const resp = (await r.text().catch(() => '')).slice(0, 300);
      console.log(`keitaro postback sent (attempt ${attempt}) http=${r.status} subid=${subid} status=${status} resp=${resp}`);
      return { ok: true, http: r.status, resp }; // response received (even non-2xx); don't retry
    } catch (e) {
      lastErr = String(e);
      console.log(`keitaro postback network error (attempt ${attempt}) subid=${subid}: ${lastErr}`);
    }
  }
  return { ok: false, error: 'network', detail: lastErr };
}

// GET /kt-test?key=<ADMIN_KEY>&subid=<x>&status=<lead|sale> — fire a manual
// Keitaro postback so marketing can confirm it lands in Keitaro's postback log,
// without needing a real player. Returns Keitaro's HTTP status + response body.
async function handleKtTest(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  const subid = sanitizeSource(url.searchParams.get('subid') || '') || 'test_subid';
  const status = (url.searchParams.get('status') || 'lead').slice(0, 32);
  const result = await sendKeitaroPostback(env, subid, status);
  return jsonResponse({ ok: !!result.ok, sent: { subid, status }, keitaro: result });
}

// Fire the FIRST_CLICK conversion postback exactly once per user. The conditional
// UPDATE on kt_sent_first_click is the idempotency guard (only the first caller
// flips 0→1 and sends). No kt_subid (organic) → nothing sent.
async function maybeFireKeitaroFirstClick(env, userId) {
  if (!env.DB) return;
  let row;
  try {
    row = await env.DB.prepare('SELECT kt_subid AS s, kt_sent_first_click AS sent FROM users WHERE user_id = ?').bind(userId).first();
  } catch (e) { return; } // columns not migrated yet
  if (!row || !row.s || row.sent) return;
  try {
    const upd = await env.DB.prepare('UPDATE users SET kt_sent_first_click = 1 WHERE user_id = ? AND kt_subid IS NOT NULL AND kt_sent_first_click = 0')
      .bind(userId).run();
    if (!upd.meta || !upd.meta.changes) return; // another request already claimed it
  } catch (e) { return; }
  await sendKeitaroPostback(env, row.s, 'lead');
}

// ---------- Analytics + referral rewards (D1) ----------
const REFEREE_WELCOME_BONUS = 300; // flat starter gift for whoever clicked the link
// Referrer's reward when their invite becomes active: 10 minutes of the
// REFERRER's own current production (their cps × 600s), floored for
// referrers who've barely started. The bigger your empire, the more each
// successful invite is worth.
const REFERRER_BONUS_SECONDS = 600; // 10 min of the referrer's own cps
const REFERRER_BONUS_MIN = 200; // floor, for referrers with ~0 cps so far

// One-time "subscribe to our Telegram channel" bonus. Sized like the referrer
// bonus (cps × minutes, floored) so it stays meaningful across progression, and
// tunable via the D1 `config` table (channel_bonus_chat / _seconds / _min).
// Defaults below are the fallback if those rows are missing.
const CHANNEL_BONUS_CHAT_DEFAULT = '@bestcookieclicker'; // channel to verify membership of
const CHANNEL_BONUS_SECONDS_DEFAULT = 600; // cps × 10 min
const CHANNEL_BONUS_MIN_DEFAULT = 500;     // flat floor for low-cps players
// getChatMember statuses that count as "subscribed".
const CHANNEL_MEMBER_OK = ['member', 'administrator', 'creator'];

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

// Rewarded-ad (AdsGram) grants: smaller windows of the same boosts, verified
// server-side by AdsGram's reward callback. Which boost a given ad grants is
// recorded as a short-lived per-user "intent" (KV) when the client starts the
// ad — one AdsGram block, one reward URL, two possible boosts.
const AD_PROD2X_DURATION_MS = 15 * 60 * 1000; // 15 min of ×2 production (paid: 60 min)
const AD_NOCAP_DURATION_MS = 2 * 3600 * 1000; // 2h of no offline cap (paid: 24h)
// How long an ad "intent" lives. It's ALSO the concurrency lock: a new ad can't
// start while an unconsumed intent exists (handleAdsgramIntent rejects), so the
// TTL bounds how long a stuck intent (ad watched but reward callback never came,
// or an abandoned ad whose cancel failed) blocks the next ad. Kept comfortably
// longer than an ad+callback (seconds) but not the old 10 min.
const AD_INTENT_TTL_S = 180;
const AD_DAILY_LIMIT = 8;                     // rewarded-ad boosts per user per UTC day
// Free, time-gated third path to the click-bypass: this many ad views accumulate
// into the SAME has_click_bypass flag the 100⭐ purchase sets. Views share the
// AD_DAILY_LIMIT with the other ad boosts, so it naturally spans several days.
const AD_CLICK_BYPASS_TARGET = 30;

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
    // One-time channel-subscription bonus (see CHANNEL_BONUS_* defaults).
    channelBonusChat: CHANNEL_BONUS_CHAT_DEFAULT,
    channelBonusSeconds: CHANNEL_BONUS_SECONDS_DEFAULT,
    channelBonusMin: CHANNEL_BONUS_MIN_DEFAULT,
  };
  if (env.DB) {
    try {
      const rows = await env.DB.prepare(
        "SELECT key, value FROM config WHERE key IN ('ref_boost_max', 'ref_boost_tau', 'offline_base_hours', 'offline_max_extra_hours', 'offline_tau', 'ref_event_active', 'ref_event_multiplier', 'ref_event_start', 'ref_event_end', 'channel_bonus_chat', 'channel_bonus_seconds', 'channel_bonus_min')"
      ).all();
      const map = {};
      const rawMap = {};
      for (const r of (rows.results || [])) { map[r.key] = Number(r.value); rawMap[r.key] = r.value; }
      if (Number.isFinite(map.ref_boost_max)) cfg.refBoostMax = map.ref_boost_max;
      if (Number.isFinite(map.ref_boost_tau) && map.ref_boost_tau > 0) cfg.refBoostTau = map.ref_boost_tau;
      if (Number.isFinite(map.offline_base_hours)) cfg.offlineBaseHours = map.offline_base_hours;
      if (Number.isFinite(map.offline_max_extra_hours)) cfg.offlineMaxExtra = map.offline_max_extra_hours;
      if (Number.isFinite(map.offline_tau) && map.offline_tau > 0) cfg.offlineTau = map.offline_tau;
      cfg.refEventActive = map.ref_event_active > 0;
      if (Number.isFinite(map.ref_event_multiplier) && map.ref_event_multiplier > 0) cfg.refEventMultiplier = map.ref_event_multiplier;
      if (Number.isFinite(map.ref_event_start)) cfg.refEventStart = map.ref_event_start;
      if (Number.isFinite(map.ref_event_end)) cfg.refEventEnd = map.ref_event_end;
      if (typeof rawMap.channel_bonus_chat === 'string' && rawMap.channel_bonus_chat.trim()) cfg.channelBonusChat = rawMap.channel_bonus_chat.trim();
      if (Number.isFinite(map.channel_bonus_seconds) && map.channel_bonus_seconds >= 0) cfg.channelBonusSeconds = map.channel_bonus_seconds;
      if (Number.isFinite(map.channel_bonus_min) && map.channel_bonus_min >= 0) cfg.channelBonusMin = map.channel_bonus_min;
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

  const userId = result.user.id;
  await logEvent(env, userId, body.event);
  // Belt-and-suspenders attribution capture (in case /event arrives before any
  // /checkin) — first-touch, no overwrite.
  await captureAttribution(env, userId, result.startParam);
  // Conversion → Keitaro S2S postback. Event agreed with marketing: FIRST_CLICK
  // → status=lead (fired once per user). FIRST_UPGRADE→sale is Part 3, not on yet.
  if (body.event === 'first_click') {
    await maybeFireKeitaroFirstClick(env, userId);
  }
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
      // Only referral codes (refNNN) count as a ref_click — a Keitaro/marketing
      // subid arriving via /start <subid> must NOT pollute the referral funnel.
      if (/^ref\d+$/.test(startParam)) {
        await logEvent(env, userId, 'ref_click', startParam);
      }
      // Capture as a Keitaro click id (first-touch); no-op for referral codes.
      await captureAttribution(env, userId, startParam);
    }
    // Localized welcome reply with the "open game" button (lang from Telegram).
    const lang = langFromCode(msg.from.language_code);
    await sendPush(env, userId, pt(lang, 'start.welcome'), lang);
  } else if (msg && msg.text && msg.from) {
    // Other slash commands (menu is set in BotFather; here are the replies). They
    // work right in the chat — no mini-app needed. `/help@botname` is normalized.
    const cmd = msg.text.trim().split(/\s+/)[0].split('@')[0];
    const userId = msg.from.id;
    if (cmd === '/help' || cmd === '/stats' || cmd === '/top' || cmd === '/invite' || cmd === '/channel') {
      const lang = await getUserLang(env, userId, msg.from.language_code);
      if (cmd === '/help') {
        await sendPush(env, userId, pt(lang, 'cmd.help'), lang); // + "open game" button
      } else if (cmd === '/stats') {
        let m = null;
        try { m = (await env.USERS.getWithMetadata(`user:${userId}`)).metadata; } catch (e) { /* ignore */ }
        if (!m) {
          await sendBotText(env, userId, pt(lang, 'cmd.statsEmpty'));
        } else {
          await sendPush(env, userId, pt(lang, 'cmd.stats', {
            total: fmtBig(m.totalBaked || 0),
            cps: fmtBig(m.cps || 0),
            ascensions: m.prestigeCount || 0,
            friends: m.activeReferrals || 0,
          }), lang);
        }
      } else if (cmd === '/top') {
        const { entries } = await computeLeaderboard(env);
        const top = entries.slice(0, 10);
        if (!top.length) {
          await sendBotText(env, userId, pt(lang, 'cmd.topEmpty'));
        } else {
          const list = top.map((e, i) => `${i + 1}. ${e.name} — ⭐×${e.prestigeCount} — ${fmtBig(e.cps)}`).join('\n');
          await sendPush(env, userId, pt(lang, 'cmd.top', { list }), lang);
        }
      } else if (cmd === '/invite') {
        const link = `https://t.me/${BOT_USERNAME}?start=ref${userId}`;
        await sendBotText(env, userId, pt(lang, 'cmd.invite', { link }));
      } else if (cmd === '/channel') {
        await sendBotText(env, userId, pt(lang, 'cmd.channel', { link: CHANNEL_LINK }));
      }
    }
  }

  return jsonResponse({ ok: true });
}

// Parse the optional time window shared by /funnel and /countries. Returns
// { since, until } in ms epoch (half-open [since, until)), plus a `label` echoed
// in the response. Precedence: explicit from/to (ISO) override period.
//   period = today | 24h | 7d | all   (default 'all' = full history)
//   from/to = arbitrary ISO range (from inclusive → to exclusive; open ends
//             default to 0 / now)
// Bounds are applied to events.ts (funnel stages, ad_view) and to
// users.first_seen_ts (countries, bySource). 'today' uses the UTC day boundary,
// consistent with the rest of the codebase (ads_reward_day, weekId). Returns
// { error } on a malformed value so callers can answer 400. All-time uses a
// far-future upper bound so the ts clause is a no-op — preserving the original
// cumulative behavior when no period is given.
function parsePeriod(url) {
  const now = Date.now();
  const DAY = 86400000;
  const FAR_FUTURE = 8640000000000000; // max representable Date ms
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (from || to) {
    const since = from ? Date.parse(from) : 0;
    const until = to ? Date.parse(to) : now;
    if ((from && !Number.isFinite(since)) || (to && !Number.isFinite(until))) {
      return { error: 'bad_range' };
    }
    return { since, until, label: 'custom' };
  }
  const period = (url.searchParams.get('period') || 'all').toLowerCase();
  if (period === 'all') return { since: 0, until: FAR_FUTURE, label: 'all' };
  if (period === '24h') return { since: now - DAY, until: now, label: '24h' };
  if (period === '7d') return { since: now - 7 * DAY, until: now, label: '7d' };
  if (period === 'today') {
    const d = new Date(now);
    return { since: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), until: now, label: 'today' };
  }
  return { error: 'bad_period' };
}

// GET /funnel?key=<ADMIN_KEY> — distinct-user counts per event, the
// simplest useful view of the funnel. Not a strict sequential-conversion
// funnel yet; good enough to sanity-check the pipeline is capturing data,
// query push/schema.sql's `events` table directly (via `wrangler d1
// execute`) for real funnel/cohort SQL once there's enough data to matter.
// Optional ?period=/from=/to= windows every counter (see parsePeriod).
async function handleFunnel(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  // Optional source filter for traffic-source attribution:
  //   ?source=fb_en   → only users whose first-touch source is 'fb_en'
  //   ?source=organic → only users with NO attributed source (organic)
  //   (absent)        → all users
  const rawSource = url.searchParams.get('source');
  if (rawSource && rawSource !== 'organic' && !sanitizeSource(rawSource)) {
    return jsonResponse({ ok: false, error: 'bad_source' }, 400);
  }
  // Optional time window (see parsePeriod).
  const win = parsePeriod(url);
  if (win.error) return jsonResponse({ ok: false, error: win.error }, 400);
  const { since, until, label } = win;

  // Stages: distinct users per event, windowed by the user's ACQUISITION time
  // (users.first_seen_ts), not the event's own ts. This is an acquisition-cohort
  // funnel — "of users first seen in [since, until), how many reached each
  // stage" — and it's the only windowing that's uniform across stages: app_open
  // (and first_click) are re-logged on activity, so windowing by event ts would
  // make app_open(today) ≈ everyone-active-today instead of acquired-today, and
  // exceed bySource(today). first_seen_ts keys every counter (stages, ad_view,
  // bySource, countries) on the same cohort, so app_open(today) ≤ bySource(today)
  // always holds. period=all covers every user, so all-time counts are unchanged.
  const winClause = 'u.first_seen_ts >= ? AND u.first_seen_ts < ?';
  let stages;
  if (rawSource === 'organic') {
    stages = await env.DB.prepare(
      `SELECT e.event AS event, COUNT(DISTINCT e.user_id) AS users FROM events e JOIN users u ON u.user_id = e.user_id WHERE u.source IS NULL AND ${winClause} GROUP BY e.event ORDER BY users DESC`
    ).bind(since, until).all();
  } else if (rawSource) {
    stages = await env.DB.prepare(
      `SELECT e.event AS event, COUNT(DISTINCT e.user_id) AS users FROM events e JOIN users u ON u.user_id = e.user_id WHERE u.source = ? AND ${winClause} GROUP BY e.event ORDER BY users DESC`
    ).bind(sanitizeSource(rawSource), since, until).all();
  } else {
    stages = await env.DB.prepare(
      `SELECT e.event AS event, COUNT(DISTINCT e.user_id) AS users FROM events e JOIN users u ON u.user_id = e.user_id WHERE ${winClause} GROUP BY e.event ORDER BY users DESC`
    ).bind(since, until).all();
  }

  // Per-source breakdown (attributed users per source + organic), windowed by
  // acquisition time (first_seen_ts) so the marketer sees sizes for the period.
  const bySourceRows = await env.DB.prepare(
    "SELECT COALESCE(source, 'organic') AS source, COUNT(*) AS users FROM users WHERE first_seen_ts >= ? AND first_seen_ts < ? GROUP BY COALESCE(source, 'organic') ORDER BY users DESC"
  ).bind(since, until).all();

  return jsonResponse({
    ok: true,
    source: rawSource || 'all',
    period: label,
    stages: stages.results,
    bySource: bySourceRows.results,
    // Geo breakdown embedded here too (the dashboard reads countries from either
    // /funnel or the dedicated /countries endpoint), windowed by the same period.
    countries: await countriesByFilter(env, rawSource, since, until),
  });
}

// Users per ISO-2 country, with the same optional source filter as /funnel
// ('organic' = no source, '<x>' = that source, absent = all) and windowed by
// acquisition time (users.first_seen_ts within [since, until)). NULL / unknown
// countries are excluded. Degrades to [] if the country column isn't migrated
// yet. Shared by /funnel (embedded) and the dedicated /countries route.
async function countriesByFilter(env, rawSource, since, until) {
  if (!env.DB) return [];
  try {
    if (rawSource === 'organic') {
      const r = await env.DB.prepare(
        'SELECT country, COUNT(*) AS users FROM users WHERE country IS NOT NULL AND source IS NULL AND first_seen_ts >= ? AND first_seen_ts < ? GROUP BY country ORDER BY users DESC'
      ).bind(since, until).all();
      return r.results;
    } else if (rawSource) {
      const source = sanitizeSource(rawSource);
      if (!source) return [];
      const r = await env.DB.prepare(
        'SELECT country, COUNT(*) AS users FROM users WHERE country IS NOT NULL AND source = ? AND first_seen_ts >= ? AND first_seen_ts < ? GROUP BY country ORDER BY users DESC'
      ).bind(source, since, until).all();
      return r.results;
    }
    const r = await env.DB.prepare(
      'SELECT country, COUNT(*) AS users FROM users WHERE country IS NOT NULL AND first_seen_ts >= ? AND first_seen_ts < ? GROUP BY country ORDER BY users DESC'
    ).bind(since, until).all();
    return r.results;
  } catch (e) { return []; } // country column not migrated yet — degrade
}

// GET /countries?key=<ADMIN_KEY>[&source=<x>][&period=…|&from=&to=] — users per
// ISO-2 country, same source-filter + time-window semantics as /funnel. For the
// FB test: confirm traffic actually lands in the targeted geo (and spot junk
// mixed in from other geos), optionally sliced to today / a range.
async function handleCountries(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }
  const rawSource = url.searchParams.get('source');
  if (rawSource && rawSource !== 'organic' && !sanitizeSource(rawSource)) {
    return jsonResponse({ ok: false, error: 'bad_source' }, 400);
  }
  const win = parsePeriod(url);
  if (win.error) return jsonResponse({ ok: false, error: win.error }, 400);
  const countries = await countriesByFilter(env, rawSource, win.since, win.until);
  return jsonResponse({ ok: true, source: rawSource || 'all', period: win.label, countries });
}

// GET /online?key=<ADMIN_KEY> — live activity snapshot from KV metadata (no
// per-user reads). "online" = pinged /checkin in the last 6 min (checkin fires
// every ~4 min while the tab is visible, so 6 min ≈ "in the app right now");
// "day" = DAU (last 24h); "total" = everyone ever registered.
async function handleOnline(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }
  const now = Date.now();
  // Online window must exceed the client checkin cadence (4 min) so an active
  // player never flickers offline between pings.
  const ONLINE_WINDOW = 6 * 60 * 1000;
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
      if (ago <= ONLINE_WINDOW) online++;
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
// POST /claim-channel-bonus { initData } — one-time bonus for subscribing to our
// Telegram channel. Verifies membership via getChatMember (no payment). The
// channel is our own distribution channel, independent of the referral network.
// Idempotent: a flag (channel_bonus_claimed) + a conditional UPDATE mean a repeat
// tap after a successful claim is a no-op, and un-subscribing later never claws
// the bonus back (no background re-checks).
async function handleClaimChannelBonus(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const userId = result.user.id;
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  const now = Date.now();
  try {
    await ensureUser(env, userId, now);
    const row = await env.DB.prepare('SELECT channel_bonus_claimed AS c FROM users WHERE user_id = ?').bind(userId).first();
    if (row && row.c) return jsonResponse({ ok: true, status: 'already_claimed' });
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }

  const cfg = await getEconomyConfig(env);
  const chat = cfg.channelBonusChat;
  if (!chat) return jsonResponse({ ok: true, status: 'not_configured' });

  // Membership check. For a PUBLIC channel getChatMember works with @username;
  // NOTE: in practice the bot usually must be an admin of the channel for this
  // call to see arbitrary members (we make it admin anyway for auto-posting). If
  // the call errors or returns left/kicked, we treat it as "not subscribed" and
  // credit nothing.
  const mem = await tgCall(env, 'getChatMember', { chat_id: chat, user_id: userId });
  const status = mem && mem.ok && mem.result ? mem.result.status : null;
  if (!CHANNEL_MEMBER_OK.includes(status)) {
    return jsonResponse({ ok: true, status: 'not_subscribed' });
  }

  // Subscribed → credit once. cps × minutes, floored (mirrors the referrer
  // bonus). The conditional UPDATE (WHERE channel_bonus_claimed = 0) is the
  // idempotency guard: only the first concurrent tap flips the flag + credits;
  // delivery rides pending_reward on the next /checkin, like referral rewards.
  const cps = await getKnownCps(env, userId);
  const bonus = Math.max(cfg.channelBonusMin, Math.floor(cps * cfg.channelBonusSeconds));
  try {
    const upd = await env.DB.prepare(
      'UPDATE users SET channel_bonus_claimed = 1, pending_reward = pending_reward + ? WHERE user_id = ? AND channel_bonus_claimed = 0'
    ).bind(bonus, userId).run();
    if (!upd.meta || !upd.meta.changes) return jsonResponse({ ok: true, status: 'already_claimed' });
  } catch (e) { return jsonResponse({ ok: false, error: 'db' }, 500); }
  return jsonResponse({ ok: true, status: 'claimed', bonus });
}

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
    } else if (inv.kind === 'upgrade_skip' && inv.upgrade_id) {
      // Per-upgrade paid unlock: append the id to the user's comma-separated set
      // in ONE atomic statement. A read-modify-write here loses updates when two
      // upgrade_skip webhooks for the same user (different upgrade ids, so each
      // passes the per-invoice flip above) race: both read the old list and the
      // second write clobbers the id the first appended -> paid, not delivered.
      // SQLite serializes concurrent single-statement UPDATEs of the same row, so
      // each sees the other's committed value. INSTR (not LIKE — ids contain '_',
      // a LIKE wildcard) does the delimited exact-token dedup, keeping it
      // idempotent across retries too.
      await env.DB.prepare(
        "UPDATE users SET paid_unlocked_upgrades = CASE " +
        "WHEN paid_unlocked_upgrades IS NULL OR paid_unlocked_upgrades = '' THEN ? " +
        "WHEN INSTR(',' || paid_unlocked_upgrades || ',', ',' || ? || ',') > 0 THEN paid_unlocked_upgrades " +
        "ELSE paid_unlocked_upgrades || ',' || ? END " +
        "WHERE user_id = ?"
      ).bind(inv.upgrade_id, inv.upgrade_id, inv.upgrade_id, userId).run();
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
  let adsRewardsUsed = 0; // rewarded-ad boosts already used today (for the client's daily counter)
  let adClickBypassViews = 0; // ad views accumulated toward the free click-bypass unlock
  let channelBonusClaimed = false; // one-time channel-subscription bonus already taken
  if (env.DB) {
    try {
      await logEvent(env, user.id, 'app_open');
      // First-touch attribution: capture the Keitaro click id (?startapp=<subid>)
      // into kt_subid + coarse source 'keitaro' (set once, never overwritten).
      await captureAttribution(env, user.id, result.startParam);
      // First-touch geo: ISO-2 from Cloudflare edge (player's device fetch).
      await captureCountry(env, user.id, request);
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
      const boostRow = await env.DB.prepare('SELECT boost_expires_at AS e, boost2x_expires_at AS e2, has_permanent_production_boost AS perm, has_click_bypass AS clickbypass, prestige_count AS pc, is_prestige_pioneer AS pion, paid_unlocked_upgrades AS pu, ads_reward_day AS ad, ads_reward_count AS ac, ad_click_bypass_views AS abv, channel_bonus_claimed AS chan FROM users WHERE user_id = ?').bind(user.id).first();
      if (boostRow && Number.isFinite(boostRow.e)) boostExpiresAt = boostRow.e;
      if (boostRow && Number.isFinite(boostRow.e2)) boost2xExpiresAt = boostRow.e2;
      if (boostRow && boostRow.perm) hasPermProdBoost = true;
      if (boostRow && boostRow.clickbypass) hasClickBypass = true;
      if (boostRow && Number.isFinite(boostRow.pc)) serverPrestigeCount = boostRow.pc;
      if (boostRow && boostRow.pion) isPrestigePioneer = true;
      if (boostRow) paidUnlockedUpgrades = parseIdList(boostRow.pu);
      if (boostRow && boostRow.ad === Math.floor(now / 86400000)) adsRewardsUsed = boostRow.ac || 0;
      if (boostRow && Number.isFinite(boostRow.abv)) adClickBypassViews = boostRow.abv;
      if (boostRow && boostRow.chan) channelBonusClaimed = true;
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
    activeReferrals,     // current active friends (for the /stats bot command)
    maxActiveFriendsEver,
    weeklyReferrals,      // friends recruited this week (for the weekly board)
    weeklyWeekId: curWeek, // which week weeklyReferrals belongs to (stale => 0 on the board)
    prestigeCount: serverPrestigeCount, // server-authoritative; leaderboard's primary rank key
    isPioneer: isPrestigePioneer,       // "prestige pioneer" title flag
    lifetimeCookies: Number(body.lifetimeCookies) || 0, // never-resetting total across runs (client-sent, like cps)
    crumbs: Number(body.crumbs) || 0,   // permanent bonus % (client-sent, like cps); for the rank-badge tooltip
    // Player language for localized pushes / bot replies. Prefer the client's
    // explicit choice (may be a manual override), else Telegram's language_code.
    lang: (body.lang === 'ru' || body.lang === 'en') ? body.lang : (/^ru/i.test(user.language_code || '') ? 'ru' : 'en'),
  };
  // Mirroring `data` into KV metadata lets list-all operations (leaderboard,
  // the push cron, broadcasts) read every user's fields straight off list()
  // results — no per-key get() needed. That matters a lot: Workers caps the
  // number of subrequests per invocation (50 on the free plan, 1000 on
  // paid), and a get()-per-user loop would blow through that once there are
  // more than a few dozen/thousand registered users, regardless of how many
  // are actually active. list() only costs one subrequest per 1000 keys.
  //
  // Best-effort: this KV write only powers leaderboard / push / online
  // freshness. It must NEVER fail the checkin — a throw here (e.g. KV daily
  // put-limit → 429) would 500 the response, and since pending_reward /
  // pending_paid_cookies were already decremented in D1 above, the client would
  // never receive the reward it just paid for in the DB → silent loss, incl.
  // paid Stars credit. Swallow it: the reward still returns below; only the KV
  // mirror goes stale until the next successful checkin.
  try {
    await env.USERS.put(key, JSON.stringify(data), { metadata: data });
  } catch (e) { console.log('checkin KV put failed (degraded, reward preserved)', e); }

  // Tunable boost curve knobs, so the client's referralBoost() can be
  // retuned server-side without a frontend release.
  const cfg = await getEconomyConfig(env);
  const refConfig = { max: cfg.refBoostMax, tau: cfg.refBoostTau };
  const offlineConfig = { base: cfg.offlineBaseHours, maxExtra: cfg.offlineMaxExtra, tau: cfg.offlineTau };
  const refEvent = refEventActiveNow(cfg, now)
    ? { active: true, multiplier: cfg.refEventMultiplier, endAt: cfg.refEventEnd || 0 }
    : { active: false };

  return jsonResponse({ ok: true, pendingReward, activeReferrals, maxActiveFriendsEver, refConfig, offlineConfig, refEvent, paidOfflineCredit, boostExpiresAt, boost2xExpiresAt, hasPermProdBoost, hasClickBypass, prestigeCount: serverPrestigeCount, isPioneer: isPrestigePioneer, paidUnlockedUpgrades, adsRewardsUsed, adsDailyLimit: AD_DAILY_LIMIT, adClickBypassViews, adClickBypassTarget: AD_CLICK_BYPASS_TARGET, channelBonusClaimed });
}

// Builds the ranked leaderboard from KV metadata (one list() sweep, no per-user
// reads). Shared by the /leaderboard endpoint and the /top bot command so both
// show identical ranking.
async function computeLeaderboard(env) {
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
  return { entries, pioneerLimit };
}

async function handleLeaderboard(env) {
  const { entries, pioneerLimit } = await computeLeaderboard(env);
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

// ---------- i18n for pushes / bot replies ----------
// Player language is stored per-user in KV metadata (data.lang) on checkin, and
// read from Telegram's language_code for the /start reply. ru* → ru, else en.
const PUSH_STRINGS = {
  ru: {
    'push.early': '⏰ Печеньки скоро замедлятся! Ещё 15 минут — и офлайн-скорость выпечки упадёт в 10 раз. Успей зайти, пока печём на полной ставке.',
    'push.piling': '🍪 Твои печеньки скучают без присмотра!{extra} Заходи, пока курсоры не разбежались.',
    'push.pilingExtra': ' Уже накопилось ~{n} 🍪.',
    'push.reward': '🎁 Ежедневная награда уже ждёт тебя в игре — а печеньки всё это время копились. Не заставляй бабушку печь зря!',
    'push.openGame': '🍪 Открыть игру',
    'evt.happyHour': '🎉 Печеньковый час начался! Все печеньки x2 следующий час — заходи скорее.',
    'evt.weekend': '🎊 Печеньковые выходные начались! x1.5 к производству и золотые печеньки падают вдвое чаще — весь уик-энд.',
    'evt.refEvent': '🎉 Событие рефералов! Награда за приглашённых друзей ×{mult}.{tail}',
    'evt.refEventTail': ' Успей позвать друзей!',
    'start.welcome': '🍪 Привет! Это Cookie Clicker — пеки печеньки, прокачивай здания, возносись и зови друзей. Жми кнопку, чтобы начать!',
    'cmd.help': '🍪 Как играть в Cookie Clicker:\n👆 Тапай печеньку — получай печеньки\n🏗 Покупай здания и апгрейды — производство растёт само\n⭐ Когда всё раскуплено — вознесись: сброс прогресса даёт постоянный бонус навсегда\n🤝 Зови друзей — получай бонус к производству за каждого активного\nОткрой игру и начинай печь!',
    'cmd.stats': '📊 Твоя статистика:\n🍪 Всего испечено: {total}\n⚡ Печенек/сек: {cps}\n⭐ Вознесений: {ascensions}\n🤝 Активных друзей: {friends}',
    'cmd.statsEmpty': '📊 Пока нет статистики — открой игру и начни печь печеньки!',
    'cmd.top': '🏆 Топ игроков:\n{list}\nОткрой игру, чтобы увидеть свой ранг!',
    'cmd.topEmpty': '🏆 Топ пока пуст — стань первым! Открой игру и начни печь.',
    'cmd.invite': '🤝 Зови друзей в игру!\nТвоя ссылка: {link}\nТы и друг получите бонус печенек сразу, а с каждым активным другом твоё производство растёт навсегда.',
    'cmd.channel': '📢 Наш канал: {link}\nАнонсы событий, новых уровней и обновлений — всё там.',
  },
  en: {
    'push.early': '⏰ Your cookies are about to slow down! In 15 minutes your offline baking rate drops 10×. Hop in while we’re still baking at full speed.',
    'push.piling': '🍪 Your cookies miss you!{extra} Come back before the cursors wander off.',
    'push.pilingExtra': ' ~{n} 🍪 already piled up.',
    'push.reward': '🎁 Your daily reward is waiting in the game — and cookies have been piling up. Don’t let grandma bake for nothing!',
    'push.openGame': '🍪 Open game',
    'evt.happyHour': '🎉 Cookie Hour has started! All cookies ×2 for the next hour — jump in!',
    'evt.weekend': '🎊 Cookie Weekend has started! ×1.5 production and golden cookies twice as often — all weekend.',
    'evt.refEvent': '🎉 Referral event! Reward for invited friends ×{mult}.{tail}',
    'evt.refEventTail': ' Invite friends now!',
    'start.welcome': '🍪 Hi! This is Cookie Clicker — bake cookies, upgrade buildings, ascend, and invite friends. Tap the button to start!',
    'cmd.help': "🍪 How to play Cookie Clicker:\n👆 Tap the cookie to earn cookies\n🏗 Buy buildings and upgrades — production grows on its own\n⭐ Once everything's bought — ascend: resetting gives a permanent bonus forever\n🤝 Invite friends — get a production boost for each active friend\nOpen the game and start baking!",
    'cmd.stats': '📊 Your stats:\n🍪 Total baked: {total}\n⚡ Cookies/sec: {cps}\n⭐ Ascensions: {ascensions}\n🤝 Active friends: {friends}',
    'cmd.statsEmpty': '📊 No stats yet — open the game and start baking cookies!',
    'cmd.top': '🏆 Leaderboard:\n{list}\nOpen the game to see your rank!',
    'cmd.topEmpty': '🏆 The leaderboard is empty — be the first! Open the game and start baking.',
    'cmd.invite': '🤝 Invite friends to play!\nYour link: {link}\nYou and your friend both get an instant cookie bonus, and each active friend permanently boosts your production.',
    'cmd.channel': '📢 Our channel: {link}\nEvent announcements, new levels and updates — all there.',
  },
};
function pt(lang, key, vars) {
  const table = PUSH_STRINGS[lang === 'ru' ? 'ru' : 'en'] || PUSH_STRINGS.en;
  let s = table[key];
  if (s == null) s = PUSH_STRINGS.en[key];
  if (s == null) return key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
function langFromCode(code) { return /^ru/i.test(code || '') ? 'ru' : 'en'; }

// A user's saved language for bot replies: prefer their stored KV metadata lang
// (same source the pushes use), else fall back to Telegram's language_code.
async function getUserLang(env, userId, code) {
  try {
    const { metadata } = await env.USERS.getWithMetadata(`user:${userId}`);
    if (metadata && (metadata.lang === 'ru' || metadata.lang === 'en')) return metadata.lang;
  } catch (e) { /* ignore */ }
  return langFromCode(code);
}

// Compact big-number format for bot text (1200000000000 → "1.20T"). Suffix scale
// mirrors the client's formatNum enough to read consistently.
const BIG_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
function fmtBig(n) {
  n = Number(n) || 0;
  if (!isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) return sign + (Number.isInteger(n) ? String(n) : n.toFixed(1));
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= BIG_SUFFIXES.length) tier = BIG_SUFFIXES.length - 1;
  const scaled = n / Math.pow(10, tier * 3);
  return sign + scaled.toFixed(2) + BIG_SUFFIXES[tier];
}

// Plain-text bot reply (no game button). URLs auto-link in Telegram.
async function sendBotText(env, chatId, text) {
  await tgCall(env, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
}

function stageEarlyText(lang) {
  return pt(lang, 'push.early');
}

function stagePilingText(data) {
  const approxCookies = Math.round(computeOfflineGain(STAGE_PILING_MS / 1000, data.cps || 0));
  const extra = approxCookies > 0 ? pt(data.lang, 'push.pilingExtra', { n: approxCookies }) : '';
  return pt(data.lang, 'push.piling', { extra });
}

function stageRewardText(lang) {
  return pt(lang, 'push.reward');
}

async function sendPush(env, chatId, text, lang) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: pt(lang, 'push.openGame'), web_app: { url: GAME_URL } }]],
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
        await sendPush(env, data.chatId, stageEarlyText(data.lang), data.lang);
        data.pushStage = 1;
        await env.USERS.put(k.name, JSON.stringify(data), { metadata: data });
      } else if (data.pushStage < 2 && elapsed >= STAGE_PILING_MS) {
        await sendPush(env, data.chatId, stagePilingText(data), data.lang);
        data.pushStage = 2;
        await env.USERS.put(k.name, JSON.stringify(data), { metadata: data });
      } else if (data.pushStage < 3 && elapsed >= STAGE_REWARD_MS) {
        await sendPush(env, data.chatId, stageRewardText(data.lang), data.lang);
        data.pushStage = 3;
        await env.USERS.put(k.name, JSON.stringify(data), { metadata: data });
      }
    }
    if (list.list_complete || !list.cursor) break;
    cursor = list.cursor;
  }
}

// buildText(lang) → localized message, so each user gets it in their own
// language (data.lang from KV metadata). One list() sweep, no per-user reads.
async function broadcastToAllUsers(env, buildText) {
  let cursor;
  for (;;) {
    const list = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of list.keys) {
      const data = k.metadata;
      if (data && data.chatId) {
        const lang = data.lang || 'en';
        await sendPush(env, data.chatId, buildText(lang), lang);
      }
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
    await broadcastToAllUsers(env, (lang) => pt(lang, ev.msgKey));
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
      await broadcastToAllUsers(env, (lang) => pt(lang, 'evt.refEvent', {
        mult: cfg.refEventMultiplier,
        tail: cfg.refEventEnd ? pt(lang, 'evt.refEventTail') : '',
      }));
    }
  }
}

// ---------- Rewarded ads (AdsGram) ----------
// Client records which boost the about-to-be-watched ad grants (authenticated
// by initData). Stored briefly in KV; AdsGram's reward callback consumes it.
async function handleAdsgramIntent(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  const type = (body.type === 'nocap' || body.type === 'boost2x' || body.type === 'click_bypass_progress') ? body.type : null;
  if (!type) return jsonResponse({ ok: false, error: 'bad_type' }, 400);
  const uid = result.user.id;
  // Concurrency guard (fixes the "lost view" race): only ONE ad may be in flight
  // per user. If an unconsumed intent already exists, refuse to overwrite it —
  // otherwise a second ad started before the first's reward callback arrives
  // would clobber the first intent (first callback grants the wrong type; the
  // second finds no intent and grants nothing → the view is silently lost).
  const existing = await env.USERS.get(`adsintent:${uid}`);
  if (existing) {
    console.log(`adsintent REJECT (in_progress) uid=${uid} want=${type} existing=${existing}`);
    return jsonResponse({ ok: false, error: 'ad_in_progress' }, 409);
  }
  await env.USERS.put(`adsintent:${uid}`, type, { expirationTtl: AD_INTENT_TTL_S });
  console.log(`adsintent SET uid=${uid} type=${type}`);
  return jsonResponse({ ok: true });
}

// POST /adsgram-cancel { initData } — clear this user's pending ad intent when
// they closed/abandoned the ad without completing it (no reward callback will
// come), so the next ad isn't blocked by the concurrency guard until TTL.
async function handleAdsgramCancel(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }
  const result = await validateInitData(body.initData || '', env.BOT_TOKEN);
  if (!result) return jsonResponse({ ok: false, error: 'invalid_init_data' }, 401);
  await env.USERS.delete(`adsintent:${result.user.id}`);
  console.log(`adsintent CANCEL uid=${result.user.id}`);
  return jsonResponse({ ok: true });
}

// GET /adsgram-reward?userid=<id>&secret=<s> — called server-to-server by
// AdsGram once the user actually finished watching. This is our proof-of-view,
// so the boost is granted here (never trust the client for the grant itself).
async function handleAdsgramReward(request, env) {
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get('userid'));
  const secret = url.searchParams.get('secret') || '';
  // Secret gate: only AdsGram knows it. Mismatch/absent → ignore, accrue nothing.
  if (!env.ADSGRAM_REWARD_SECRET || secret !== env.ADSGRAM_REWARD_SECRET) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }
  if (!Number.isFinite(userId) || userId <= 0) return jsonResponse({ ok: false, error: 'bad_user' }, 400);
  if (!env.DB) return jsonResponse({ ok: false, error: 'no_db' }, 500);

  // The intent (set by the client when it started the ad) both selects the
  // boost and acts as a one-shot idempotency guard: consumed on first grant, so
  // an AdsGram retry finds no intent and does not double-grant.
  const type = await env.USERS.get(`adsintent:${userId}`);
  if (type !== 'nocap' && type !== 'boost2x' && type !== 'click_bypass_progress') {
    console.log(`adsreward NO_INTENT uid=${userId} (expired or already consumed)`);
    return jsonResponse({ ok: false, error: 'no_intent' }); // expired or already consumed
  }
  const now = Date.now();
  const today = Math.floor(now / 86400000); // UTC day number (same trick as the weekly board)

  await ensureUser(env, userId, now);
  const row = await env.DB.prepare('SELECT ads_reward_day AS d, ads_reward_count AS c, boost_expires_at AS e, boost2x_expires_at AS e2, ad_click_bypass_views AS abv, has_click_bypass AS hcb FROM users WHERE user_id = ?').bind(userId).first();
  const count = (row && row.d === today) ? (row.c || 0) : 0; // reset on UTC-day boundary
  if (count >= AD_DAILY_LIMIT) {
    console.log(`adsreward DAILY_LIMIT uid=${userId} type=${type} count=${count}`);
    return jsonResponse({ ok: false, error: 'daily_limit', limit: AD_DAILY_LIMIT });
  }
  console.log(`adsreward GRANT uid=${userId} type=${type} count ${count}->${count + 1}`);

  // Funnel signal: one 'ad_view' row per user (first confirmed rewarded view).
  // We're past the secret + intent + daily-limit gates, so a real view happened.
  // /funnel counts DISTINCT users per event, so a single row per user is exactly
  // "users who watched >=1 rewarded ad"; logging once keeps the table lean and
  // avoids re-deriving d1_return/ref stages that full logEvent() would. Wrapped
  // so analytics can never break the reward grant.
  try {
    await env.DB.prepare(
      "INSERT INTO events (user_id, event, ts) SELECT ?, 'ad_view', ? WHERE NOT EXISTS (SELECT 1 FROM events WHERE user_id = ? AND event = 'ad_view')"
    ).bind(userId, now, userId).run();
  } catch (e) { /* analytics must never block the reward */ }

  // Accumulating path: each view is +1 toward AD_CLICK_BYPASS_TARGET; the target
  // sets the SAME has_click_bypass flag the Stars purchase sets. Idempotent past
  // the target (views capped, flag never downgraded) — extra views can't corrupt.
  if (type === 'click_bypass_progress') {
    if (row && row.hcb) {
      // Already unlocked (via ads earlier or via Stars). Nothing to grant — consume
      // the intent, and don't spend a daily slot on a no-op.
      await env.USERS.delete(`adsintent:${userId}`);
      return jsonResponse({ ok: true, granted: type, views: AD_CLICK_BYPASS_TARGET, target: AD_CLICK_BYPASS_TARGET, unlocked: true });
    }
    const views = Math.min(((row && row.abv) || 0) + 1, AD_CLICK_BYPASS_TARGET);
    const unlocked = views >= AD_CLICK_BYPASS_TARGET;
    // MAX() guards against ever downgrading a flag a concurrent Stars purchase set.
    await env.DB.prepare('UPDATE users SET ad_click_bypass_views = ?, has_click_bypass = MAX(has_click_bypass, ?), ads_reward_day = ?, ads_reward_count = ? WHERE user_id = ?')
      .bind(views, unlocked ? 1 : 0, today, count + 1, userId).run();
    await env.USERS.delete(`adsintent:${userId}`); // consume (idempotency)
    return jsonResponse({ ok: true, granted: type, views, target: AD_CLICK_BYPASS_TARGET, unlocked, count: count + 1, limit: AD_DAILY_LIMIT });
  }

  // Extend the matching boost from max(current expiry, now) — same as Stars boosts.
  const col = type === 'nocap' ? 'boost_expires_at' : 'boost2x_expires_at';
  const dur = type === 'nocap' ? AD_NOCAP_DURATION_MS : AD_PROD2X_DURATION_MS;
  const curExp = type === 'nocap' ? (row && row.e) : (row && row.e2);
  const base = Math.max(Number.isFinite(curExp) ? curExp : 0, now);
  await env.DB.prepare(`UPDATE users SET ${col} = ?, ads_reward_day = ?, ads_reward_count = ? WHERE user_id = ?`)
    .bind(base + dur, today, count + 1, userId).run();
  await env.USERS.delete(`adsintent:${userId}`); // consume (idempotency)
  return jsonResponse({ ok: true, granted: type, count: count + 1, limit: AD_DAILY_LIMIT });
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

    if (url.pathname === '/adsgram-intent' && request.method === 'POST') {
      return handleAdsgramIntent(request, env);
    }

    if (url.pathname === '/adsgram-cancel' && request.method === 'POST') {
      return handleAdsgramCancel(request, env);
    }

    if (url.pathname === '/go' && request.method === 'GET') {
      return handleGo(request, env);
    }

    if (url.pathname === '/adsgram-reward' && request.method === 'GET') {
      return handleAdsgramReward(request, env);
    }

    if (url.pathname === '/telegram-webhook' && request.method === 'POST') {
      return handleTelegramWebhook(request, env);
    }

    if (url.pathname === '/funnel' && request.method === 'GET') {
      return handleFunnel(request, env);
    }

    if (url.pathname === '/countries' && request.method === 'GET') {
      return handleCountries(request, env);
    }

    if (url.pathname === '/online' && request.method === 'GET') {
      return handleOnline(request, env);
    }

    if (url.pathname === '/kt-test' && request.method === 'GET') {
      return handleKtTest(request, env);
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

    if (url.pathname === '/claim-channel-bonus' && request.method === 'POST') {
      return handleClaimChannelBonus(request, env);
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([runPushCycle(env), checkAndBroadcastEvents(env)]));
  },
};
