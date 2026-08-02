#!/usr/bin/env node
// Seed the 2-week content plan into the channel auto-post queue.
//
// The worker's cron publishes queued posts to config.channel_id via the bot, so
// before this does anything useful you must have already:
//   1) created the channel,
//   2) added @bestcookieclickerbot as an admin with "post messages",
//   3) set config.channel_id + autopost_enabled=1 (see marketing/README.md),
//   4) deployed the worker (wrangler deploy).
//
// Secrets are NOT hardcoded — pass them via env:
//   ADMIN_KEY=...  (the worker's ADMIN_KEY)
//   WORKER_URL=... (default: https://cookie-clicker-tma-smm.mscherbin.workers.dev)
//   START=YYYY-MM-DD (first post's date; default: tomorrow, local time)
//   BOT=bestcookieclickerbot (bot username for the CTA button)
//   DRY=1 (print what would be scheduled, send nothing)
//
// Usage:
//   ADMIN_KEY=xxxx node marketing/seed-posts.mjs
//   ADMIN_KEY=xxxx START=2026-08-05 DRY=1 node marketing/seed-posts.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_URL = (process.env.WORKER_URL || 'https://cookie-clicker-tma-smm.mscherbin.workers.dev').replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY;
const BOT = process.env.BOT || 'bestcookieclickerbot';
const DRY = process.env.DRY === '1';
// startapp deep link launches the Mini App directly and tags the source as
// "chan" (useful later for channel-attribution). If a plain link is preferred,
// change to `https://t.me/${BOT}`.
const BUTTON_URL = `https://t.me/${BOT}?startapp=chan`;
const BUTTON_TEXT = '🍪 Играть / Play';

if (!ADMIN_KEY && !DRY) {
  console.error('ERROR: set ADMIN_KEY=... (or DRY=1 to preview without sending).');
  process.exit(1);
}

// First post's date: START (YYYY-MM-DD) or tomorrow, local time.
function startDate() {
  if (process.env.START) {
    const [y, m, d] = process.env.START.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(0, 0, 0, 0);
  return t;
}

function publishAtFor(base, dayOffset, hour) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

const raw = JSON.parse(await readFile(join(HERE, 'posts.json'), 'utf8'));
const base = startDate();

const payload = {
  posts: raw.posts.map((p) => {
    const post = {
      publish_at: publishAtFor(base, p.day, p.hour ?? 18),
      text: p.text,
      parse_mode: 'HTML',
      disable_preview: true,
    };
    if (p.button !== false) {
      post.button_text = BUTTON_TEXT;
      post.button_url = BUTTON_URL;
    }
    return post;
  }),
};

// Human-readable preview.
console.log(`Worker:  ${WORKER_URL}`);
console.log(`Channel CTA -> ${BUTTON_URL}`);
console.log(`Scheduling ${payload.posts.length} posts, first day = ${base.toDateString()}\n`);
payload.posts.forEach((p, i) => {
  const when = new Date(p.publish_at).toLocaleString();
  const preview = p.text.replace(/\n/g, ' ').slice(0, 60);
  console.log(`  #${String(i + 1).padStart(2)}  ${when}  ${preview}…`);
});

if (DRY) {
  console.log('\nDRY run — nothing sent. Re-run without DRY=1 to enqueue.');
  process.exit(0);
}

const res = await fetch(`${WORKER_URL}/admin/schedule-post?key=${encodeURIComponent(ADMIN_KEY)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const json = await res.json().catch(() => ({}));
if (res.ok && json.ok) {
  console.log(`\n✅ Queued ${json.scheduled} posts. ids: ${JSON.stringify(json.ids)}`);
  console.log(`Check the queue: curl -s "${WORKER_URL}/admin/posts?key=ADMIN_KEY"`);
} else {
  console.error(`\n❌ Failed (${res.status}):`, JSON.stringify(json));
  process.exit(1);
}
