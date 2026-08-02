# Cookie Clicker — SMM worker (channel auto-posting)

Standalone Cloudflare Worker that schedules and publishes posts to a Telegram
channel as the bot. **Fully separate from the game** (`../push`): its own
`wrangler.toml`, its own cron, no webhook, no game logic. Deploy it independently
— touching this never risks the game worker and vice versa.

## What it shares with the game worker

- **`BOT_TOKEN`** (secret) — posts as `@bestcookieclickerbot`. The bot must be an
  **admin of the channel** with "post messages" rights.
- **D1 `cookie-clicker-analytics`** (binding `DB`) — reads the shared `config`
  table (`channel_id`, `autopost_enabled`) and owns `scheduled_posts`.
  (You may instead point `wrangler.toml` at a separate DB — see `schema.sql`.)
- **`ADMIN_KEY`** (secret) — gates every `/admin/*` endpoint.

Nothing posts until `channel_id` is set **and** `autopost_enabled = '1'`
(safe default: off).

## Endpoints (all `/admin/*` require `?key=<ADMIN_KEY>`)

- `GET  /health` — liveness check (no key).
- `POST /admin/schedule-post` — enqueue one/many posts. Body: a post object,
  `{ post: {...} }`, or `{ posts: [...] }`. Post fields:
  `{ publish_at?: msEpoch, publish_in_minutes?: n, text, parse_mode?='HTML',
  button_text?, button_url?, disable_preview?=true }`.
- `GET  /admin/posts[&status=pending|sent|failed|canceled|all][&limit=n]` — queue view.
- `POST /admin/post-now` — send one post immediately (smoke test for channel admin rights).
- `POST /admin/cancel-post` — body `{ id }` — cancel a still-pending post.

## Go-live checklist

1. Create the channel; add `@bestcookieclickerbot` as admin with "post messages".
2. Set secrets on this worker:
   ```bash
   cd smm
   wrangler secret put BOT_TOKEN   # same token as the game worker
   wrangler secret put ADMIN_KEY   # same value as the game worker's ADMIN_KEY
   ```
3. Apply the schema (shares the game's DB):
   ```bash
   wrangler d1 execute cookie-clicker-analytics --remote --file=schema.sql
   ```
4. Deploy:
   ```bash
   wrangler deploy
   ```
5. Point at the channel and arm:
   ```bash
   wrangler d1 execute cookie-clicker-analytics --remote \
     --command "UPDATE config SET value='@your_channel' WHERE key='channel_id'"
   wrangler d1 execute cookie-clicker-analytics --remote \
     --command "UPDATE config SET value='1' WHERE key='autopost_enabled'"
   ```
6. Smoke test, then seed the plan:
   ```bash
   ADMIN_KEY=xxxx WORKER_URL=https://cookie-clicker-tma-smm.<subdomain>.workers.dev \
     node marketing/seed-posts.mjs
   ```

## Content

`marketing/` holds the content plan (`posts.json`), the seed script
(`seed-posts.mjs`), and its own notes. `seed-posts.mjs` reads `ADMIN_KEY` /
`WORKER_URL` from env (no secrets in the repo); its default `WORKER_URL` points
at this SMM worker.
