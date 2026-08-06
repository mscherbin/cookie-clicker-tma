-- ============================================================================
-- SMM worker schema. Apply to the SAME D1 as the game worker
-- (cookie-clicker-analytics) — this worker shares its `config` table and owns
-- `scheduled_posts`. The `config` table itself is created by the game worker's
-- schema; here we only add the two SMM config rows (INSERT OR IGNORE, so it's
-- safe to run against the existing prod DB).
--
--   wrangler d1 execute cookie-clicker-analytics --remote --file=schema.sql
--
-- (If you instead point wrangler.toml at a fresh, separate database, uncomment
-- the CREATE TABLE config block below so this file is self-contained.)
-- ============================================================================

-- Queue of scheduled posts. status flow: pending -> sending -> sent | failed;
-- canceled is a terminal state set by /admin/cancel-post. The cron publishes
-- any 'pending' row whose publish_at has passed to config.channel_id via the
-- bot (which must be an ADMIN of that channel with "post messages" rights).
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publish_at INTEGER NOT NULL,            -- ms epoch: when to publish
  text TEXT NOT NULL,                     -- message body (parsed per parse_mode)
  parse_mode TEXT NOT NULL DEFAULT 'HTML',
  button_text TEXT,                       -- optional inline URL-button label
  button_url TEXT,                        -- optional inline URL-button target (t.me deep link)
  disable_preview INTEGER NOT NULL DEFAULT 1,
  channel TEXT,                           -- per-post target channel (@handle or -100… id); NULL => config.channel_id (EN default)
  image TEXT,                             -- optional public photo URL; if set, post goes out as sendPhoto (text becomes the caption)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sending | sent | failed | canceled
  tg_message_id INTEGER,                  -- message_id returned by Telegram after a send
  error TEXT,                             -- last error payload if a send failed
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
-- The cron's hot query is "pending posts whose time has come", oldest first.
CREATE INDEX IF NOT EXISTS idx_sched_posts_due ON scheduled_posts(status, publish_at);

-- MIGRATION for an already-provisioned DB (the `channel` column was added later,
-- to support posting to more than one channel — e.g. the RU channel alongside
-- the EN default). SQLite has no "ADD COLUMN IF NOT EXISTS", so run this once;
-- if the column already exists it errors harmlessly ("duplicate column name"):
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE scheduled_posts ADD COLUMN channel TEXT"
-- Later addition — image (photo URL) support (sendPhoto). Run once:
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "ALTER TABLE scheduled_posts ADD COLUMN image TEXT"

-- If using a SEPARATE database (not the shared one), uncomment:
-- CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Channel auto-posting config: the target channel (@username or -100… numeric
-- id) and a master on/off switch. Safe defaults: empty channel + disabled, so
-- NOTHING posts until both are set. To go live once the bot is an admin of the
-- channel:
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "UPDATE config SET value='@your_channel' WHERE key='channel_id'"
--   wrangler d1 execute cookie-clicker-analytics --remote \
--     --command "UPDATE config SET value='1' WHERE key='autopost_enabled'"
INSERT OR IGNORE INTO config (key, value) VALUES
  ('channel_id', ''),
  ('autopost_enabled', '0');
