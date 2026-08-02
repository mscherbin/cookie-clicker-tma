# Автопостинг в Telegram-канал

Канал ведётся автоматически: очередь постов лежит в D1 (`scheduled_posts`),
а существующий крон воркера (каждые 15 мин) публикует созревшие посты в канал
через бота `@bestcookieclickerbot`. **Токен бота остаётся внутри воркера** —
наружу не выдаётся. Точность публикации — ±15 мин (шаг крона).

## Что нужно сделать один раз, чтобы включить

1. **Создать канал** в Telegram.
2. **Добавить `@bestcookieclickerbot` админом** канала с правом
   **Post Messages** (Публиковать сообщения).
3. **Задеплоить воркер** с новым кодом и применить схему:
   ```bash
   cd "push"
   wrangler d1 execute cookie-clicker-analytics --remote --file=schema.sql
   export CLOUDFLARE_API_TOKEN=...   # если сессия терминала новая
   wrangler deploy
   ```
4. **Прописать канал и включить автопостинг** (в БД, без релиза):
   ```bash
   cd "push"
   wrangler d1 execute cookie-clicker-analytics --remote \
     --command "UPDATE config SET value='@ВАШ_КАНАЛ' WHERE key='channel_id'"
   wrangler d1 execute cookie-clicker-analytics --remote \
     --command "UPDATE config SET value='1' WHERE key='autopost_enabled'"
   ```
   `channel_id` — это `@username` публичного канала **или** числовой
   `-100…` id приватного.
5. **Проверить связку** — отправить один пост прямо сейчас (smoke-test):
   ```bash
   curl -s -X POST \
     "https://cookie-clicker-tma-push.mscherbin.workers.dev/admin/post-now?key=ADMIN_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text":"✅ Тест автопостинга","button_text":"🍪 Играть","button_url":"https://t.me/bestcookieclickerbot?startapp=chan"}'
   ```
   Если в канале появился пост — всё связано верно.
6. **Залить 2-недельный план в очередь**:
   ```bash
   ADMIN_KEY=xxxx node marketing/seed-posts.mjs           # с завтрашнего дня
   ADMIN_KEY=xxxx START=2026-08-05 node marketing/seed-posts.mjs   # с конкретной даты
   ADMIN_KEY=xxxx DRY=1 node marketing/seed-posts.mjs     # предпросмотр без отправки
   ```
7. Первый пост (закреп) после публикации **закрепить в канале руками** (у бота
   нет права pin, только post).

`ADMIN_KEY` — из `SESSION_CONTEXT.md` (раздел секретов воркера). В файлы
маркетинга он не зашит: скрипт берёт его из переменной окружения.

## Admin-эндпоинты (все гейтятся `?key=ADMIN_KEY`)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/admin/schedule-post` | поставить пост(ы) в очередь. Body: один объект, `{post:{…}}` или `{posts:[…]}` |
| GET  | `/admin/posts` | посмотреть очередь. `?status=pending\|sent\|failed\|canceled\|all&limit=n` |
| POST | `/admin/post-now` | опубликовать сразу (и как smoke-test) |
| POST | `/admin/cancel-post` | отменить ещё не ушедший пост. Body: `{id}` |

Поля поста: `text` (обяз.), `publish_at` (ms epoch) **или** `publish_in_minutes`,
`parse_mode` (`HTML` по умолч.), `button_text`+`button_url`, `disable_preview`.

## Полезное

```bash
# очередь на публикацию
curl -s "https://cookie-clicker-tma-push.mscherbin.workers.dev/admin/posts?key=ADMIN_KEY"
# что уже опубликовано / упало
curl -s "https://cookie-clicker-tma-push.mscherbin.workers.dev/admin/posts?key=ADMIN_KEY&status=all"
# выключить автопостинг (посты остаются в очереди, просто не уходят)
wrangler d1 execute cookie-clicker-analytics --remote \
  --command "UPDATE config SET value='0' WHERE key='autopost_enabled'"
```

## Как редактировать контент

Тексты — в `marketing/posts.json` (`day` = смещение в днях от START, `hour` =
час по локальному времени машины). Правьте текст/расписание там и перезапускайте
`seed-posts.mjs`. Кнопка-CTA добавляется автоматически; чтобы убрать у поста —
`"button": false`.

⚠️ **Каналы Telegram не поддерживают web_app-кнопки** — только URL-кнопки.
Поэтому CTA ведёт на `t.me/bestcookieclickerbot?startapp=chan` (deep link, что
запускает Mini App), а не напрямую кнопкой Mini App.
