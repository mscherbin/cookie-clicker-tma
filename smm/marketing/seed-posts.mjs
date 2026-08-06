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
//   POSTS=posts.json (content file inside marketing/; default: posts.json)
//   CHANNEL=@handle (target channel for EVERY seeded post; default: none, so the
//                    worker falls back to config.channel_id — the EN channel.
//                    For the RU channel pass CHANNEL=@bestcookiclickerru)
//   DRY=1 (print what would be scheduled, send nothing)
//
// Usage:
//   ADMIN_KEY=xxxx node marketing/seed-posts.mjs
//   ADMIN_KEY=xxxx START=2026-08-05 DRY=1 node marketing/seed-posts.mjs
//   # RU channel from a Russian content file:
//   ADMIN_KEY=xxxx POSTS=posts.ru.json CHANNEL=@bestcookiclickerru node marketing/seed-posts.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_URL = (process.env.WORKER_URL || 'https://cookie-clicker-tma-smm.mscherbin.workers.dev').replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY;
const BOT = process.env.BOT || 'bestcookieclickerbot';
const POSTS_FILE = process.env.POSTS || 'posts.json';
const CHANNEL = (process.env.CHANNEL || '').trim(); // '' => worker uses config default (EN)
const MIN_DAY = process.env.MIN_DAY !== undefined ? Number(process.env.MIN_DAY) : -Infinity; // skip posts with day < MIN_DAY (e.g. day-0 launch posts already sent via post-now)
const SRC = process.env.SRC || 'chan';   // startapp attribution tag (e.g. chan_ru for the RU channel)
const BUTTON_TEXT = process.env.BTN || '🍪 Play now';
const DRY = process.env.DRY === '1';
// startapp deep link launches the Mini App directly and tags the source as SRC
// (for channel-attribution). If a plain link is preferred, use `https://t.me/${BOT}`.
const BUTTON_URL = `https://t.me/${BOT}?startapp=${SRC}`;

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

// SLOTS mode: post several times a day at fixed local-time slots, filling a FLAT
// content list sequentially. Set e.g. SLOTS="16:00,18:00,19:30,21:00,22:30".
// Ignores per-post day/hour. Slots already in the past (for START = today) are
// skipped, so the run picks up at the next upcoming slot.
const SLOTS = (process.env.SLOTS || '').trim();
function parseSlots(str) {
  return str.split(',').map((s) => {
    const [h, m] = s.trim().split(':').map(Number);
    return { h: h || 0, m: m || 0 };
  }).filter((s) => s.h >= 0 && s.h < 24);
}
// Generate `count` ascending publish_at values across the daily slots, starting
// from `startBase` (a local-midnight Date), skipping any slot already past `now`.
function slotTimes(startBase, slots, count) {
  const out = [];
  const now = Date.now();
  for (let day = 0; out.length < count && day < 400; day++) {
    for (const s of slots) {
      const d = new Date(startBase);
      d.setDate(d.getDate() + day);
      d.setHours(s.h, s.m, 0, 0);
      if (d.getTime() > now) { out.push(d.getTime()); if (out.length >= count) break; }
    }
  }
  return out;
}

const raw = JSON.parse(await readFile(join(HERE, POSTS_FILE), 'utf8'));
// In SLOTS mode the base is local midnight of START (or today); day/hour on posts
// are ignored. Otherwise keep the legacy day-offset base (START or tomorrow).
const base = SLOTS
  ? (process.env.START ? startDate() : (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })())
  : startDate();

const selected = raw.posts.filter((p) => SLOTS ? true : (p.day ?? 0) >= MIN_DAY);
const times = SLOTS ? slotTimes(base, parseSlots(SLOTS), selected.length) : null;

const payload = {
  posts: selected.map((p, i) => {
    const post = {
      publish_at: SLOTS ? times[i] : publishAtFor(base, p.day, p.hour ?? 18),
      text: p.text,
      parse_mode: 'HTML',
      disable_preview: true,
    };
    // Per-post channel: explicit on the post wins, else the CHANNEL env, else
    // omitted (the worker falls back to config.channel_id — the EN channel).
    const channel = (typeof p.channel === 'string' && p.channel.trim()) ? p.channel.trim() : CHANNEL;
    if (channel) post.channel = channel;
    // Optional photo URL → the worker sends it as a photo with text as caption.
    if (typeof p.image === 'string' && p.image.trim()) post.image = p.image.trim();
    if (p.button !== false) {
      post.button_text = BUTTON_TEXT;
      post.button_url = BUTTON_URL;
    }
    return post;
  }),
};

// Human-readable preview.
console.log(`Worker:  ${WORKER_URL}`);
console.log(`Content: ${POSTS_FILE}`);
console.log(`Target:  ${CHANNEL || '(config default — EN channel)'}`);
console.log(`Channel CTA -> ${BUTTON_URL}`);
console.log(SLOTS ? `Mode:    SLOTS ${SLOTS} (${parseSlots(SLOTS).length}/day)` : `Mode:    day-offset (1 per post)`);
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
