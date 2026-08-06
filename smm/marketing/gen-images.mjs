#!/usr/bin/env node
// Generate post images with fal.ai and save them into ../../assets/marketing/,
// so they ship on GitHub Pages and can be attached to channel posts by URL.
//
// The API key is NEVER hardcoded or committed. Provide it via either:
//   export FAL_KEY=...            (env), or
//   a file marketing/.falkey      (one line; gitignored)
//
// Usage:
//   node marketing/gen-images.mjs              # generate all missing images
//   ONLY=p11,p15 node marketing/gen-images.mjs # only these ids
//   FORCE=1 node marketing/gen-images.mjs      # regenerate even if file exists
//   DRY=1 node marketing/gen-images.mjs        # print composed prompts, call nothing
//
// After it finishes: commit assets/marketing/*.png to the Pages repo, then wire
// the printed URLs into posts.5x-*.json ("image": "<url>") and re-seed.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(HERE, '..', '..', 'assets', 'marketing');
const PAGES_BASE = 'https://mscherbin.github.io/cookie-clicker-tma/assets/marketing';

const DRY = process.env.DRY === '1';
const FORCE = process.env.FORCE === '1';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

async function loadKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY.trim();
  try { return (await readFile(join(HERE, '.falkey'), 'utf8')).trim(); } catch (e) { return null; }
}
async function exists(p) { try { await access(p); return true; } catch (e) { return false; } }

const cfg = JSON.parse(await readFile(join(HERE, 'image-prompts.json'), 'utf8'));
const MODEL = process.env.MODEL || cfg.model || 'fal-ai/flux/dev';
const SIZE = cfg.size || 'square_hd';
const STYLE = cfg.style || '';
let prompts = cfg.prompts;
if (ONLY.length) prompts = prompts.filter((p) => ONLY.includes(p.id));

const KEY = await loadKey();
if (!KEY && !DRY) {
  console.error('ERROR: no fal.ai key. Set FAL_KEY=... or put it in marketing/.falkey (gitignored). Or DRY=1 to preview prompts.');
  process.exit(1);
}

await mkdir(ASSETS_DIR, { recursive: true });
console.log(`Model: ${MODEL} | size: ${SIZE} | targets: ${prompts.length}\n`);

const done = [];
for (const p of prompts) {
  const prompt = `${p.subject}, ${p.style || STYLE}`;
  const outFile = join(ASSETS_DIR, `${p.id}.png`);
  const url = `${PAGES_BASE}/${p.id}.png`;

  if (DRY) { console.log(`# ${p.id}\n${prompt}\n`); done.push({ id: p.id, url }); continue; }
  if (!FORCE && await exists(outFile)) { console.log(`⏭  ${p.id} exists — skip`); done.push({ id: p.id, url }); continue; }

  try {
    const res = await fetch(`https://fal.run/${MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image_size: SIZE, num_images: 1, enable_safety_checker: true }),
    });
    const json = await res.json().catch(() => ({}));
    const imgUrl = json && json.images && json.images[0] && json.images[0].url;
    if (!res.ok || !imgUrl) { console.error(`❌ ${p.id} failed (${res.status}): ${JSON.stringify(json).slice(0, 200)}`); continue; }
    const bin = Buffer.from(await (await fetch(imgUrl)).arrayBuffer());
    await writeFile(outFile, bin);
    console.log(`✅ ${p.id}  ${(bin.length / 1024).toFixed(0)}KB  -> ${url}`);
    done.push({ id: p.id, url });
  } catch (e) {
    console.error(`❌ ${p.id} error: ${String(e).slice(0, 160)}`);
  }
}

console.log('\n=== id -> URL map (for posts.5x-*.json "image") ===');
console.log(JSON.stringify(Object.fromEntries(done.map((d) => [d.id, d.url])), null, 2));
