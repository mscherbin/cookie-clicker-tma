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
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  referrer_id INTEGER,
  first_seen_ts INTEGER NOT NULL,
  pending_reward REAL NOT NULL DEFAULT 0,
  max_active_friends_ever INTEGER NOT NULL DEFAULT 0,
  weekly_baseline INTEGER NOT NULL DEFAULT 0,
  weekly_week_id INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

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
  ('offline_tau', '35');
