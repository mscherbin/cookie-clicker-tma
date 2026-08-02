CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  ref_code TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_user_event ON events(user_id, event);

-- One row per user who has ever triggered any event (created lazily by
-- ensureUser() in the worker). referrer_id is set at most once, only when
-- the referrer is a known real user and isn't the referee themselves.
-- pending_reward accumulates cookies owed to this user (as referrer or as
-- referee) until their next /checkin claims and zeroes it out.
-- max_active_friends_ever: peak "cookie army" size the user has ever reached,
-- updated as MAX(old, current) on every /checkin. Referral titles are derived
-- from this high-water mark, not the live count — so a title never regresses
-- if an invited friend later goes inactive.
-- weekly_baseline / weekly_week_id: snapshot for the weekly referral
-- leaderboard. At the first checkin of a new ISO-week (Monday-anchored, UTC),
-- weekly_baseline is rebased to the user's current max_active_friends_ever and
-- weekly_week_id set to that week. Weekly score = max_active_friends_ever −
-- weekly_baseline (friends recruited THIS week). This is the "snapshot" that
-- makes weekly reset correctly without a cron.
-- pending_paid_cookies: cookies bought with Telegram Stars (the "2x offline"
-- boost), credited by the successful_payment webhook and delivered — then
-- zeroed — on the user's next /checkin, same claim-on-checkin channel as
-- pending_reward.
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  referrer_id INTEGER,
  first_seen_ts INTEGER NOT NULL,
  pending_reward REAL NOT NULL DEFAULT 0,
  max_active_friends_ever INTEGER NOT NULL DEFAULT 0,
  weekly_baseline INTEGER NOT NULL DEFAULT 0,
  weekly_week_id INTEGER NOT NULL DEFAULT 0,
  pending_paid_cookies REAL NOT NULL DEFAULT 0,
  -- boost_expires_at: ms epoch until which the paid "no offline cap" boost is
  -- active. Set/extended only by the successful_payment webhook; the client
  -- reads it (via /checkin) to compute offline income and show the timer.
  boost_expires_at INTEGER NOT NULL DEFAULT 0,
  -- boost2x_expires_at: ms epoch until which the paid "x2 production for 1h"
  -- boost is active. Same webhook-only, extend-not-overwrite semantics.
  boost2x_expires_at INTEGER NOT NULL DEFAULT 0,
  -- has_permanent_production_boost: one-time paid "+10% forever". Set once by
  -- the webhook; the invoice endpoint refuses to sell it twice (checked BEFORE
  -- createInvoiceLink) so the user is never charged again for what they own.
  has_permanent_production_boost INTEGER NOT NULL DEFAULT 0,
  -- has_click_bypass: one-time paid "skip the clicker" — removes the click-count
  -- requirement on click upgrades (applied client-side). Same one-time,
  -- refuse-if-owned semantics as has_permanent_production_boost.
  has_click_bypass INTEGER NOT NULL DEFAULT 0,
  -- prestige_count: server-authoritative number of prestiges (ascensions). The
  -- ONLY way it grows is POST /prestige/confirm (never synced up from client
  -- state), so it's trustworthy as the leaderboard's primary rank key even
  -- though the rest of the balance is still client-side.
  prestige_count INTEGER NOT NULL DEFAULT 0,
  -- last_prestige_at: ms epoch of the last confirmed prestige. Anti-farm: a new
  -- /prestige/confirm is refused if too little time / activity has passed since.
  last_prestige_at INTEGER NOT NULL DEFAULT 0,
  -- is_prestige_pioneer: 1 if this user was among the first `pioneer_limit`
  -- players to reach their 1st prestige (see config). Set once, never cleared.
  is_prestige_pioneer INTEGER NOT NULL DEFAULT 0,
  -- paid_unlocked_upgrades: comma-separated upgrade ids whose progress gate was
  -- skipped via a paid Stars purchase (per-upgrade). Applied client-side; the
  -- server owns the list. Only ids in UPGRADE_SKIP_PRICES can end up here.
  paid_unlocked_upgrades TEXT NOT NULL DEFAULT '',
  -- ad_click_bypass_views: free, time-gated third path to has_click_bypass —
  -- AD_CLICK_BYPASS_TARGET (30) ad views accumulate here and, at the target, set
  -- the SAME has_click_bypass flag the 100⭐ purchase sets. Views share the
  -- rewarded-ad daily limit (ads_reward_count). Server-authoritative.
  ad_click_bypass_views INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

