# Push worker

Cloudflare Worker that sends retention push notifications for the Cookie
Clicker mini app: a "cookies piling up" nudge ~5h after the player was last
active, and a "daily reward is waiting" nudge at 24h. Never sends more than
one push per inactivity cycle — checking in (opening the app) resets it.

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

## Local testing

```bash
wrangler dev
```

Then you can `curl -X POST http://localhost:8787/checkin -d '{...}'` — note
it will reject any initData that doesn't pass real Telegram signature
validation, so meaningful end-to-end testing needs to go through the actual
Telegram client.
