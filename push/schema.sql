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
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  referrer_id INTEGER,
  first_seen_ts INTEGER NOT NULL,
  pending_reward REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

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
