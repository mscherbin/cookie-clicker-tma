# Push worker

Cloudflare Worker that sends retention push notifications for the Cookie
Clicker mini app:

- Per-user inactivity nudges: "cookies piling up" ~5h after the player was
  last active, and "daily reward is waiting" at 24h. Never sends more than
  one push per inactivity cycle — checking in (opening the app) resets it.
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
  - `>= 5h` and `pushStage < 1` → sends the "cookies piling up" message,
    stamps `pushStage = 1`.
  - `>= 24h` and `pushStage < 2` → sends the "daily reward is waiting"
    message, stamps `pushStage = 2`.
  - Neither fires again until the player reopens the app (which resets
    `pushStage` back to 0 via `/checkin`).

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
  - Also checks whether Happy Hour (06:00–07:00 and 18:00–19:00 UTC, twice a
    day) or the Weekend event (Sat 00:00 UTC – Mon 00:00 UTC) just became
    active. If so, and it hasn't already announced this specific occurrence
    (tracked via an `eventflag:<id>:<date>[-hour]` KV marker with a 5-day
    TTL), it broadcasts to
    every `user:*` entry in KV.

## Local testing

```bash
wrangler dev
```

Then you can `curl -X POST http://localhost:8787/checkin -d '{...}'` — note
it will reject any initData that doesn't pass real Telegram signature
validation, so meaningful end-to-end testing needs to go through the actual
Telegram client.
