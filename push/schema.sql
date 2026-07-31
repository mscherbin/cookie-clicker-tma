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
  boost2x_expires_at INTEGER NOT NULL DEFAULT 0
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
  kind TEXT NOT NULL DEFAULT 'offline_2x'
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
  ('ref_event_end', '0');
