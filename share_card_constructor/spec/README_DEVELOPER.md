# Cookie Clicker — Share Card Constructor

This is a **constructor handoff**, not a batch of final user cards.

## Contents
- `assets/hero/hero_cookie.svg` — vector hero cookie.
- `assets/hero/hero_cookie_2x.png`, `hero_cookie_3x.png` — transparent PNG exports.
- `assets/glyphs/*.svg` — ★ / trophy / CPS / gift / arrow.
- `assets/tiers/*_overlay.svg` — transparent tier overlays, portrait + square.
- `previews/portrait/` — all 5 tiers at 1080×1350.
- `previews/square/` — all 5 tiers at 1080×1080.
- `previews/legibility_120px_test.jpg` — feed-scale legibility test.
- `previews/gold_no_rank_state.jpg` — missing-rank collapse state.
- `previews/gold_long_name_state.jpg` — long-name handling.
- `spec/canvas_spec.json` — exact dynamic-field boxes, sizes, colors and behavior.
- `spec/localization_ru_en.json` — RU/EN strings.

## Critical Telegram note
A button drawn **inside the image is not clickable**. Keep the visual CTA in the card, but put the actual referral URL in the Telegram caption/text or an inline button.

## Missing rank
No data = no fake value. Hide the rank card completely and let CPS span the full stats row.

## Tier system
Bronze → Silver → Gold → Cosmos → Singularity.
Only frame/accent/glow/background FX change. The seven-zone structure stays fixed.
Ascension ranges are intentionally marked TBD until product/balance approval.
