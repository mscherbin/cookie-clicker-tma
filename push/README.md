# Push worker

Cloudflare Worker that sends retention push notifications for the Cookie
Clicker mini app:

- Per-user inactivity nudges, three stages: "cookies about to slow down"
  ~15min before the 2h full-rate offline window runs out (motivation peaks
  right before the slowdown, not after), "cookies piling up" ~5h after the
  player was last active, and "daily reward is waiting" at 24h. Never sends
  more than one push per inactivity cycle — checking in (opening the app)
  resets it.
- Broadcast event announcements: when Happy Hour or the Weekend event starts
  (schedule defined in `game.js` and duplicated here), every known user gets
  a one-time "event started" push — regardless of their own activity.

## One-time setup

```bash
npm install -g wrangler
cd push
wrangler login
```

Create the KV namespace that stores per-user last-active state:

```bash
wrangler kv namespace create USERS
```

This prints an `id`. Paste it into `wrangler.toml` replacing
`REPLACE_WITH_KV_NAMESPACE_ID`.

Set the bot token as a secret (never put it in a file — this prompts and
stores it securely in Cloudflare, not in git):

```bash
wrangler secret put BOT_TOKEN
```

Paste the token you got from @BotFather when prompted.

## Deploy

```bash
wrangler deploy
```

This prints your Worker's URL, something like:

```
https://cookie-clicker-tma-push.<your-subdomain>.workers.dev
```

The check-in endpoint is `<that URL>/checkin` — put it into `game.js` as
`CHECKIN_URL` (see the comment there) and redeploy the site.

## How it works

- `POST /checkin` — the mini app calls this on every load, sending Telegram's
  signed `initData` plus the player's current CPS and daily-claim timestamp.
  The Worker verifies the signature (so this can't be spoofed), then stores
  `{ chatId, lastActiveTs, pushStage: 0, cps, lastDailyClaim }` in KV keyed by
  user id. `pushStage: 0` means "no nag sent yet this cycle."
- `scheduled()` — runs every 15 minutes (see `crons` in `wrangler.toml`). For
  every stored user, checks elapsed time since `lastActiveTs`:
  - `>= 1h45m` and `pushStage < 1` → sends the "cookies about to slow down"
    message (15min before the 2h full-rate offline window in game.js runs
    out), stamps `pushStage = 1`.
  - `>= 5h` and `pushStage < 2` → sends the "cookies piling up" message,
    stamps `pushStage = 2`.
  - `>= 24h` and `pushStage < 3` → sends the "daily reward is waiting"
    message, stamps `pushStage = 3`.
  - None of these fire again until the player reopens the app (which resets
    `pushStage` back to 0 via `/checkin`).
  - Also checks whether Happy Hour (06:00–07:00 and 18:00–19:00 UTC, twice a
    day) or the Weekend event (Sat 00:00 UTC – Mon 00:00 UTC) just became
    active. If so, and it hasn't already announced this specific occurrence
    (tracked via an `eventflag:<id>:<date>[-hour]` KV marker with a 5-day
    TTL), it broadcasts to every `user:*` entry in KV.

## Analytics + referral rewards

Uses a Cloudflare D1 database (`events` + `users` tables — see `schema.sql`)
instead of a third-party tool, so no extra account and funnel/cohort queries
are just SQL against data you already control.

`events` is the append-only funnel log. `users` is one row per user (created
lazily the first time they trigger any event) holding `referrer_id` and
`pending_reward`:

- `referrer_id` is set **once**, at the user's first `ref_install`, parsed
  from their `ref_click`'s `ref_code` (format `ref<inviterUserId>`, from the
  "Пригласить друга" button's deep link) — and only if that inviter id
  already exists as a real user in `users` (blocks `/start ref999999999`
  with a made-up id) and isn't the user's own id (blocks self-referral).
- `pending_reward` accumulates cookies owed to a user — as a referrer
  (~1.5h of their own last-known cps, floor 200) when someone they referred
  reaches `ref_active`, or as that referee (flat 300 starter bonus) at the
  same moment. `/checkin` reads and decrements it on every call, handing it
  back in the response as `pendingReward` for the client to add to
  `state.cookies` — so a reward granted while a player is away just shows up
  next time they open the app.

Both bonus amounts (`REFEREE_WELCOME_BONUS`, `REFERRER_BONUS_SECONDS`,
`REFERRER_BONUS_MIN` in `src/index.js`) are easy to retune once there's data
on how they affect K-factor.

```bash
wrangler d1 create cookie-clicker-analytics
```

Prints a `database_id` — paste it into `wrangler.toml` replacing
`REPLACE_WITH_D1_DATABASE_ID`. Then apply the schema:

```bash
wrangler d1 execute cookie-clicker-analytics --remote --file=schema.sql
```

Set two more secrets:

```bash
wrangler secret put WEBHOOK_SECRET   # any random string you make up
wrangler secret put ADMIN_KEY        # any random string you make up
```

`WEBHOOK_SECRET` verifies incoming Telegram webhook calls actually came from
Telegram (sent back as a header on every call once registered — see below).
`ADMIN_KEY` gates `GET /funnel?key=<ADMIN_KEY>`, the only way to read
aggregate stats without querying D1 directly.

Deploy, then register the webhook (needs your bot token — replace
`<BOT_TOKEN>` and `<WEBHOOK_SECRET>` with the actual values, and
`<WORKER_URL>` with your deployed Worker's `*.workers.dev` URL):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=<WORKER_URL>/telegram-webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

Telegram will now POST every incoming message to `/telegram-webhook`; the
Worker only acts on `/start` (bot_start, and ref_click if a referral
`start` payload is present).

Check it's wired up:

```bash
curl -s "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Should show your Worker's URL with no `last_error_message`.

### Reading the funnel

```bash
curl -s "<WORKER_URL>/funnel?key=<ADMIN_KEY>"
```

Returns distinct-user counts per event — a quick pulse check, not a strict
sequential funnel. For real funnel/cohort analysis (e.g. "of everyone who
did ref_click, what % reached first_upgrade"), query `events` directly:

```bash
wrangler d1 execute cookie-clicker-analytics --remote \
  --command "SELECT event, COUNT(DISTINCT user_id) FROM events GROUP BY event"
```

## Scaling notes

Every `user:*` record's fields are mirrored into that key's KV **metadata**
(returned inline by `list()`), not just its value. `/leaderboard`, the
inactivity scan, and broadcasts all read straight off `list()` results — no
`get()`-per-user loop. This matters because Workers caps subrequests per
invocation (50 on the free plan, 1000 on paid); a get()-per-user loop broke
past a few dozen/thousand registered users regardless of how many were
actually active. `list()` only costs one subrequest per 1000 keys, so this
now scales to tens of thousands of registered users for free.

What's *not* fixed: actually **sending** a push (`sendPush`'s `fetch()` call)
is still one subrequest per recipient, and a broadcast (event start) contacts
every registered user. At a few thousand+ users this would need to be
batched across multiple invocations (e.g. via Cloudflare Queues) rather than
one synchronous loop, and should respect Telegram's ~30 messages/sec bot-wide
rate limit (not currently throttled). Not an issue at today's scale — flag it
if the user base grows into the thousands.

## Local testing

```bash
wrangler dev
```

Then you can `curl -X POST http://localhost:8787/checkin -d '{...}'` — note
it will reject any initData that doesn't pass real Telegram signature
validation, so meaningful end-to-end testing needs to go through the actual
Telegram client.