-- Telegram Stars invoices for the "2x offline income" boost. Created (status
-- 'pending') when the client taps the paid button, with `amount` = the offline
-- earnings FROZEN at that moment. On successful_payment it flips to 'paid' and
-- credits amount*2. charge_id (telegram_payment_charge_id) is the idempotency
-- key: a repeated webhook for the same charge_id is ignored.
-- kind: which boost this invoice buys — 'offline_2x' (credits amount*2 cookies)
-- or 'nocap_24h' (extends users.boost_expires_at by 24h; amount is unused/0).
CREATE TABLE IF NOT EXISTS star_invoices (
  invoice_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  charge_id TEXT,
  created_ts INTEGER NOT NULL,
  paid_ts INTEGER,
  kind TEXT NOT NULL DEFAULT 'offline_2x',
  -- upgrade_id: for kind='upgrade_skip', which upgrade this invoice unlocks.
  upgrade_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_star_invoices_charge ON star_invoices(charge_id);

-- Refund events, logged for manual review only. We deliberately do NOT claw
-- back cookies (the game currency may already be spent, and rolling it back
-- retroactively is unreliable) — repeated abuse is handled by manual ban.
CREATE TABLE IF NOT EXISTS refunds (
  charge_id TEXT PRIMARY KEY,
  user_id INTEGER,
  amount REAL,
  ts INTEGER NOT NULL
);

-- NOTE for an ALREADY-DEPLOYED database: CREATE TABLE IF NOT EXISTS above will
-- NOT add new columns to a users table that already exists. Run these ONCE
-- against prod (NOT idempotent — a "duplicate column" error just means it's
-- already applied). The worker degrades gracefully until then (all the reads
-- are in a try/catch).
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN max_active_friends_ever INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN weekly_baseline INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN weekly_week_id INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN pending_paid_cookies REAL NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN boost_expires_at INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE star_invoices ADD COLUMN kind TEXT NOT NULL DEFAULT 'offline_2x'"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN boost2x_expires_at INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN has_permanent_production_boost INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN has_click_bypass INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN prestige_count INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN last_prestige_at INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN is_prestige_pioneer INTEGER NOT NULL DEFAULT 0"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE users ADD COLUMN paid_unlocked_upgrades TEXT NOT NULL DEFAULT ''"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE star_invoices ADD COLUMN upgrade_id TEXT"
-- And seed the pioneer config rows (idempotent):
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "INSERT OR IGNORE INTO config (key, value) VALUES ('pioneer_limit','50'),('pioneer_granted','0'),('pioneer_deadline_ts','0')"
-- (The star_invoices / refunds tables are created by re-running schema.sql —
--  CREATE TABLE IF NOT EXISTS is idempotent, no ALTER needed for those.)

-- Tunable economy knobs, editable without a code release. Read by the worker
-- (short-lived in-memory cache) and handed to clients on /checkin. Seed the
-- cookie-army boost curve; missing rows fall back to worker/client defaults.
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES
  ('ref_boost_max', '1.0'),
  ('ref_boost_tau', '25'),
  ('offline_base_hours', '2'),
  ('offline_max_extra_hours', '8'),
  ('offline_tau', '35'),
  -- Referral boost event, toggled manually before traffic pushes.
  -- ref_event_active: 1 to arm; ref_event_multiplier: e.g. 3 for x3 Layer-1
  -- reward; start/end: ms epoch window (0 = open-ended). Active when armed AND
  -- inside the window AND multiplier > 1.
  ('ref_event_active', '0'),
  ('ref_event_multiplier', '1'),
  ('ref_event_start', '0'),
  ('ref_event_end', '0'),
  -- Prestige "pioneer" title: granted to the first `pioneer_limit` players to
  -- reach their 1st prestige. `pioneer_granted` counts how many were handed out;
  -- `pioneer_deadline_ts` (ms epoch, 0 = no deadline) optionally closes the
  -- window by time as well. Not re-granted once the window is closed.
  ('pioneer_limit', '50'),
  ('pioneer_granted', '0'),
  ('pioneer_deadline_ts', '0');

-- Rewarded ads (AdsGram, Task #25). Per-user daily counter of ad-granted boosts;
-- resets on the UTC-day boundary (ads_reward_day = floor(now_ms / 86400000)).
-- Migration for the existing prod DB (run once each):
--   ALTER TABLE users ADD COLUMN ads_reward_day INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE users ADD COLUMN ads_reward_count INTEGER NOT NULL DEFAULT 0;
-- Free ad-view path to the click-bypass (30 views = has_click_bypass). Migration:
--   ALTER TABLE users ADD COLUMN ad_click_bypass_views INTEGER NOT NULL DEFAULT 0;
-- Secret for the reward callback lives in a Worker secret, not here:
--   wrangler secret put ADSGRAM_REWARD_SECRET

-- NOTE: Channel auto-posting (SMM) lives in a SEPARATE worker — see ../smm
-- (its own wrangler.toml + schema.sql). The scheduled_posts table and the
-- channel_id / autopost_enabled config rows are defined there, not here.
