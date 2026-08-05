(() => {
  'use strict';

  // ---------- Telegram integration ----------
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
    try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
  }

  function haptic(style) {
    if (tg && tg.HapticFeedback) {
      try { tg.HapticFeedback.impactOccurred(style || 'light'); } catch (e) {}
    }
  }

  // ---------- i18n (RU / EN) ----------
  // Auto-detected from Telegram's language_code on first load (ru* → ru, else
  // en — English is the safer default for a non-Russian speaker), stored in
  // state.lang so it persists and can be overridden in Settings. Building /
  // upgrade names (Priority 2) are intentionally NOT in the table yet — the game
  // is playable without them (numbers + icons are language-neutral).
  function detectLang() {
    const code = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || '';
    return /^ru/i.test(code) ? 'ru' : 'en';
  }

  const STRINGS = {
    ru: {
      'tab.buildings': 'Здания', 'tab.upgrades': 'Апгрейды', 'tab.shop': '🛒 Магазин',
      'tab.ascension': '⭐ Вознесение', 'tab.top': '🏆 Топ', 'tab.friends': '🤝 Друзья',
      'top.cookies': 'печенек',
      'top.cps': '{n} печенек/сек', 'top.clickPower': 'Сила клика: {p} · апгрейдов клика: {a}/{total}',
      'top.boost2x': '⚡ ×2 производство · ещё {t}',
      'top.offlineBoost': '🚀 Офлайн без ограничений · ещё {t}', 'top.offline100': '💤 Офлайн 100%: {t}',
      'top.rank': '🏆 #{n}', 'top.rankOf': '🏆 #{n} из {total}',
      'time.h': 'ч', 'time.m': 'мин', 'time.s': 'сек', 'time.d': 'д', 'evt.remain': 'осталось {t}',
      // Settings
      'set.head': '⚙️ Настройки', 'set.lang': 'Язык', 'set.syncTitle': 'Синхронизация между устройствами',
      'set.push': '⬆️ Отправить в облако', 'set.pull': '⬇️ Загрузить из облака',
      'set.hint': 'Если на разных устройствах разные цифры — на том, чей прогресс хотите оставить, нажмите «Отправить», а на остальных — «Загрузить». Перед загрузкой и сбросом текущий прогресс этого устройства автоматически сохраняется в резервную копию.',
      'set.restore': '↩️ Восстановить резервную копию (это устройство)',
      'set.reset': 'Сбросить прогресс полностью', 'set.close': 'Закрыть',
      // Shop
      'shop.title': '🛒 Магазин', 'shop.desc': 'Ускорь производство за Telegram Stars ⭐',
      'shop.nocap': '🚀 Снять кап офлайна на 24ч · {n} ⭐', 'shop.nocapExtend': 'Продлить ещё на 24ч · {n} ⭐',
      'shop.boost2x': '⚡ ×2 производство на 1ч · {n} ⭐', 'shop.boost2xExtend': 'Продлить ×2 ещё на 1ч · {n} ⭐',
      'shop.perm': '🌟 +10% к производству навсегда · {n} ⭐', 'shop.permOwned': '🌟 +10% навсегда · Куплено ✓',
      'shop.clickBypass': '⚡ Открыть клик-апгрейды без кликов · {n} ⭐', 'shop.clickBypassOwned': '⚡ Клик-апгрейды без кликов · Куплено ✓',
      'shop.adNocap': '📺 +2ч без капа за рекламу', 'shop.adBoost2x': '📺 +15 мин ×2 за рекламу',
      'shop.adLimit': '📺 Реклама на сегодня: {used}/{limit}',
      'shop.adBypassOr': 'Или бесплатно за рекламу', 'shop.adBypass': '📺 +1 просмотр к разблокировке',
      'toast.adBypassProgress': '📺 Прогресс: {views}/{target} просмотров', 'toast.adBypassUnlocked': '⚡ Клик-апгрейды открыты за рекламу!',
      'popup.offlineTitle': '💤 Офлайн-доход', 'popup.cpsTitle': '⚡ Производство',
      'popup.offlineExplain': 'Печеньки копятся, даже когда игра закрыта: первые {cap} — на полной скорости, дальше медленнее.',
      'popup.offlineExplainBoost': 'Сейчас офлайн без ограничений — печеньки копятся на полной скорости всё время, пока активен буст.',
      'toast.adLoading': 'Загружаем рекламу…', 'toast.adReward': '📺 Награда за рекламу начислена!',
      'toast.adNoReward': 'Реклама не досмотрена — награда не начислена', 'toast.adUnavailable': 'Реклама сейчас недоступна',
      'toast.adLimitReached': 'Лимит рекламы на сегодня исчерпан ({used}/{limit})',
      'toast.adInProgress': 'Дождитесь завершения текущего просмотра',
      // Ascension card
      'asc.title': '⭐ Вознесение',
      'asc.desc': 'Сбрасывает прогресс, но даёт постоянный бонус к производству — с каждым разом бонус растёт.',
      'asc.firstTime': '✨ Это будет твоё первое вознесение',
      'asc.bonusRow': 'Постоянный бонус', 'asc.btn': 'Вознестись',
      'asc.heroLabelFirst': 'к производству навсегда — при первом вознесении',
      'asc.heroLabelNext': 'к производству навсегда — при следующем вознесении',
      'asc.locked': '🔒 Осталось: {rest}',
      // Stats
      'stats.head': '📊 Статистика',
      // Daily
      'daily.title': 'Ежедневная награда', 'daily.day': 'День {n}', 'daily.claim': 'Забрать',
      'daily.refText': '🤝 Играешь не один? Позови друга — и ты, и он получите бонус печенек!',
      'daily.invite': '📤 Позвать друга',
      'chan.head': '📢 Наш канал', 'chan.desc': 'Подпишись на канал — анонсы событий, тиров и апдейтов + разовый бонус печенек.',
      'chan.dailyText': '📢 Подпишись на наш канал — анонсы событий и разовый бонус печенек!',
      'chan.subscribe': '📢 Подписаться на канал', 'chan.claim': 'Проверить и забрать бонус',
      'chan.checking': 'Проверяем подписку…', 'chan.claimed': '🎉 Бонус за подписку: +{n} 🍪',
      'chan.already': 'Бонус за подписку уже получен ✓', 'chan.notSub': 'Подписка не найдена — подпишись и нажми «Проверить»',
      // Offline modal
      'off.title': 'С возвращением!', 'off.sub': 'Пока тебя не было, напеклось:',
      'off.claim': 'Забрать', 'off.x2main': 'Забрать ×2 за {n} ⭐', 'off.x2sub': 'получишь {n} 🍪',
      'off.processing': 'Ожидаем подтверждение оплаты…',
      // Friends tab
      'fr.statHead': '🤝 Твоя отдача от друзей', 'fr.activeFriends': 'Активных друзей',
      'fr.boost': 'Буст к производству', 'fr.offlineFull': 'Офлайн на полной скорости',
      'fr.offlineBoost': '🚀 Офлайн без ограничений', 'fr.invite': '📤 Позвать друга',
      'fr.rewardsHead': '🏅 Награды за друзей', 'fr.lbHead': '🏆 Топ по друзьям',
      'fr.weekly': 'За неделю', 'fr.alltime': 'За всё время',
      // Onboarding
      'onb.clickHint': '👆 Нажми на печеньку!', 'onb.upgradeHint': 'Купи апгрейд — печеньки будут копиться быстрее',
      'onb.welcomeBonus': '🎁 Стартовый бонус: +{n} печенек!',
      // Unlock (referral building) modal
      'unlock.title': 'Новое здание открыто!', 'unlock.place': 'Поставить',
      // Events
      'evt.happyHour': '🎉 Печеньковый час', 'evt.weekend': '🎊 Печеньковые выходные',
      // Friend reward milestones + titles
      'ms.skin': 'Скин печеньки', 'ms.bakery': 'Пекарня дружбы',
      'ms.title25': 'Титул «Общительная печенька»', 'ms.title50': 'Титул «Легенда Печенек»', 'ms.title100': 'Титул «Император Печенек»',
      'ms.open': '✓ Открыто', 'ms.left': 'ещё {n}',
      'ms.nextReward': 'Ещё {n} {friends} до награды «{label}»', 'ms.allOpen': 'Все награды за друзей открыты! 👑',
      'title.social': 'Общительная печенька', 'title.legend': 'Легенда Печенек', 'title.emperor': 'Император Печенек',
      'title.none': 'Пока без титула',
      'ptitle.celestial': 'Небожитель', 'ptitle.creator': 'Творец мироздания',
      // Friends dynamic
      'fr.offlineExtra': '{cap} · +{extra} за друзей',
      // Leaderboard
      'lb.explainer': '🏅 {crit}', 'lb.criterion': 'Ранг: по числу перерождений, затем по скорости производства',
      'lb.lifetime': '🍪 {n} за всё время', 'lb.perSec': 'печ/сек', 'lb.pioneer': '🚩 Пионер',
      'lb.you': 'Ты', 'lb.yourPlace': 'Твоё место', 'lb.selfOf': 'из {total}',
      'lb.global': '🌍 Все', 'lb.myCountry': 'Моя страна', 'lb.friendsView': '🤝 Друзья',
      'lb.emptyFriends': 'Позови друзей — и соревнуйтесь, кто продвинется дальше!',
      'lb.rival': '⚡ Ещё {n} печ/сек — и обгонишь {name}!', 'lb.rankJump': '🚀 +{n} {w} в топе!',
      'lb.momentum': '🔥 {name} поднялся на {n} {w} за час',
      'lb.allTime': 'Всё время', 'lb.thisWeek': 'Эта неделя',
      'lb.criterionWeek': 'Ранг за неделю: по вознесениям, затем по выпечке',
      'lb.weekAsc': '⭐ +{n} {w} за неделю', 'lb.weekBakedLabel': '🍪 испечено за неделю',
      'lb.perWeek': 'за нед.', 'lb.emptyWeek': 'На этой неделе пока никто не отметился — стань первым!',
      'lb.weekTimer': '⏳ Неделя закончится через {t}',
      'lb.empty': 'Пока никого нет — станьте первым!', 'lb.loading': 'Загрузка…',
      'lb.comingSoon': 'Лидерборд скоро появится', 'lb.loadFail': 'Не удалось загрузить лидерборд. Попробуйте позже.',
      'lb.refActive': '🤝 активных друзей', 'lb.refWord': '{word}',
      'refLb.emptyWeek': 'На этой неделе ещё никто не звал друзей — будь первым! 🤝',
      'refLb.emptyAll': 'Пока никто не привёл друзей — стань первым! 🤝', 'refLb.loadFail': 'Не удалось загрузить. Попробуйте позже.',
      // Toasts (Priority-1)
      'toast.onlyTelegram': 'Доступно только в Telegram', 'toast.payOnlyTelegram': 'Оплата доступна только в Telegram',
      'toast.dailyClaimed': '🎁 День {d}: +{n} 🍪', 'toast.ascended': '⭐ Вознесение! Постоянный бонус теперь +{n}% к производству',
      'toast.boughtUpgrade': 'Куплено!', 'toast.notEnough': 'Не хватает печенек',
      // Remaining content + prestige banner
      'content.remain': '{b} {bw} и {u} {uw}',
      'banner.allBought': 'Всё куплено! 🎉', 'banner.availSub': 'Пора переродиться — +{n}% к производству навсегда',
      'banner.almostAll': 'Почти всё куплено! 🎉', 'banner.soonSub': 'Скоро откроется вознесение — осталось: {rest}',
      'banner.cta': 'Переродиться',
      // Priority-2: upgrade effect/req/desc, categories, stats, deep toasts, confirms
      'up.effClick': 'Сила клика: {a} → {b}', 'up.effGlobal': 'Всё производство: {a} → {b} печ/сек',
      'up.effBuilding': '{name}: {a} → {b} печ/сек за шт.',
      'up.reqBuilding': '🔒 Откроется: купите {icon} {name}', 'up.reqClicks': '🔒 Откроется: {n} кликов (сделано {d})',
      'up.reqBaked': '🔒 Откроется: испечено {n} печенек',
      'up.progress': '🏆 Апгрейды (тир {t}): <b>{b}</b> / {total}', 'up.completed': 'Выполнено ({n})',
      'up.emptyGrow': 'Апгрейды появятся по мере роста производства', 'up.emptyAll': '🎉 Все апгрейды куплены!',
      'up.emptyDone': 'Пока всё доступное куплено — новое откроется по мере роста производства',
      'cat.click': '⚡ Улучшения клика', 'cat.building': '🏭 Улучшения зданий', 'cat.global': '✨ Глобальные',
      'tier.lockAfter': 'Доступно после {n}-го вознесения',
      'ref.buildingLocked': 'Доступно за {n} активных друзей',
      'ref.ready': 'Готово к установке — бесплатно', 'ref.gift': '🫶 дар друзей', 'ref.placedSub': '{n} печ/сек',
      'bld.persecEach': '{n} печ/сек за шт.',
      'ref.unlockDesc': 'Награда за {n} активных друзей. Ставится бесплатно и печёт вместе с твоей армией!',
      'teaser.readySub': 'Открыта! Нажми, чтобы поставить', 'teaser.readyCta': 'Поставить',
      'teaser.sub': 'Ещё {n} {friends} — особое здание', 'teaser.cta': 'Позвать',
      'player.default': 'Игрок',
      'stat.totalBaked': 'Всего испечено', 'stat.clicks': 'Кликов сделано', 'stat.cps': 'Печенек в секунду',
      'stat.clickPower': 'Сила клика', 'stat.clickUpg': 'Апгрейдов клика', 'stat.buildings': 'Зданий всего',
      'stat.upgrades': 'Апгрейдов куплено', 'stat.streak': 'Дней подряд', 'stat.ascensions': 'Вознесений',
      'toast.offlineBaked': 'Пока вас не было, испечено {n} 🍪',
      'toast.noBackup': 'Резервной копии нет', 'toast.restored': '✅ Восстановлено: {n} 🍪, тир {t}',
      'toast.backupCorrupt': 'Резервная копия повреждена',
      'toast.cloudUnavailable': 'CloudStorage недоступен на этом устройстве', 'toast.cloudPushFail': 'Не удалось отправить в облако',
      'toast.cloudPushOk': '✅ Это сохранение отправлено в облако', 'toast.cloudEmpty': 'В облаке пусто или ошибка загрузки',
      'toast.cloudCorrupt': 'Сохранение в облаке повреждено', 'toast.cloudPullOk': '✅ Загружено из облака (резервная копия сохранена)',
      'toast.cloudParseFail': 'Не удалось разобрать сохранение из облака',
      'toast.offlineX2Credited': '🍪 ×2 офлайн-доход начислен: +{n}', 'toast.nocapOn': '🚀 Кап офлайна снят на 24 часа!',
      'toast.boost2xOn': '⚡ ×2 производство активно на 1 час!', 'toast.permOn': '🌟 +10% к производству навсегда!',
      'toast.clickBypassOn': '⚡ Клик-апгрейды открыты без кликов!', 'toast.upgradeUnlockedGeneric': '🔓 Апгрейд разблокирован!',
      'toast.lbPrestige': '{n} {word} — постоянный бонус +{x}% к производству',
      'toast.lbPioneer': 'Один из первых {n} игроков, кто вознёсся — эксклюзивный титул, больше не выдаётся',
      'toast.ascendGate': 'Сначала купи всё — осталось: {rest}', 'toast.ascendTooEarly': 'Пока рано — испеките больше печенек, чтобы бонус вырос',
      'toast.ascendTooSoon': 'Вознесение будет доступно чуть позже — поиграй немного между перерождениями',
      'toast.newTitle': '{icon} Новый титул: «{name}» — ты достиг {n}-го уровня!', 'toast.offlineFreeClaimed': 'Забрано {n} 🍪',
      'toast.payX2': 'Оплата принята — начисляем ×2…', 'toast.payFailed': 'Оплата не прошла — попробуй ещё раз',
      'toast.invoiceFail': 'Не удалось создать счёт — попробуй позже', 'toast.payNocap': 'Оплата принята — снимаем кап…',
      'toast.payBoost2x': 'Оплата принята — включаем ×2…', 'toast.alreadyOwned': 'Уже куплено ✓',
      'toast.payPerm': 'Оплата принята — активируем +10%…', 'toast.payClickBypass': 'Оплата принята — открываем клик-апгрейды…',
      'toast.alreadyUnlocked': 'Уже разблокировано ✓', 'toast.payUpgradeSkip': 'Оплата принята — открываем «{name}»…',
      'toast.buildingPlaced': '{icon} {name} установлена!', 'toast.prestigeSoonNudge': 'Осталось: {rest} — купи, и откроется вознесение',
      'toast.boughtNamed': 'Куплено: {name}', 'toast.offlineHint': '🍪 Печеньки копятся, даже когда ты вышел — загляни попозже за добычей',
      'toast.frenzy': '🔥 Безумие печенья! x7 на 30 сек', 'toast.golden': '✨ Золотое печенье! +{n}',
      'confirm.ascend': 'Вознестись? Прогресс обнулится, но вы навсегда получите +{n}% к производству.',
      'confirm.reset': 'Точно сбросить весь прогресс?',
      'sync.ok': '☁️ Облако Telegram — синхронизируется между устройствами',
      'sync.noTg': '📱 Не в Telegram — сохранение только в этом браузере',
      'sync.noApi': '⚠️ CloudStorage недоступен — сохранение только на этом устройстве',
      'sync.oldVer': '⚠️ Версия Telegram устарела для облака — сохранение только на этом устройстве',
      'confirm.cloudPush': 'Здесь: всего испечено {here} 🍪.\nСейчас в облаке: всего испечено {cloud} 🍪.\n\nЗаменить сохранение в облаке данными с этого устройства?',
      'confirm.cloudPull': 'Здесь: всего испечено {here} 🍪.\nВ облаке: всего испечено {cloud} 🍪.\n\nЗаменить прогресс на этом устройстве данными из облака? (текущее состояние сохранится как резервная копия)',
      'share.text': 'Залипаю в Cookie Clicker — залетай печь печеньки со мной! 🍪',
      'evt.refReward': '🎉 Награда за друзей ×{mult}', 'evt.callFriends': 'зови друзей!',
    },
    en: {
      'tab.buildings': 'Buildings', 'tab.upgrades': 'Upgrades', 'tab.shop': '🛒 Shop',
      'tab.ascension': '⭐ Ascension', 'tab.top': '🏆 Top', 'tab.friends': '🤝 Friends',
      'top.cookies': 'cookies',
      'top.cps': '{n} cookies/sec', 'top.clickPower': 'Click power: {p} · click upgrades: {a}/{total}',
      'top.boost2x': '⚡ ×2 production · {t} left',
      'top.offlineBoost': '🚀 Offline uncapped · {t} left', 'top.offline100': '💤 Offline 100%: {t}',
      'top.rank': '🏆 #{n}', 'top.rankOf': '🏆 #{n} of {total}',
      'time.h': 'h', 'time.m': 'm', 'time.s': 's', 'time.d': 'd', 'evt.remain': '{t} left',
      'set.head': '⚙️ Settings', 'set.lang': 'Language', 'set.syncTitle': 'Sync across devices',
      'set.push': '⬆️ Save to cloud', 'set.pull': '⬇️ Load from cloud',
      'set.hint': 'If your devices show different numbers, tap “Save” on the one whose progress you want to keep, and “Load” on the others. Before loading or resetting, this device’s current progress is automatically backed up.',
      'set.restore': '↩️ Restore backup (this device)',
      'set.reset': 'Reset all progress', 'set.close': 'Close',
      'shop.title': '🛒 Shop', 'shop.desc': 'Speed up production with Telegram Stars ⭐',
      'shop.nocap': '🚀 Remove offline cap for 24h · {n} ⭐', 'shop.nocapExtend': 'Extend by 24h · {n} ⭐',
      'shop.boost2x': '⚡ ×2 production for 1h · {n} ⭐', 'shop.boost2xExtend': 'Extend ×2 by 1h · {n} ⭐',
      'shop.perm': '🌟 +10% production forever · {n} ⭐', 'shop.permOwned': '🌟 +10% forever · Owned ✓',
      'shop.clickBypass': '⚡ Unlock click upgrades without clicks · {n} ⭐', 'shop.clickBypassOwned': '⚡ Click upgrades without clicks · Owned ✓',
      'shop.adNocap': '📺 +2h no cap for an ad', 'shop.adBoost2x': '📺 +15 min ×2 for an ad',
      'shop.adLimit': '📺 Ads today: {used}/{limit}',
      'shop.adBypassOr': 'Or unlock free by watching ads', 'shop.adBypass': '📺 +1 view toward unlock',
      'toast.adBypassProgress': '📺 Progress: {views}/{target} views', 'toast.adBypassUnlocked': '⚡ Click upgrades unlocked via ads!',
      'popup.offlineTitle': '💤 Offline income', 'popup.cpsTitle': '⚡ Production',
      'popup.offlineExplain': 'Cookies pile up even while the game is closed: full speed for the first {cap}, then slower.',
      'popup.offlineExplainBoost': 'Offline is uncapped right now — cookies pile up at full speed the whole time while the boost is active.',
      'toast.adLoading': 'Loading ad…', 'toast.adReward': '📺 Ad reward granted!',
      'toast.adNoReward': 'Ad not completed — no reward', 'toast.adUnavailable': 'Ads are unavailable right now',
      'toast.adLimitReached': 'Daily ad limit reached ({used}/{limit})',
      'toast.adInProgress': 'Wait for the current ad to finish',
      'asc.title': '⭐ Ascension',
      'asc.desc': 'Resets your progress but grants a permanent production bonus — it grows every time.',
      'asc.firstTime': '✨ This will be your first ascension',
      'asc.bonusRow': 'Permanent bonus', 'asc.btn': 'Ascend',
      'asc.heroLabelFirst': 'to production forever — on your first ascension',
      'asc.heroLabelNext': 'to production forever — on your next ascension',
      'asc.locked': '🔒 Left: {rest}',
      'stats.head': '📊 Statistics',
      'daily.title': 'Daily reward', 'daily.day': 'Day {n}', 'daily.claim': 'Claim',
      'daily.refText': '🤝 Not playing alone? Invite a friend — you both get a cookie bonus!',
      'daily.invite': '📤 Invite a friend',
      'chan.head': '📢 Our channel', 'chan.desc': 'Subscribe for event, tier & update announcements + a one-time cookie bonus.',
      'chan.dailyText': '📢 Subscribe to our channel — announcements and a one-time cookie bonus!',
      'chan.subscribe': '📢 Subscribe to the channel', 'chan.claim': 'Check & claim bonus',
      'chan.checking': 'Checking subscription…', 'chan.claimed': '🎉 Subscription bonus: +{n} 🍪',
      'chan.already': 'Subscription bonus already claimed ✓', 'chan.notSub': 'Subscription not found — subscribe, then tap "Check"',
      'off.title': 'Welcome back!', 'off.sub': 'While you were away, you baked:',
      'off.claim': 'Claim', 'off.x2main': 'Claim ×2 for {n} ⭐', 'off.x2sub': 'you get {n} 🍪',
      'off.processing': 'Waiting for payment confirmation…',
      'fr.statHead': '🤝 What your friends earn you', 'fr.activeFriends': 'Active friends',
      'fr.boost': 'Production boost', 'fr.offlineFull': 'Offline at full speed',
      'fr.offlineBoost': '🚀 Offline uncapped', 'fr.invite': '📤 Invite a friend',
      'fr.rewardsHead': '🏅 Friend rewards', 'fr.lbHead': '🏆 Top by friends',
      'fr.weekly': 'This week', 'fr.alltime': 'All time',
      'onb.clickHint': '👆 Tap the cookie!', 'onb.upgradeHint': 'Buy an upgrade — cookies pile up faster',
      'onb.welcomeBonus': '🎁 Welcome bonus: +{n} cookies!',
      'unlock.title': 'New building unlocked!', 'unlock.place': 'Place',
      'evt.happyHour': '🎉 Cookie Hour', 'evt.weekend': '🎊 Cookie Weekend',
      'ms.skin': 'Cookie skin', 'ms.bakery': 'Friendship Bakery',
      'ms.title25': 'Title “Social Cookie”', 'ms.title50': 'Title “Cookie Legend”', 'ms.title100': 'Title “Cookie Emperor”',
      'ms.open': '✓ Unlocked', 'ms.left': '{n} left',
      'ms.nextReward': '{n} more {friends} to unlock “{label}”', 'ms.allOpen': 'All friend rewards unlocked! 👑',
      'title.social': 'Social Cookie', 'title.legend': 'Cookie Legend', 'title.emperor': 'Cookie Emperor',
      'title.none': 'No title yet',
      'ptitle.celestial': 'Celestial', 'ptitle.creator': 'World Creator',
      'fr.offlineExtra': '{cap} · +{extra} from friends',
      'lb.explainer': '🏅 {crit}', 'lb.criterion': 'Rank: by ascensions, then by production speed',
      'lb.lifetime': '🍪 {n} all-time', 'lb.perSec': '/sec', 'lb.pioneer': '🚩 Pioneer',
      'lb.you': 'You', 'lb.yourPlace': 'Your place', 'lb.selfOf': 'of {total}',
      'lb.global': '🌍 Global', 'lb.myCountry': 'My country', 'lb.friendsView': '🤝 Friends',
      'lb.emptyFriends': 'Invite friends — then race to see who climbs higher!',
      'lb.rival': '⚡ {n}/sec more and you pass {name}!', 'lb.rankJump': '🚀 +{n} {w} on the board!',
      'lb.momentum': '🔥 {name} climbed {n} {w} this hour',
      'lb.allTime': 'All time', 'lb.thisWeek': 'This week',
      'lb.criterionWeek': 'This week: by ascensions, then by cookies baked',
      'lb.weekAsc': '⭐ +{n} {w} this week', 'lb.weekBakedLabel': '🍪 baked this week',
      'lb.perWeek': '/wk', 'lb.emptyWeek': 'No one has scored yet this week — be the first!',
      'lb.weekTimer': '⏳ Week ends in {t}',
      'lb.empty': 'No one here yet — be the first!', 'lb.loading': 'Loading…',
      'lb.comingSoon': 'Leaderboard coming soon', 'lb.loadFail': 'Couldn’t load the leaderboard. Try again later.',
      'lb.refActive': '🤝 active friends', 'lb.refWord': '{word}',
      'refLb.emptyWeek': 'No one invited friends this week — be the first! 🤝',
      'refLb.emptyAll': 'No one has brought friends yet — be the first! 🤝', 'refLb.loadFail': 'Couldn’t load. Try again later.',
      'toast.onlyTelegram': 'Available only in Telegram', 'toast.payOnlyTelegram': 'Payments available only in Telegram',
      'toast.dailyClaimed': '🎁 Day {d}: +{n} 🍪', 'toast.ascended': '⭐ Ascension! Permanent bonus is now +{n}% to production',
      'toast.boughtUpgrade': 'Purchased!', 'toast.notEnough': 'Not enough cookies',
      'content.remain': '{b} {bw} and {u} {uw}',
      'banner.allBought': 'All bought! 🎉', 'banner.availSub': 'Time to ascend — +{n}% to production forever',
      'banner.almostAll': 'Almost everything bought! 🎉', 'banner.soonSub': 'Ascension unlocks soon — left: {rest}',
      'banner.cta': 'Ascend',
      // Priority-2: upgrade effect/req/desc, categories, stats, deep toasts, confirms
      'up.effClick': 'Click power: {a} → {b}', 'up.effGlobal': 'All production: {a} → {b}/sec',
      'up.effBuilding': '{name}: {a} → {b}/sec each',
      'up.reqBuilding': '🔒 Unlocks: buy {icon} {name}', 'up.reqClicks': '🔒 Unlocks: {n} clicks (done {d})',
      'up.reqBaked': '🔒 Unlocks: {n} cookies baked',
      'up.progress': '🏆 Upgrades (tier {t}): <b>{b}</b> / {total}', 'up.completed': 'Completed ({n})',
      'up.emptyGrow': 'Upgrades appear as your production grows', 'up.emptyAll': '🎉 All upgrades purchased!',
      'up.emptyDone': "Everything available is bought — more unlocks as production grows",
      'cat.click': '⚡ Click upgrades', 'cat.building': '🏭 Building upgrades', 'cat.global': '✨ Global',
      'tier.lockAfter': 'Unlocks after ascension {n}',
      'ref.buildingLocked': 'Unlocks at {n} active friends',
      'ref.ready': 'Ready to place — free', 'ref.gift': '🫶 gift of friends', 'ref.placedSub': '{n}/sec',
      'bld.persecEach': '{n}/sec each',
      'ref.unlockDesc': 'Reward for {n} active friends. Placed for free and bakes alongside your army!',
      'teaser.readySub': 'Unlocked! Tap to place', 'teaser.readyCta': 'Place',
      'teaser.sub': '{n} more {friends} — special building', 'teaser.cta': 'Invite',
      'player.default': 'Player',
      'stat.totalBaked': 'Total baked', 'stat.clicks': 'Clicks made', 'stat.cps': 'Cookies per second',
      'stat.clickPower': 'Click power', 'stat.clickUpg': 'Click upgrades', 'stat.buildings': 'Buildings total',
      'stat.upgrades': 'Upgrades bought', 'stat.streak': 'Day streak', 'stat.ascensions': 'Ascensions',
      'toast.offlineBaked': 'While you were away, baked {n} 🍪',
      'toast.noBackup': 'No backup found', 'toast.restored': '✅ Restored: {n} 🍪, tier {t}',
      'toast.backupCorrupt': 'Backup is corrupted',
      'toast.cloudUnavailable': 'CloudStorage unavailable on this device', 'toast.cloudPushFail': 'Failed to upload to cloud',
      'toast.cloudPushOk': '✅ This save was uploaded to the cloud', 'toast.cloudEmpty': 'Cloud is empty or failed to load',
      'toast.cloudCorrupt': 'Cloud save is corrupted', 'toast.cloudPullOk': '✅ Loaded from cloud (backup saved)',
      'toast.cloudParseFail': 'Failed to parse cloud save',
      'toast.offlineX2Credited': '🍪 ×2 offline income credited: +{n}', 'toast.nocapOn': '🚀 Offline cap removed for 24 hours!',
      'toast.boost2xOn': '⚡ ×2 production active for 1 hour!', 'toast.permOn': '🌟 +10% production forever!',
      'toast.clickBypassOn': '⚡ Click upgrades unlocked without clicks!', 'toast.upgradeUnlockedGeneric': '🔓 Upgrade unlocked!',
      'toast.lbPrestige': '{n} {word} — permanent +{x}% production bonus',
      'toast.lbPioneer': 'One of the first {n} players to ascend — an exclusive title, no longer awarded',
      'toast.ascendGate': 'Buy everything first — remaining: {rest}', 'toast.ascendTooEarly': 'Too early — bake more cookies to grow the bonus',
      'toast.ascendTooSoon': 'Ascension will be available a bit later — play a little between rebirths',
      'toast.newTitle': '{icon} New title: "{name}" — you reached tier {n}!', 'toast.offlineFreeClaimed': 'Claimed {n} 🍪',
      'toast.payX2': 'Payment accepted — crediting ×2…', 'toast.payFailed': 'Payment failed — try again',
      'toast.invoiceFail': 'Could not create invoice — try later', 'toast.payNocap': 'Payment accepted — removing cap…',
      'toast.payBoost2x': 'Payment accepted — enabling ×2…', 'toast.alreadyOwned': 'Already purchased ✓',
      'toast.payPerm': 'Payment accepted — activating +10%…', 'toast.payClickBypass': 'Payment accepted — unlocking click upgrades…',
      'toast.alreadyUnlocked': 'Already unlocked ✓', 'toast.payUpgradeSkip': 'Payment accepted — unlocking "{name}"…',
      'toast.buildingPlaced': '{icon} {name} placed!', 'toast.prestigeSoonNudge': 'Remaining: {rest} — buy it to unlock ascension',
      'toast.boughtNamed': 'Purchased: {name}', 'toast.offlineHint': '🍪 Cookies pile up even while you are away — come back later for your loot',
      'toast.frenzy': '🔥 Cookie frenzy! x7 for 30 sec', 'toast.golden': '✨ Golden cookie! +{n}',
      'confirm.ascend': 'Ascend? Progress resets, but you permanently gain +{n}% production.',
      'confirm.reset': 'Really reset all progress?',
      'sync.ok': '☁️ Telegram cloud — synced across devices',
      'sync.noTg': '📱 Not in Telegram — saved only in this browser',
      'sync.noApi': '⚠️ CloudStorage unavailable — saved only on this device',
      'sync.oldVer': '⚠️ Telegram version too old for cloud — saved only on this device',
      'confirm.cloudPush': 'This device: {here} 🍪 baked.\nIn the cloud now: {cloud} 🍪 baked.\n\nReplace the cloud save with the data from this device?',
      'confirm.cloudPull': 'This device: {here} 🍪 baked.\nIn the cloud: {cloud} 🍪 baked.\n\nReplace this device progress with the cloud save? (current state is saved as a backup)',
      'share.text': 'Hooked on Cookie Clicker — come bake cookies with me! 🍪',
      'evt.refReward': '🎉 Friend reward ×{mult}', 'evt.callFriends': 'invite friends!',
    },
  };

  function t(key, vars) {
    const lang = (typeof state !== 'undefined' && state && state.lang) || detectLang();
    const table = STRINGS[lang] || STRINGS.en;
    let s = table[key];
    if (s == null) s = STRINGS.en[key];
    if (s == null) return key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  // Fill every static [data-i18n] element from the table (called on load and
  // whenever the language changes). Dynamic strings use t() in their renderers.
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(node => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    // Highlight the active language button in Settings.
    const lang = (state && state.lang) || detectLang();
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  }

  function setLang(lang) {
    if (lang !== 'ru' && lang !== 'en') return;
    state.lang = lang;
    saveState();
    applyStaticI18n();
    refreshAll();
  }

  // ---------- Game data ----------
  // Optional `tier` on a building/upgrade = required prestige (ascension) count
  // to unlock it; 0/absent = always available. See tierUnlocked()/itemTier().
  // Tier-2+ content itself is a separate design pass — this is just the config
  // slot the gate reads.
  const BUILDINGS = [
    { id: 'cursor',   name: 'Курсор',        icon: '👆', baseCost: 15,      baseCps: 0.1  },
    { id: 'grandma',  name: 'Бабушка',       icon: '👵', baseCost: 100,     baseCps: 1    },
    { id: 'farm',     name: 'Ферма',         icon: '🌾', baseCost: 1100,    baseCps: 8    },
    { id: 'mine',     name: 'Шахта',         icon: '⛏️', baseCost: 12000,   baseCps: 47   },
    { id: 'factory',  name: 'Фабрика',       icon: '🏭', baseCost: 130000,  baseCps: 260  },
    { id: 'bank',     name: 'Банк',          icon: '🏦', baseCost: 1400000, baseCps: 1400 },
    { id: 'temple',   name: 'Храм',          icon: '⛩️', baseCost: 20000000, baseCps: 7800 },
    { id: 'lab',      name: 'Лаборатория',   icon: '🧪', baseCost: 330000000, baseCps: 44000 },
    { id: 'portal',   name: 'Портал',        icon: '🌀', baseCost: 3000000000, baseCps: 260000 },
    { id: 'timeMachine', name: 'Машина времени', icon: '⏳', baseCost: 27000000000, baseCps: 1600000 },
    { id: 'antimatter', name: 'Антиматерия', icon: '⚛️', baseCost: 240000000000, baseCps: 10000000 },
    { id: 'prism',    name: 'Призма',        icon: '🔷', baseCost: 2200000000000, baseCps: 65000000 },
    { id: 'quasar',   name: 'Квазар',        icon: '☄️', baseCost: 21000000000000, baseCps: 420000000 },
    { id: 'pulsar',   name: 'Пульсар',       icon: '💫', baseCost: 200000000000000, baseCps: 2700000000 },
    { id: 'supernova', name: 'Сверхновая',   icon: '💥', baseCost: 1900000000000000, baseCps: 17000000000 },
    { id: 'cosmicString', name: 'Космическая струна', icon: '🧵', baseCost: 18000000000000000, baseCps: 110000000000 },
    { id: 'primeMover', name: 'Первопричина', icon: '🌟', baseCost: 170000000000000000, baseCps: 700000000000 },
    // --- Tier 2 (Золотой век): unlocked after the 1st ascension (tier: 1).
    // New golden/chocolate-themed lineup that continues the cost×9.5 / cps×6.4
    // progression beyond Первопричина. Balance-wise these are meant for a
    // prestige player who already has a crumb multiplier.
    { id: 'chocoSpring',    name: 'Шоколадный источник', icon: '🍫', baseCost: 1.6e18, baseCps: 4.5e12, tier: 1 },
    { id: 'goldHive',       name: 'Золотой улей',        icon: '🍯', baseCost: 1.5e19, baseCps: 2.9e13, tier: 1 },
    { id: 'royalBakery',    name: 'Королевская пекарня', icon: '👑', baseCost: 1.4e20, baseCps: 1.85e14, tier: 1 },
    { id: 'diamondGlaze',   name: 'Алмазная глазуровка', icon: '💎', baseCost: 1.3e21, baseCps: 1.2e15, tier: 1 },
    { id: 'solarOven',      name: 'Солнечная печь',      icon: '☀️', baseCost: 1.2e22, baseCps: 7.6e15, tier: 1 },
    { id: 'caramelVolcano', name: 'Карамельный вулкан',  icon: '🌋', baseCost: 1.1e23, baseCps: 4.8e16, tier: 1 },
    { id: 'ambrosiaWell',   name: 'Источник амброзии',   icon: '⚱️', baseCost: 1.0e24, baseCps: 3.1e17, tier: 1 },
    { id: 'goldenArk',      name: 'Золотой ковчег',      icon: '⚜️', baseCost: 9.5e24, baseCps: 2.0e18, tier: 1 },
    { id: 'cocoaTemple',    name: 'Храм какао',          icon: '🛕', baseCost: 9.0e25, baseCps: 1.3e19, tier: 1 },
    { id: 'midasThrone',    name: 'Трон Мидаса',         icon: '🪙', baseCost: 8.5e26, baseCps: 8.0e19, tier: 1 },
    // --- Tier 3 (Небесная эпоха): unlocked after the 2nd ascension (tier: 2).
    // Celestial/astral lineup continuing the cost×9.4 / cps×6.4 progression
    // beyond Трон Мидаса. For a player who already has 2 ascensions of crumbs.
    { id: 'starBakery',   name: 'Звёздная пекарня',    icon: '⭐', baseCost: 8.0e27, baseCps: 5.1e20, tier: 2 },
    { id: 'moonMill',     name: 'Лунная мельница',     icon: '🌙', baseCost: 7.5e28, baseCps: 3.3e21, tier: 2 },
    { id: 'skyForge',     name: 'Небесный очаг',       icon: '☁️', baseCost: 7.0e29, baseCps: 2.1e22, tier: 2 },
    { id: 'ringWorks',    name: 'Планетарное кольцо',  icon: '🪐', baseCost: 6.6e30, baseCps: 1.3e23, tier: 2 },
    { id: 'galaxyMixer',  name: 'Галактический тестомес', icon: '🌌', baseCost: 6.2e31, baseCps: 8.5e23, tier: 2 },
    { id: 'meteorRain',   name: 'Метеорный дождь',     icon: '🌠', baseCost: 5.8e32, baseCps: 5.4e24, tier: 2 },
    { id: 'bifrost',      name: 'Мост Бифрёст',        icon: '🌈', baseCost: 5.5e33, baseCps: 3.5e25, tier: 2 },
    { id: 'starArk',      name: 'Звёздный ковчег',     icon: '🛸', baseCost: 5.2e34, baseCps: 2.2e26, tier: 2 },
    { id: 'cosmicEye',    name: 'Око вселенной',       icon: '🔭', baseCost: 4.9e35, baseCps: 1.4e27, tier: 2 },
    { id: 'heavenThrone', name: 'Престол небес',       icon: '👼', baseCost: 4.6e36, baseCps: 9.0e27, tier: 2 },
    // Special building: can't be bought for cookies (referralLocked). Unlocked
    // by reaching unlockFriends peak active friends, then placed for free.
    // Its output scales with your peak army size (see buildingCps), so it
    // grows along the same social axis that unlocks it.
    { id: 'friendBakery', name: 'Пекарня дружбы', icon: '🫶', baseCps: 5000, referralLocked: true, unlockFriends: 10 },
  ];

  const UPGRADES = [
    { id: 'cursor_u1', name: 'Наточенные курсоры', desc: 'Курсоры x2', icon: '✌️', cost: 100, category: 'building', buildingId: 'cursor', reqType: 'building', req: b => b.cursor >= 1, effect: s => s.cursorMult *= 2 },
    { id: 'grandma_u1', name: 'Бабушкины рецепты', desc: 'Бабушки x2', icon: '📖', cost: 1000, category: 'building', buildingId: 'grandma', reqType: 'building', req: b => b.grandma >= 1, effect: s => s.buildingMult.grandma *= 2 },
    { id: 'farm_u1', name: 'Удобрения', desc: 'Фермы x2', icon: '🌱', cost: 11000, category: 'building', buildingId: 'farm', reqType: 'building', req: b => b.farm >= 1, effect: s => s.buildingMult.farm *= 2 },
    { id: 'click_u1', name: 'Крепкая хватка', desc: 'Сила клика x2', icon: '💪', cost: 30, category: 'click', reqType: 'clicks', reqValue: 5, req: (b, s) => s.totalClicks >= 5, effect: s => s.clickMult *= 2 },
    { id: 'mine_u1', name: 'Новые кирки', desc: 'Шахты x2', icon: '⚒️', cost: 130000, category: 'building', buildingId: 'mine', reqType: 'building', req: b => b.mine >= 1, effect: s => s.buildingMult.mine *= 2 },
    { id: 'click_u2', name: 'Стальные пальцы', desc: 'Сила клика x2', icon: '🖐️', cost: 10000, category: 'click', reqType: 'clicks', reqValue: 200, req: (b, s) => s.totalClicks >= 200, effect: s => s.clickMult *= 2 },
    { id: 'factory_u1', name: 'Автоматизация', desc: 'Фабрики x2', icon: '⚙️', cost: 1400000, category: 'building', buildingId: 'factory', reqType: 'building', req: b => b.factory >= 1, effect: s => s.buildingMult.factory *= 2 },
    { id: 'global_u1', name: 'Печенье с золотом', desc: 'Всё производство x2', icon: '✨', cost: 5000000, category: 'global', reqType: 'baked', reqValue: 1000000, req: (b, s) => s.totalBaked >= 1000000, effect: s => s.globalMult *= 2 },
    { id: 'bank_u1', name: 'Хрустящие проценты', desc: 'Банки x2', icon: '💰', cost: 20000000, category: 'building', buildingId: 'bank', reqType: 'building', req: b => b.bank >= 1, effect: s => s.buildingMult.bank *= 2 },
    { id: 'temple_u1', name: 'Древние благословения', desc: 'Храмы x2', icon: '🙏', cost: 260000000, category: 'building', buildingId: 'temple', reqType: 'building', req: b => b.temple >= 1, effect: s => s.buildingMult.temple *= 2 },
    { id: 'lab_u1', name: 'Ядерная выпечка', desc: 'Лаборатории x2', icon: '☢️', cost: 3300000000, category: 'building', buildingId: 'lab', reqType: 'building', req: b => b.lab >= 1, effect: s => s.buildingMult.lab *= 2 },
    { id: 'global_u2', name: 'Философский камень выпечки', desc: 'Всё производство x2', icon: '🧪', cost: 220000000, category: 'global', reqType: 'baked', reqValue: 50000000, req: (b, s) => s.totalBaked >= 50000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u3', name: 'Печенье из другого измерения', desc: 'Всё производство x2', icon: '🌌', cost: 3500000000, category: 'global', reqType: 'baked', reqValue: 800000000, req: (b, s) => s.totalBaked >= 800000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u4', name: 'Вселенская выпечка', desc: 'Всё производство x2', icon: '🌠', cost: 50000000000, category: 'global', reqType: 'baked', reqValue: 12000000000, req: (b, s) => s.totalBaked >= 12000000000, effect: s => s.globalMult *= 2 },
    { id: 'portal_u1', name: 'Стабилизатор портала', desc: 'Порталы x2', icon: '🌀', cost: 30000000000, category: 'building', buildingId: 'portal', reqType: 'building', req: b => b.portal >= 1, effect: s => s.buildingMult.portal *= 2 },
    { id: 'timeMachine_u1', name: 'Хроноускоритель', desc: 'Машины времени x2', icon: '⏳', cost: 270000000000, category: 'building', buildingId: 'timeMachine', reqType: 'building', req: b => b.timeMachine >= 1, effect: s => s.buildingMult.timeMachine *= 2 },
    { id: 'antimatter_u1', name: 'Сжатое антивещество', desc: 'Антиматерия x2', icon: '⚛️', cost: 2400000000000, category: 'building', buildingId: 'antimatter', reqType: 'building', req: b => b.antimatter >= 1, effect: s => s.buildingMult.antimatter *= 2 },
    { id: 'prism_u1', name: 'Огранка призмы', desc: 'Призмы x2', icon: '🔷', cost: 22000000000000, category: 'building', buildingId: 'prism', reqType: 'building', req: b => b.prism >= 1, effect: s => s.buildingMult.prism *= 2 },
    { id: 'global_u5', name: 'Печенье-сингулярность', desc: 'Всё производство x2', icon: '🕳️', cost: 700000000000, category: 'global', reqType: 'baked', reqValue: 150000000000, req: (b, s) => s.totalBaked >= 150000000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u6', name: 'Мультивселенная печенек', desc: 'Всё производство x2', icon: '🌈', cost: 9000000000000, category: 'global', reqType: 'baked', reqValue: 2000000000000, req: (b, s) => s.totalBaked >= 2000000000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u7', name: 'Бесконечная выпечка', desc: 'Всё производство x2', icon: '♾️', cost: 115000000000000, category: 'global', reqType: 'baked', reqValue: 26000000000000, req: (b, s) => s.totalBaked >= 26000000000000, effect: s => s.globalMult *= 2 },
    // --- New building upgrades (cosmic tier) ---
    { id: 'quasar_u1', name: 'Квазарный ускоритель', desc: 'Квазары x2', icon: '☄️', cost: 210000000000000, category: 'building', buildingId: 'quasar', reqType: 'building', req: b => b.quasar >= 1, effect: s => s.buildingMult.quasar *= 2 },
    { id: 'pulsar_u1', name: 'Магнитное поле пульсара', desc: 'Пульсары x2', icon: '💫', cost: 2000000000000000, category: 'building', buildingId: 'pulsar', reqType: 'building', req: b => b.pulsar >= 1, effect: s => s.buildingMult.pulsar *= 2 },
    { id: 'supernova_u1', name: 'Управляемый коллапс', desc: 'Сверхновые x2', icon: '💥', cost: 19000000000000000, category: 'building', buildingId: 'supernova', reqType: 'building', req: b => b.supernova >= 1, effect: s => s.buildingMult.supernova *= 2 },
    { id: 'cosmicString_u1', name: 'Натяжение струны', desc: 'Космические струны x2', icon: '🧵', cost: 180000000000000000, category: 'building', buildingId: 'cosmicString', reqType: 'building', req: b => b.cosmicString >= 1, effect: s => s.buildingMult.cosmicString *= 2 },
    { id: 'primeMover_u1', name: 'Замысел творца', desc: 'Первопричины x2', icon: '🌟', cost: 1700000000000000000, category: 'building', buildingId: 'primeMover', reqType: 'building', req: b => b.primeMover >= 1, effect: s => s.buildingMult.primeMover *= 2 },
    // --- New click upgrades ---
    { id: 'click_u3', name: 'Титановые ногти', desc: 'Сила клика x2', icon: '🦾', cost: 200000, category: 'click', reqType: 'clicks', reqValue: 2000, req: (b, s) => s.totalClicks >= 2000, effect: s => s.clickMult *= 2 },
    { id: 'click_u4', name: 'Космический щелчок', desc: 'Сила клика x2', icon: '👊', cost: 4000000, category: 'click', reqType: 'clicks', reqValue: 10000, req: (b, s) => s.totalClicks >= 10000, effect: s => s.clickMult *= 2, skipStars: 20 },
    // --- New global upgrades ---
    { id: 'global_u8', name: 'Космическая закваска', desc: 'Всё производство x2', icon: '💠', cost: 1500000000000000, category: 'global', reqType: 'baked', reqValue: 340000000000000, req: (b, s) => s.totalBaked >= 340000000000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u9', name: 'Пекарня богов', desc: 'Всё производство x2', icon: '🔆', cost: 20000000000000000, category: 'global', reqType: 'baked', reqValue: 4500000000000000, req: (b, s) => s.totalBaked >= 4500000000000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u10', name: 'Печенька-творец', desc: 'Всё производство x2', icon: '🎆', cost: 260000000000000000, category: 'global', reqType: 'baked', reqValue: 60000000000000000, req: (b, s) => s.totalBaked >= 60000000000000000, effect: s => s.globalMult *= 2 },
    // ===== Tier 2 (Золотой век) — unlocked after 1st ascension (tier: 1) =====
    // Building ×2 upgrades, one per tier-2 building (cost = building base ×10).
    { id: 'chocoSpring_u1',    name: 'Бельгийский рецепт',    desc: 'Шоколадные источники x2', icon: '🍮', cost: 1.6e19, category: 'building', buildingId: 'chocoSpring',    reqType: 'building', req: b => b.chocoSpring >= 1,    effect: s => s.buildingMult.chocoSpring *= 2, tier: 1 },
    { id: 'goldHive_u1',       name: 'Золотые пчёлы',         desc: 'Золотые ульи x2',        icon: '🐝', cost: 1.5e20, category: 'building', buildingId: 'goldHive',       reqType: 'building', req: b => b.goldHive >= 1,       effect: s => s.buildingMult.goldHive *= 2, tier: 1 },
    { id: 'royalBakery_u1',    name: 'Королевский патент',    desc: 'Королевские пекарни x2',  icon: '📜', cost: 1.4e21, category: 'building', buildingId: 'royalBakery',    reqType: 'building', req: b => b.royalBakery >= 1,    effect: s => s.buildingMult.royalBakery *= 2, tier: 1 },
    { id: 'diamondGlaze_u1',   name: 'Идеальная огранка',     desc: 'Алмазная глазуровка x2',  icon: '✨', cost: 1.3e22, category: 'building', buildingId: 'diamondGlaze',   reqType: 'building', req: b => b.diamondGlaze >= 1,   effect: s => s.buildingMult.diamondGlaze *= 2, tier: 1 },
    { id: 'solarOven_u1',      name: 'Термоядерный жар',      desc: 'Солнечные печи x2',      icon: '🔆', cost: 1.2e23, category: 'building', buildingId: 'solarOven',      reqType: 'building', req: b => b.solarOven >= 1,      effect: s => s.buildingMult.solarOven *= 2, tier: 1 },
    { id: 'caramelVolcano_u1', name: 'Жжёный сахар',          desc: 'Карамельные вулканы x2',  icon: '🍬', cost: 1.1e24, category: 'building', buildingId: 'caramelVolcano', reqType: 'building', req: b => b.caramelVolcano >= 1, effect: s => s.buildingMult.caramelVolcano *= 2, tier: 1 },
    { id: 'ambrosiaWell_u1',   name: 'Дар богов',             desc: 'Источники амброзии x2',  icon: '🏺', cost: 1.0e25, category: 'building', buildingId: 'ambrosiaWell',   reqType: 'building', req: b => b.ambrosiaWell >= 1,   effect: s => s.buildingMult.ambrosiaWell *= 2, tier: 1 },
    { id: 'goldenArk_u1',      name: 'Священный ковчег',      desc: 'Золотые ковчеги x2',      icon: '📯', cost: 9.5e25, category: 'building', buildingId: 'goldenArk',      reqType: 'building', req: b => b.goldenArk >= 1,      effect: s => s.buildingMult.goldenArk *= 2, tier: 1 },
    { id: 'cocoaTemple_u1',    name: 'Древний ритуал',        desc: 'Храмы какао x2',         icon: '🕯️', cost: 9.0e26, category: 'building', buildingId: 'cocoaTemple',    reqType: 'building', req: b => b.cocoaTemple >= 1,    effect: s => s.buildingMult.cocoaTemple *= 2, tier: 1 },
    { id: 'midasThrone_u1',    name: 'Прикосновение Мидаса',  desc: 'Троны Мидаса x2',        icon: '🫳', cost: 8.5e27, category: 'building', buildingId: 'midasThrone',    reqType: 'building', req: b => b.midasThrone >= 1,    effect: s => s.buildingMult.midasThrone *= 2, tier: 1 },
    // Global ×2 upgrades (all production).
    { id: 'global_t2_1', name: 'Золотая глазурь',     desc: 'Всё производство x2', icon: '🧁', cost: 4.0e18, category: 'global', reqType: 'baked', reqValue: 8.0e17, req: (b, s) => s.totalBaked >= 8.0e17, effect: s => s.globalMult *= 2, tier: 1 },
    { id: 'global_t2_2', name: 'Шоколадное покрытие', desc: 'Всё производство x2', icon: '🍩', cost: 3.0e20, category: 'global', reqType: 'baked', reqValue: 5.0e19, req: (b, s) => s.totalBaked >= 5.0e19, effect: s => s.globalMult *= 2, tier: 1 },
    { id: 'global_t2_3', name: 'Пыльца фей',          desc: 'Всё производство x2', icon: '🧚', cost: 2.0e22, category: 'global', reqType: 'baked', reqValue: 3.0e21, req: (b, s) => s.totalBaked >= 3.0e21, effect: s => s.globalMult *= 2, tier: 1 },
    { id: 'global_t2_4', name: 'Философское золото',  desc: 'Всё производство x2', icon: '🪙', cost: 1.5e24, category: 'global', reqType: 'baked', reqValue: 2.0e23, req: (b, s) => s.totalBaked >= 2.0e23, effect: s => s.globalMult *= 2, tier: 1 },
    // Click ×2 upgrades.
    { id: 'click_t2_1', name: 'Золотое касание',   desc: 'Сила клика x2', icon: '🫰', cost: 1.0e8,  category: 'click', reqType: 'clicks', reqValue: 50000,  req: (b, s) => s.totalClicks >= 50000,  effect: s => s.clickMult *= 2, tier: 1, skipStars: 40 },
    { id: 'click_t2_2', name: 'Шоколадная длань',  desc: 'Сила клика x2', icon: '🖐️', cost: 1.0e10, category: 'click', reqType: 'clicks', reqValue: 100000, req: (b, s) => s.totalClicks >= 100000, effect: s => s.clickMult *= 2, tier: 1, skipStars: 60 },
    // ===== Tier 3 (Небесная эпоха) — unlocked after 2nd ascension (tier: 2) =====
    // Building ×2 upgrades, one per tier-3 building (cost = building base ×10).
    { id: 'starBakery_u1',   name: 'Звёздная пыль',        desc: 'Звёздные пекарни x2',      icon: '✨', cost: 8.0e28, category: 'building', buildingId: 'starBakery',   reqType: 'building', req: b => b.starBakery >= 1,   effect: s => s.buildingMult.starBakery *= 2, tier: 2 },
    { id: 'moonMill_u1',     name: 'Лунное притяжение',    desc: 'Лунные мельницы x2',       icon: '🌗', cost: 7.5e29, category: 'building', buildingId: 'moonMill',     reqType: 'building', req: b => b.moonMill >= 1,     effect: s => s.buildingMult.moonMill *= 2, tier: 2 },
    { id: 'skyForge_u1',     name: 'Небесное пламя',       desc: 'Небесные очаги x2',        icon: '🔥', cost: 7.0e30, category: 'building', buildingId: 'skyForge',     reqType: 'building', req: b => b.skyForge >= 1,     effect: s => s.buildingMult.skyForge *= 2, tier: 2 },
    { id: 'ringWorks_u1',    name: 'Идеальная орбита',     desc: 'Планетарные кольца x2',    icon: '💫', cost: 6.6e31, category: 'building', buildingId: 'ringWorks',    reqType: 'building', req: b => b.ringWorks >= 1,    effect: s => s.buildingMult.ringWorks *= 2, tier: 2 },
    { id: 'galaxyMixer_u1',  name: 'Спиральный рукав',     desc: 'Галактические тестомесы x2', icon: '🌀', cost: 6.2e32, category: 'building', buildingId: 'galaxyMixer',  reqType: 'building', req: b => b.galaxyMixer >= 1,  effect: s => s.buildingMult.galaxyMixer *= 2, tier: 2 },
    { id: 'meteorRain_u1',   name: 'Метеорный поток',      desc: 'Метеорные дожди x2',       icon: '☄️', cost: 5.8e33, category: 'building', buildingId: 'meteorRain',   reqType: 'building', req: b => b.meteorRain >= 1,   effect: s => s.buildingMult.meteorRain *= 2, tier: 2 },
    { id: 'bifrost_u1',      name: 'Радужный код',         desc: 'Мосты Бифрёст x2',         icon: '🌉', cost: 5.5e34, category: 'building', buildingId: 'bifrost',      reqType: 'building', req: b => b.bifrost >= 1,      effect: s => s.buildingMult.bifrost *= 2, tier: 2 },
    { id: 'starArk_u1',      name: 'Варп-двигатель',       desc: 'Звёздные ковчеги x2',      icon: '🚀', cost: 5.2e35, category: 'building', buildingId: 'starArk',      reqType: 'building', req: b => b.starArk >= 1,      effect: s => s.buildingMult.starArk *= 2, tier: 2 },
    { id: 'cosmicEye_u1',    name: 'Всевидящий взор',      desc: 'Очи вселенной x2',         icon: '👁️', cost: 4.9e36, category: 'building', buildingId: 'cosmicEye',    reqType: 'building', req: b => b.cosmicEye >= 1,    effect: s => s.buildingMult.cosmicEye *= 2, tier: 2 },
    { id: 'heavenThrone_u1', name: 'Божественный мандат',  desc: 'Престолы небес x2',        icon: '😇', cost: 4.6e37, category: 'building', buildingId: 'heavenThrone', reqType: 'building', req: b => b.heavenThrone >= 1, effect: s => s.buildingMult.heavenThrone *= 2, tier: 2 },
    // Global ×2 upgrades (all production).
    { id: 'global_t3_1', name: 'Звёздное вещество',    desc: 'Всё производство x2', icon: '🌟', cost: 1.0e26, category: 'global', reqType: 'baked', reqValue: 1.4e25, req: (b, s) => s.totalBaked >= 1.4e25, effect: s => s.globalMult *= 2, tier: 2 },
    { id: 'global_t3_2', name: 'Тёмная материя',       desc: 'Всё производство x2', icon: '🌑', cost: 7.0e27, category: 'global', reqType: 'baked', reqValue: 9.0e26, req: (b, s) => s.totalBaked >= 9.0e26, effect: s => s.globalMult *= 2, tier: 2 },
    { id: 'global_t3_3', name: 'Космическая гармония', desc: 'Всё производство x2', icon: '🎼', cost: 4.5e29, category: 'global', reqType: 'baked', reqValue: 6.0e28, req: (b, s) => s.totalBaked >= 6.0e28, effect: s => s.globalMult *= 2, tier: 2 },
    { id: 'global_t3_4', name: 'Воля вселенной',       desc: 'Всё производство x2', icon: '🌟', cost: 3.0e31, category: 'global', reqType: 'baked', reqValue: 4.0e30, req: (b, s) => s.totalBaked >= 4.0e30, effect: s => s.globalMult *= 2, tier: 2 },
    // Click ×2 upgrades (covered by the 100⭐ click-bypass boost; no per-upgrade skip).
    { id: 'click_t3_1', name: 'Астральный щелчок', desc: 'Сила клика x2', icon: '👆', cost: 1.0e12, category: 'click', reqType: 'clicks', reqValue: 200000, req: (b, s) => s.totalClicks >= 200000, effect: s => s.clickMult *= 2, tier: 2 },
    { id: 'click_t3_2', name: 'Длань творца',      desc: 'Сила клика x2', icon: '✋', cost: 1.0e14, category: 'click', reqType: 'clicks', reqValue: 400000, req: (b, s) => s.totalClicks >= 400000, effect: s => s.clickMult *= 2, tier: 2 },
  ];

  // English names for every building + upgrade (Priority-2 localization). The RU
  // name lives in the config above; here's its EN counterpart keyed by id. Descs
  // are formulaic (see upgradeDescText) so only names need a table.
  const EN_NAMES = {
    // buildings
    cursor: 'Cursor', grandma: 'Grandma', farm: 'Farm', mine: 'Mine', factory: 'Factory',
    bank: 'Bank', temple: 'Temple', lab: 'Laboratory', portal: 'Portal', timeMachine: 'Time Machine',
    antimatter: 'Antimatter', prism: 'Prism', quasar: 'Quasar', pulsar: 'Pulsar', supernova: 'Supernova',
    cosmicString: 'Cosmic String', primeMover: 'Prime Mover',
    chocoSpring: 'Chocolate Spring', goldHive: 'Golden Hive', royalBakery: 'Royal Bakery',
    diamondGlaze: 'Diamond Glaze', solarOven: 'Solar Oven', caramelVolcano: 'Caramel Volcano',
    ambrosiaWell: 'Ambrosia Well', goldenArk: 'Golden Ark', cocoaTemple: 'Cocoa Temple', midasThrone: 'Midas Throne',
    starBakery: 'Star Bakery', moonMill: 'Moon Mill', skyForge: 'Sky Forge', ringWorks: 'Planetary Ring',
    galaxyMixer: 'Galaxy Mixer', meteorRain: 'Meteor Rain', bifrost: 'Bifrost Bridge', starArk: 'Star Ark',
    cosmicEye: 'Eye of the Universe', heavenThrone: "Heaven's Throne", friendBakery: 'Friendship Bakery',
    // upgrades
    cursor_u1: 'Sharpened Cursors', grandma_u1: "Grandma's Recipes", farm_u1: 'Fertilizer',
    click_u1: 'Firm Grip', mine_u1: 'New Pickaxes', click_u2: 'Steel Fingers', factory_u1: 'Automation',
    global_u1: 'Gold-Flecked Cookie', bank_u1: 'Crunchy Interest', temple_u1: 'Ancient Blessings',
    lab_u1: 'Nuclear Baking', global_u2: "Baker's Philosopher Stone", global_u3: 'Cookie from Another Dimension',
    global_u4: 'Universal Baking', portal_u1: 'Portal Stabilizer', timeMachine_u1: 'Chrono Accelerator',
    antimatter_u1: 'Compressed Antimatter', prism_u1: 'Prism Cut', global_u5: 'Singularity Cookie',
    global_u6: 'Cookie Multiverse', global_u7: 'Infinite Baking', quasar_u1: 'Quasar Accelerator',
    pulsar_u1: 'Pulsar Magnetic Field', supernova_u1: 'Controlled Collapse', cosmicString_u1: 'String Tension',
    primeMover_u1: "Creator's Design", click_u3: 'Titanium Nails', click_u4: 'Cosmic Click',
    global_u8: 'Cosmic Leaven', global_u9: 'Bakery of the Gods', global_u10: 'Creator Cookie',
    chocoSpring_u1: 'Belgian Recipe', goldHive_u1: 'Golden Bees', royalBakery_u1: 'Royal Patent',
    diamondGlaze_u1: 'Perfect Cut', solarOven_u1: 'Thermonuclear Heat', caramelVolcano_u1: 'Burnt Sugar',
    ambrosiaWell_u1: 'Gift of the Gods', goldenArk_u1: 'Sacred Ark', cocoaTemple_u1: 'Ancient Ritual',
    midasThrone_u1: 'Midas Touch', global_t2_1: 'Golden Glaze', global_t2_2: 'Chocolate Coating',
    global_t2_3: 'Fairy Dust', global_t2_4: "Philosopher's Gold", click_t2_1: 'Golden Touch',
    click_t2_2: 'Chocolate Hand', starBakery_u1: 'Stardust', moonMill_u1: 'Lunar Gravity',
    skyForge_u1: 'Celestial Flame', ringWorks_u1: 'Perfect Orbit', galaxyMixer_u1: 'Spiral Arm',
    meteorRain_u1: 'Meteor Stream', bifrost_u1: 'Rainbow Code', starArk_u1: 'Warp Drive',
    cosmicEye_u1: 'All-Seeing Gaze', heavenThrone_u1: 'Divine Mandate', global_t3_1: 'Star Matter',
    global_t3_2: 'Dark Matter', global_t3_3: 'Cosmic Harmony', global_t3_4: 'Will of the Universe',
    click_t3_1: 'Astral Click', click_t3_2: "Creator's Hand",
  };
  // Localized display name for a building or upgrade (EN table falls back to the
  // RU config name). One helper for both — they're keyed the same way.
  function itemName(item) {
    return (state.lang === 'en' && EN_NAMES[item.id]) ? EN_NAMES[item.id] : item.name;
  }
  // Localized upgrade description. Descs are formulaic, so we build them from the
  // category (+ the target building's localized name) instead of a per-item table.
  function upgradeDescText(u) {
    if (state.lang !== 'en') return u.desc;
    if (u.category === 'global') return 'All production ×2';
    if (u.category === 'click') return 'Click power ×2';
    const b = BUILDINGS.find(x => x.id === u.buildingId);
    return `${b ? itemName(b) : ''} ×2`;
  }

  // Category labels are localized via t('cat.'+category); order only here.
  const CATEGORY_ORDER = ['click', 'building', 'global'];
  const CLICK_UPGRADES_TOTAL = UPGRADES.filter(u => u.category === 'click').length;

  // Referral titles, unlocked by peak active-friend count (max_active_friends_ever
  // on the server — never the live count, so a title never regresses when a
  // friend goes inactive). Ascending by threshold. Also used to render other
  // players' titles in the leaderboard from their maxActiveFriendsEver.
  const TITLES = [
    { threshold: 25,  nameKey: 'title.social',  icon: '🍪' },
    { threshold: 50,  nameKey: 'title.legend',  icon: '⭐' },
    { threshold: 100, nameKey: 'title.emperor', icon: '👑' },
  ];

  function titleFor(peak) {
    let found = null;
    for (const t of TITLES) if ((peak || 0) >= t.threshold) found = t;
    return found; // highest unlocked title, or null
  }

  function nextTitle(peak) {
    for (const t of TITLES) if ((peak || 0) < t.threshold) return t;
    return null; // all unlocked
  }

  // Prestige-tier milestone titles (Task #15, tiers 5 & 10). Keyed by the
  // player-facing tier number (= ascensionCount + 1). Earning one is the "light
  // milestone" for those tiers on top of the reskin + new cookie art. Computed
  // purely from prestige count, so it also renders for other players in the
  // leaderboard (from their prestigeCount) with no server change.
  const PRESTIGE_TITLES = [
    { tier: 5,  nameKey: 'ptitle.celestial', icon: '😇' },
    { tier: 10, nameKey: 'ptitle.creator',   icon: '🌌' },
  ];
  function prestigeTitleForTier(dt) {
    let found = null;
    for (const t of PRESTIGE_TITLES) if ((dt || 0) >= t.tier) found = t;
    return found; // highest earned milestone title, or null
  }

  // Full referral reward track (Layer 3a, Task #3): every friend milestone in
  // one place. 3 → cookie skin (Layer 3c, art pending — shown as a goal), 10 →
  // «Пекарня дружбы» building, 25/50/100 → titles (mirrors TITLES). Keyed off
  // peak friends so a node never re-locks when a friend goes inactive.
  const REF_MILESTONES = [
    { n: 3,   icon: '🎨', labelKey: 'ms.skin' },
    { n: 10,  icon: '🫶', labelKey: 'ms.bakery' },
    { n: 25,  icon: '🍪', labelKey: 'ms.title25' },
    { n: 50,  icon: '⭐', labelKey: 'ms.title50' },
    { n: 100, icon: '👑', labelKey: 'ms.title100' },
  ];

  const SAVE_KEY = 'cookie_clicker_tma_save_v1';
  const BACKUP_KEY = SAVE_KEY + '_backup';
  const OFFLINE_RATE = 0.1; // after the full-rate window, production drops to this fraction until the player returns

  // Layer 2 "cookie army" perk: active friends extend how long offline
  // production stays at 100% before the OFFLINE_RATE slowdown kicks in.
  // Same saturating-exponential shape as the Layer 1 boost (one continuous
  // curve, no thresholds): BASE hours for everyone, plus up to MAX_EXTRA more
  // as the friend count grows. Knobs live in the same server-side D1 `config`
  // table and arrive on every /checkin; constants below are only the
  // offline / first-load fallback. The post-cap rate (OFFLINE_RATE) is
  // unchanged — only the full-rate duration moves.
  const OFFLINE_BASE_HOURS_DEFAULT = 2; // full-rate hours with zero friends (unchanged baseline)
  const OFFLINE_MAX_EXTRA_DEFAULT = 8;  // max extra full-rate hours a top referrer can reach (asymptote)
  const OFFLINE_TAU_DEFAULT = 35;       // growth constant

  function getOfflineCapHours(n) {
    const base = Number.isFinite(state.offlineBaseHours) ? state.offlineBaseHours : OFFLINE_BASE_HOURS_DEFAULT;
    const maxExtra = Number.isFinite(state.offlineMaxExtra) ? state.offlineMaxExtra : OFFLINE_MAX_EXTRA_DEFAULT;
    const tau = state.offlineTau > 0 ? state.offlineTau : OFFLINE_TAU_DEFAULT;
    return base + maxExtra * (1 - Math.exp(-(n || 0) / tau));
  }

  function offlineFullRateSeconds() {
    return getOfflineCapHours(state.activeReferrals || 0) * 3600;
  }

  // "Cookie army": every friend you invite who becomes active (ref_active,
  // validated server-side) permanently boosts production. Saturating
  // exponential — one continuous curve, no segments or kinks: fast growth
  // early, smoothly easing toward a ceiling of +MAX. MAX and TAU are economy
  // knobs tuned server-side (D1 `config` table) and delivered on every
  // /checkin, so they can change without a frontend release; the constants
  // below are only the offline / first-load fallback. The friend count is
  // likewise server-authoritative, refreshed every checkin.
  const REF_BOOST_MAX_DEFAULT = 1.0; // ceiling: +100% (×2) production for top referrers
  const REF_BOOST_TAU_DEFAULT = 25;  // growth constant: ~63% of MAX at 25 friends

  function referralBoost(n) {
    const max = Number.isFinite(state.refBoostMax) ? state.refBoostMax : REF_BOOST_MAX_DEFAULT;
    const tau = state.refBoostTau > 0 ? state.refBoostTau : REF_BOOST_TAU_DEFAULT;
    return max * (1 - Math.exp(-(n || 0) / tau));
  }

  function referralMultiplier() {
    return 1 + referralBoost(state.activeReferrals || 0);
  }

  // Full-rate window is per-player now (extended by active friends, see
  // getOfflineCapHours). The worker keeps its own base-2h copy for push-text
  // estimates — that's intentionally friend-agnostic, see push/src/index.js.
  function computeOfflineGainNormal(elapsedSeconds, cps) {
    const fullRate = offlineFullRateSeconds();
    if (elapsedSeconds <= fullRate) return elapsedSeconds * cps;
    return fullRate * cps + (elapsedSeconds - fullRate) * cps * OFFLINE_RATE;
  }

  // Income for the first `prefixSec` seconds of the away period, no-cap-aware:
  // the part inside the no-cap window earns 100%, the rest uses the normal
  // cap+taper formula. (nocapSec = seconds of the away period the no-cap boost
  // covered, always from the start.)
  function offlineIncomeForPrefix(prefixSec, cps, nocapSec) {
    const nocapPart = Math.min(prefixSec, nocapSec);
    const normalPart = Math.max(0, prefixSec - nocapSec);
    return nocapPart * cps + computeOfflineGainNormal(normalPart, cps);
  }

  // Offline income with the two time-window boosts applied independently:
  //  - no-cap boost: its window earns 100% (no taper) — the `base` split.
  //  - x2 boost: doubles income earned within its window — add another copy of
  //    that window's (no-cap-aware) income. On subperiods where both are active
  //    they compose (full rate AND x2), which is the v1 "multiply independently
  //    on the overlap" behaviour. No jump at either boundary.
  function computeOfflineGain(elapsedSeconds, cps) {
    const now = Date.now();
    const awayStartMs = now - elapsedSeconds * 1000;
    const secInWindow = (endMs) => Math.max(0, Math.min(elapsedSeconds, (Math.min(now, endMs || 0) - awayStartMs) / 1000));
    const nocapSec = secInWindow(state.boostExpiresAt);
    const x2Sec = secInWindow(state.boost2xExpiresAt);
    const base = offlineIncomeForPrefix(elapsedSeconds, cps, nocapSec);
    const x2Bonus = offlineIncomeForPrefix(x2Sec, cps, nocapSec);
    return base + x2Bonus;
  }

  const CHECKIN_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/checkin';
  const ADSGRAM_INTENT_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/adsgram-intent';
  const ADSGRAM_CANCEL_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/adsgram-cancel';
  // AdsGram rewarded-video Block ID (from the AdsGram dashboard). Platform ID
  // 38246, bot 8767577526. Production block 40881 is approved/active (came out
  // of moderation 03.08.2026); test block was 40903.
  const ADSGRAM_BLOCK_ID = '40881';
  const AD_DAILY_LIMIT_FALLBACK = 8; // used before the first checkin returns the real limit
  const AD_CLICK_BYPASS_TARGET_FALLBACK = 30; // ad views to unlock the click-bypass (real value from checkin)
  const PRESTIGE_CONFIRM_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/prestige/confirm';
  const LEADERBOARD_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/leaderboard';
  const REFERRAL_LEADERBOARD_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/referral-leaderboard';
  const CREATE_OFFLINE_INVOICE_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/create-offline-invoice';
  const CREATE_NOCAP_INVOICE_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/create-nocap-invoice';
  const NOCAP_BOOST_STARS = 30; // must match NOCAP_BOOST_STARS in push/src/index.js
  const CREATE_BOOST2X_INVOICE_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/create-boost2x-invoice';
  const PROD2X_BOOST_STARS = 10; // must match PROD2X_BOOST_STARS in push/src/index.js
  const CREATE_PERM_INVOICE_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/create-perm-invoice';
  const PERM_PROD_STARS = 200; // must match PERM_PROD_STARS in push/src/index.js
  const PERM_PROD_MULT = 1.1;  // +10% permanent production
  const CREATE_CLICKSKIP_INVOICE_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/create-clickskip-invoice';
  const CLICK_BYPASS_STARS = 100; // must match CLICK_BYPASS_STARS in push/src/index.js
  const CREATE_UPGRADE_SKIP_INVOICE_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/create-upgrade-skip-invoice';
  const EVENTS_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/event';
  const CLAIM_CHANNEL_BONUS_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/claim-channel-bonus';
  // Our channels, one per language. The subscription bonus is granted server-side
  // for membership of EITHER channel (see push/handleClaimChannelBonus), but we
  // send each player to THEIR language's channel so the RU loop stays on the RU
  // channel. Routed by state.lang (which respects a manual Settings override).
  const CHANNEL_URL_BY_LANG = {
    ru: 'https://t.me/bestcookiclickerru',  // ⚠ handle has a typo, kept intentionally
    en: 'https://t.me/bestcookieclicker',
  };
  function channelUrl() {
    const lang = (typeof state !== 'undefined' && state && state.lang) || detectLang();
    return CHANNEL_URL_BY_LANG[lang] || CHANNEL_URL_BY_LANG.en;
  }

  // Offline claim: below this, offline income auto-applies silently (as before);
  // at/above it we show the claim card with the free x1 / paid x2 choice.
  const OFFLINE_CLAIM_THRESHOLD_SECONDS = 300; // ~5 min of current production
  const OFFLINE_CLAIM_MIN = 100;               // absolute floor, so low-cps players aren't prompted for crumbs
  const OFFLINE_BOOST_STARS = 15;              // must match OFFLINE_BOOST_STARS in push/src/index.js
  const BOT_USERNAME = 'bestcookieclickerbot';
  const WELCOME_BONUS = 25; // first-launch starting cookies: enough to buy the first building (Cursor, 15) at once, so activation isn't gated on a long click grind (funnel: first_click → first_upgrade drop-off)

  const defaultState = () => ({
    cookies: 0,
    totalBaked: 0,
    totalClicks: 0,
    clickMult: 1,
    cursorMult: 1,
    globalMult: 1,
    buildingMult: Object.fromEntries(BUILDINGS.map(b => [b.id, 1])),
    buildings: Object.fromEntries(BUILDINGS.map(b => [b.id, 0])),
    upgrades: {},
    lastTs: Date.now(),
    dailyStreak: 0,
    lastDailyClaim: 0,
    totalCrumbs: 0,
    ascensionCount: 0,
    activeReferrals: 0, // active friends invited; server-authoritative, refreshed each checkin
    maxActiveFriendsEver: 0, // peak active friends; drives referral titles, never regresses (server-authoritative)
    referralOffered: {}, // per-building flag: unlock popup already shown for this referral building
    refBoostMax: REF_BOOST_MAX_DEFAULT, // cookie-army boost ceiling; overridden by server config on checkin
    refBoostTau: REF_BOOST_TAU_DEFAULT, // cookie-army boost growth constant; overridden by server config on checkin
    offlineBaseHours: OFFLINE_BASE_HOURS_DEFAULT, // Layer 2 offline-cap knobs; overridden by server config on checkin
    offlineMaxExtra: OFFLINE_MAX_EXTRA_DEFAULT,
    offlineTau: OFFLINE_TAU_DEFAULT,
    tutorial: {}, // completed onboarding hints, keyed by step id (e.g. { clicked: true })
    offlinePending: 0, // offline income awaiting a claim (free x1 or paid x2); survives reopen
    boostExpiresAt: 0, // ms epoch of the paid "no offline cap" boost; server-authoritative
    boost2xExpiresAt: 0, // ms epoch of the paid "x2 production 1h" boost; server-authoritative
    hasPermProdBoost: false, // one-time paid "+10% forever"; server-authoritative
    hasClickBypass: false, // one-time paid "skip the click-count requirement on click upgrades"; server-authoritative
    lifetimeBaked: 0, // cookies baked across ALL past runs (never reset on ascend); + current totalBaked = lifetime total
    paidUnlockedUpgrades: [], // upgrade ids whose progress gate was skipped via a paid Stars purchase; server-authoritative
    lang: detectLang(), // 'ru'|'en'; auto from Telegram language_code on first load, then persisted (overridable in Settings)
    adsRewardsUsed: 0,   // rewarded-ad boosts used today (server-authoritative, from checkin)
    adsDailyLimit: 8,    // per-day rewarded-ad cap (server-authoritative, from checkin)
    adClickBypassViews: 0,   // ad views accumulated toward the free click-bypass (server-authoritative)
    adClickBypassTarget: 30, // views needed to unlock the click-bypass (server-authoritative)
    channelBonusClaimed: false, // one-time channel-subscription bonus taken (server-authoritative)
    welcomeBonusGiven: false, // first-launch starting cookies granted once (activation: makes the first purchase reachable without a click grind)
    lastKnownRank: null, // last global leaderboard rank seen (server-authoritative, from checkin); drives the header rank + its ▲/▼ delta
    rankDelta: 0,        // signed change since the previous distinct rank: + = climbed, - = dropped; shown next to the header rank until it changes again
    rankTotal: null,     // total ranked players, for the "#N of M" context
    lastTopRank: null,   // rank the last time the Top tab was opened; drives the "+N places!" open animation (feature: live rank-change)
  });

  let state = defaultState();

  // ---------- Save / Load ----------
  function saveState() {
    // Stamp every save so loadState can pick the FRESHEST store. CloudStorage
    // writes are async and can lag, land out of order, or never arrive if the
    // webview closes right after (e.g. right after an ascension reset), while
    // localStorage is synchronous and always holds this device's latest save.
    // Without this tag loadState preferred CloudStorage unconditionally, so a
    // stale cloud value silently rolled progress back — most visibly a prestige
    // reset reverting on reopen.
    state.saveTs = Date.now();
    const data = JSON.stringify(state);
    if (tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
      tg.CloudStorage.setItem(SAVE_KEY, data, (err, success) => {
        // Swallowed everywhere before — a device whose CloudStorage save
        // silently failed just diverged from every other device forever,
        // with no way to tell why. Not toasting here (autosave runs every
        // 10s, would spam) but at least it's visible in devtools.
        if (err || success === false) console.warn('CloudStorage save failed:', err);
      });
    }
    try { localStorage.setItem(SAVE_KEY, data); } catch (e) {}
  }

  function applyLoaded(raw, opts = {}) {
    if (!raw) return false;
    try {
      const loaded = JSON.parse(raw);
      state = Object.assign(defaultState(), loaded);
      state.buildings = Object.assign(defaultState().buildings, loaded.buildings || {});
      state.buildingMult = Object.assign(defaultState().buildingMult, loaded.buildingMult || {});
      state.upgrades = loaded.upgrades || {};
      if (opts.grantOfflineProgress !== false) {
        // offline progress: full speed for the first 2h, then 10% of normal
        // rate — uncapped duration, cookies always keep baking, just much
        // slower once you've been away a while. Accrue into offlinePending and
        // consume the offline window (reset lastTs) so nothing double-counts on
        // reopen. Small amounts auto-apply silently; big ones wait for a claim
        // card (free x1 / paid x2), shown from afterLoad.
        const elapsed = Math.max(0, (Date.now() - (loaded.lastTs || Date.now())) / 1000);
        const offlineGain = computeOfflineGain(elapsed, getCps());
        state.offlinePending = (state.offlinePending || 0) + Math.max(0, offlineGain);
        state.lastTs = Date.now();
        const threshold = Math.max(OFFLINE_CLAIM_MIN, getCps() * OFFLINE_CLAIM_THRESHOLD_SECONDS);
        if (state.offlinePending > 0 && state.offlinePending < threshold) {
          if (state.offlinePending > 1) showToast(t('toast.offlineBaked', { n: formatNum(state.offlinePending) }));
          state.cookies += state.offlinePending;
          state.totalBaked += state.offlinePending;
          state.offlinePending = 0;
        }
      }
    } catch (e) { return false; }
    refreshAll();
    return true;
  }

  function cloudStorageUsable() {
    return !!(tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9'));
  }

  // Diagnoses *why* two devices might have diverged saves: if this returns
  // anything other than 'ok' on a given device, that device has never been
  // syncing through CloudStorage at all — it's been living in its own
  // browser-local bubble the whole time.
  function cloudStorageStatus() {
    if (!tg) return 'no-telegram';
    if (!tg.CloudStorage) return 'no-cloudstorage-api';
    if (!(tg.isVersionAtLeast && tg.isVersionAtLeast('6.9'))) return 'version-too-old';
    return 'ok';
  }

  function cloudStorageStatusText() {
    switch (cloudStorageStatus()) {
      case 'ok': return t('sync.ok');
      case 'no-telegram': return t('sync.noTg');
      case 'no-cloudstorage-api': return t('sync.noApi');
      default: return t('sync.oldVer');
    }
  }

  // Native window.confirm() is unreliable inside Telegram Mini Apps: several
  // clients suppress the dialog and return a truthy value, so a destructive
  // action (ascend/reset/restore/cloud-overwrite) fires WITHOUT a real
  // confirmation — this caused an accidental ascension. Use Telegram's own
  // showConfirm when available; fall back to native confirm outside Telegram.
  // Always await it (returns a Promise<boolean>).
  function confirmDialog(message) {
    return new Promise((resolve) => {
      if (tg && typeof tg.showConfirm === 'function') {
        try { tg.showConfirm(message, (ok) => resolve(!!ok)); return; }
        catch (e) { /* fall through to native */ }
      }
      resolve(window.confirm(message));
    });
  }

  // One level of undo for any destructive action (pull/reset/ascend) — a
  // snapshot taken right before the action, restorable via restoreBackup().
  function backupCurrentState() {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function restoreBackup() {
    let raw;
    try { raw = localStorage.getItem(BACKUP_KEY); } catch (e) { raw = null; }
    if (!raw) { showToast(t('toast.noBackup')); return; }
    // NOTE: no confirm dialog here on purpose. Restore is a deliberate one-tap
    // "undo" (the button is clearly labelled), and this device's Telegram client
    // handles confirm dialogs unreliably (tg.showConfirm returned cancel even on
    // OK), which was silently blocking recovery. Apply directly and report the
    // restored numbers so it's obvious what came back.
    if (applyLoaded(raw, { grantOfflineProgress: false })) {
      saveState();
      refreshAll();
      showToast(t('toast.restored', { n: formatNum(state.totalBaked || 0), t: (state.ascensionCount || 0) + 1 }), 5000);
    } else {
      showToast(t('toast.backupCorrupt'));
    }
  }

  function pushToCloud() {
    if (!tg || !tg.CloudStorage) { showToast(t('toast.cloudUnavailable')); return; }
    tg.CloudStorage.getItem(SAVE_KEY, async (getErr, existing) => {
      let existingBaked = 0;
      if (!getErr && existing) {
        try { existingBaked = JSON.parse(existing).totalBaked || 0; } catch (e) { /* ignore */ }
      }
      const msg = t('confirm.cloudPush', { here: formatNum(state.totalBaked), cloud: formatNum(existingBaked) });
      if (!(await confirmDialog(msg))) return;
      state.saveTs = Date.now(); // an explicit push is the freshest by intent
      tg.CloudStorage.setItem(SAVE_KEY, JSON.stringify(state), (err, success) => {
        if (err || success === false) { showToast(t('toast.cloudPushFail')); return; }
        showToast(t('toast.cloudPushOk'));
      });
    });
  }

  function pullFromCloud() {
    if (!tg || !tg.CloudStorage) { showToast(t('toast.cloudUnavailable')); return; }
    tg.CloudStorage.getItem(SAVE_KEY, async (err, value) => {
      if (err || !value) { showToast(t('toast.cloudEmpty')); return; }
      let cloudData;
      try { cloudData = JSON.parse(value); } catch (e) { showToast(t('toast.cloudCorrupt')); return; }
      const msg = t('confirm.cloudPull', { here: formatNum(state.totalBaked), cloud: formatNum(cloudData.totalBaked || 0) });
      if (!(await confirmDialog(msg))) return;
      backupCurrentState();
      if (applyLoaded(value, { grantOfflineProgress: false })) {
        saveState();
        showToast(t('toast.cloudPullOk'));
      } else {
        showToast(t('toast.cloudParseFail'));
      }
    });
  }

  // Tells the push worker "this user is active right now", so it holds off
  // on retention nags until they've been away again for a while. Silent
  // no-op outside Telegram (no initData) or before CHECKIN_URL is deployed.
  function sendCheckin() {
    if (!CHECKIN_URL || !tg || !tg.initData) return;
    fetch(CHECKIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        lastDailyClaim: state.lastDailyClaim || 0,
        cps: getCps(),
        totalBaked: state.totalBaked,
        lifetimeCookies: lifetimeCookiesTotal(),
        crumbs: state.totalCrumbs || 0, // permanent bonus % (for the rank-badge tooltip)
        lang: state.lang || 'en', // for localized pushes / bot replies
      }),
    })
      .then(r => r.json())
      .then(data => {
        // Referral reward (as inviter or as invitee) accumulates server-side
        // and gets handed back — and zeroed there — on whichever checkin
        // picks it up first.
        if (data && data.pendingReward > 0) {
          state.cookies += data.pendingReward;
          state.totalBaked += data.pendingReward;
          haptic('heavy');
          showRewardBurst(data.pendingReward);
          saveState();
          refreshAll();
        }
        // Cookie-army size is server-authoritative. Refresh it (and the
        // production boost it drives) whenever the count changes.
        if (data && typeof data.activeReferrals === 'number' && data.activeReferrals !== (state.activeReferrals || 0)) {
          state.activeReferrals = data.activeReferrals;
          saveState();
          refreshAll();
        }
        // Peak army size drives referral titles; monotonic on the server.
        if (data && typeof data.maxActiveFriendsEver === 'number' && data.maxActiveFriendsEver !== (state.maxActiveFriendsEver || 0)) {
          state.maxActiveFriendsEver = data.maxActiveFriendsEver;
          saveState();
          refreshAll();
          maybeOfferReferralBuildings();
        }
        // Cookie-army boost knobs (MAX/TAU) are tuned server-side and pushed
        // down here, so the curve changes without a frontend release.
        if (data && data.refConfig) {
          const m = Number(data.refConfig.max);
          const t = Number(data.refConfig.tau);
          if (Number.isFinite(m) && Number.isFinite(t) && t > 0 && (m !== state.refBoostMax || t !== state.refBoostTau)) {
            state.refBoostMax = m;
            state.refBoostTau = t;
            saveState();
            refreshAll();
          }
        }
        // Layer 2 offline-cap knobs (BASE/MAX_EXTRA/TAU), same server-side
        // config, same release-free tuning.
        if (data && data.offlineConfig) {
          const b = Number(data.offlineConfig.base);
          const mx = Number(data.offlineConfig.maxExtra);
          const t = Number(data.offlineConfig.tau);
          if (Number.isFinite(b) && Number.isFinite(mx) && Number.isFinite(t) && t > 0 &&
              (b !== state.offlineBaseHours || mx !== state.offlineMaxExtra || t !== state.offlineTau)) {
            state.offlineBaseHours = b;
            state.offlineMaxExtra = mx;
            state.offlineTau = t;
            saveState();
            refreshAll();
          }
        }
        // Referral boost event (server-config-driven): show/hide the banner.
        if (data && data.refEvent) {
          refEventInfo = data.refEvent.active ? data.refEvent : null;
          updateRefEventBanner();
        }
        // Paid "2x offline" boost credited by the successful_payment webhook.
        // Server is the source of truth that payment happened; we apply here.
        // credit = frozen amount x2, so credit/2 is the quote to remove from
        // the pending bucket (any residual offline stays claimable).
        if (data && data.paidOfflineCredit > 0) {
          const credit = data.paidOfflineCredit;
          state.cookies += credit;
          state.totalBaked += credit;
          state.offlinePending = Math.max(0, (state.offlinePending || 0) - credit / 2);
          hideOfflineModal();
          haptic('heavy');
          showToast(t('toast.offlineX2Credited', { n: formatNum(credit) }), 4000);
          saveState();
          refreshAll();
        }
        // No-cap boost window is server-authoritative — mirror it locally so the
        // offline calc and the timer UI stay in sync.
        if (data && typeof data.boostExpiresAt === 'number' && data.boostExpiresAt !== (state.boostExpiresAt || 0)) {
          const wasActive = (state.boostExpiresAt || 0) > Date.now();
          state.boostExpiresAt = data.boostExpiresAt;
          saveState();
          refreshAll();
          if (!wasActive && data.boostExpiresAt > Date.now()) showToast(t('toast.nocapOn'), 4000);
        }
        // x2-production boost window (server-authoritative).
        if (data && typeof data.boost2xExpiresAt === 'number' && data.boost2xExpiresAt !== (state.boost2xExpiresAt || 0)) {
          const wasActive = (state.boost2xExpiresAt || 0) > Date.now();
          state.boost2xExpiresAt = data.boost2xExpiresAt;
          saveState();
          refreshAll();
          if (!wasActive && data.boost2xExpiresAt > Date.now()) showToast(t('toast.boost2xOn'), 4000);
        }
        // Rewarded-ad daily counter (server-authoritative). Drives the shop
        // button labels / disabled state.
        if (data && (Number.isFinite(data.adsRewardsUsed) || Number.isFinite(data.adsDailyLimit))) {
          const changed = data.adsRewardsUsed !== state.adsRewardsUsed || data.adsDailyLimit !== state.adsDailyLimit;
          if (Number.isFinite(data.adsRewardsUsed)) state.adsRewardsUsed = data.adsRewardsUsed;
          if (Number.isFinite(data.adsDailyLimit)) state.adsDailyLimit = data.adsDailyLimit;
          if (changed) { saveState(); renderStats(); }
        }
        // Free ad-view progress toward the click-bypass (server-authoritative).
        if (data && (Number.isFinite(data.adClickBypassViews) || Number.isFinite(data.adClickBypassTarget))) {
          const changed = data.adClickBypassViews !== state.adClickBypassViews || data.adClickBypassTarget !== state.adClickBypassTarget;
          if (Number.isFinite(data.adClickBypassViews)) state.adClickBypassViews = data.adClickBypassViews;
          if (Number.isFinite(data.adClickBypassTarget)) state.adClickBypassTarget = data.adClickBypassTarget;
          if (changed) { saveState(); renderStats(); }
        }
        // Prestige count is server-authoritative (grows ONLY via /prestige/confirm).
        // Trust it as the source of truth for the local tier so the client
        // self-heals when it's ahead of the server — e.g. after an admin rollback
        // of an accidental ascension, or a stale cross-device save. In real
        // Telegram the two are always in sync (ascend() sets the local count from
        // the same /prestige/confirm response), so this is a no-op except when
        // correcting a genuine divergence.
        if (data && Number.isFinite(data.prestigeCount) && data.prestigeCount !== (state.ascensionCount || 0)) {
          state.ascensionCount = data.prestigeCount;
          saveState();
          refreshAll();
        }
        // Channel-subscription bonus flag (server-authoritative, one-time): hides
        // the offer everywhere once claimed (or if claimed on another device).
        if (data && typeof data.channelBonusClaimed === 'boolean' && data.channelBonusClaimed !== !!state.channelBonusClaimed) {
          state.channelBonusClaimed = data.channelBonusClaimed;
          saveState();
          refreshAll();
        }
        // Permanent +10% flag (server-authoritative, one-time).
        if (data && typeof data.hasPermProdBoost === 'boolean' && data.hasPermProdBoost !== !!state.hasPermProdBoost) {
          const wasOwned = !!state.hasPermProdBoost;
          state.hasPermProdBoost = data.hasPermProdBoost;
          saveState();
          refreshAll();
          if (!wasOwned && data.hasPermProdBoost) showToast(t('toast.permOn'), 4000);
        }
        // Click-bypass flag (server-authoritative, one-time): skips the click-count
        // requirement on click upgrades.
        if (data && typeof data.hasClickBypass === 'boolean' && data.hasClickBypass !== !!state.hasClickBypass) {
          const wasOwned = !!state.hasClickBypass;
          state.hasClickBypass = data.hasClickBypass;
          saveState();
          refreshAll();
          if (!wasOwned && data.hasClickBypass) showToast(t('toast.clickBypassOn'), 4000);
        }
        // Per-upgrade paid skips (server-authoritative list of upgrade ids).
        if (data && Array.isArray(data.paidUnlockedUpgrades)) {
          const cur = Array.isArray(state.paidUnlockedUpgrades) ? state.paidUnlockedUpgrades : [];
          const added = data.paidUnlockedUpgrades.filter(id => !cur.includes(id));
          if (added.length || cur.length !== data.paidUnlockedUpgrades.length) {
            state.paidUnlockedUpgrades = data.paidUnlockedUpgrades.slice();
            saveState();
            refreshAll();
            if (added.length) showToast(t('toast.upgradeUnlockedGeneric'), 4000);
          }
        }
        // Global leaderboard rank for the always-on header indicator. The ▲/▼
        // delta is derived here from the last DISTINCT rank we saw, so it reads
        // "#23 ▲2" (climbed 2 since it last changed) and holds that until the
        // rank moves again — not a noisy per-checkin flicker. Server-authoritative
        // position; the client only diffs it.
        if (data && Number.isFinite(data.rank)) {
          const prev = Number.isFinite(state.lastKnownRank) ? state.lastKnownRank : null;
          if (prev === null) {
            state.rankDelta = 0;
          } else if (prev !== data.rank) {
            state.rankDelta = prev - data.rank; // + climbed (rank got smaller), - dropped
          } // else unchanged: keep the last delta shown
          state.lastKnownRank = data.rank;
          state.rankTotal = Number.isFinite(data.rankTotal) ? data.rankTotal : state.rankTotal;
          saveState();
          renderTopbar();
        }
        // Keep the week-reset countdown fresh even before the Top tab is opened.
        if (data && Number.isFinite(data.weekEndsAt)) weekEndsAtMs = data.weekEndsAt;
      })
      .catch(() => {});
  }

  // Funnel events (app_open is logged server-side as part of /checkin,
  // since it already fires on every load — no need for a separate call).
  function sendAnalyticsEvent(eventName) {
    if (!EVENTS_URL || !tg || !tg.initData) return;
    fetch(EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, event: eventName }),
    }).catch(() => {});
  }

  function ownTelegramUserId() {
    return tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
  }

  function ownDisplayName() {
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    return (u && (u.first_name || u.username)) || t('player.default');
  }

  function inviteFriend() {
    const myId = ownTelegramUserId();
    if (!myId || !tg || !tg.openTelegramLink) { showToast(t('toast.onlyTelegram')); return; }
    const deepLink = `https://t.me/${BOT_USERNAME}?start=ref${myId}`;
    const shareText = t('share.text');
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`);
  }

  // Open our channel (subscribing happens outside the mini-app, so we can't
  // detect it automatically — the player taps "Check & claim" on return).
  function openChannel() {
    const url = channelUrl();
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  }

  // Verify subscription + claim the one-time bonus. The server checks membership
  // (getChatMember) and credits once (idempotent); we just react to the status.
  // Shared by the Friends-tab card and the daily-modal offer — one code path.
  let channelClaimInFlight = false;
  async function claimChannelBonus() {
    if (state.channelBonusClaimed) { showToast(t('chan.already')); return; }
    if (!tg || !tg.initData) { showToast(t('toast.onlyTelegram')); return; }
    if (channelClaimInFlight) return;
    channelClaimInFlight = true;
    showToast(t('chan.checking'), 2000);
    try {
      const resp = await fetch(CLAIM_CHANNEL_BONUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await resp.json();
      if (data && data.status === 'claimed') {
        state.channelBonusClaimed = true; saveState();
        showToast(t('chan.claimed', { n: formatNum(data.bonus || 0) }), 4000);
        haptic('heavy');
        sendCheckin(); // pulls pending_reward → cookies (+ reward burst)
        refreshAll();
      } else if (data && data.status === 'already_claimed') {
        state.channelBonusClaimed = true; saveState();
        showToast(t('chan.already')); refreshAll();
      } else { // not_subscribed / not_configured / error
        showToast(t('chan.notSub'), 4000);
      }
    } catch (e) {
      showToast(t('chan.notSub'), 4000);
    } finally {
      channelClaimInFlight = false;
    }
  }

  // Prestige tier badge intensity — the visual scales with prestige count so
  // higher tiers read as more prestigious at a glance (stand-in for the future
  // avatar frames/auras of Layer 3a, which don't exist yet).
  function prestigeBadgeClass(p) {
    if (p >= 25) return 'p4';
    if (p >= 10) return 'p3';
    if (p >= 5) return 'p2';
    return 'p1';
  }

  // Real pioneer threshold (config-driven, arrives with the leaderboard). Used
  // in the "Пионер" tooltip so the number matches what was actually granted.
  let leaderboardPioneerLimit = 50;

  // The current sort criterion, as one plain line. A single mode for now (Топ =
  // prestige, then production); returned from a function so a future mode
  // switcher (Layer 4: by friends / by production) can swap the text per mode
  // instead of showing a static line that lies for the other modes.
  function leaderboardCriterionText() {
    return t('lb.criterion');
  }
  function ascendWord(n) {
    if ((state && state.lang) === 'en') return Math.abs(n) === 1 ? 'ascension' : 'ascensions';
    return pluralRu(n, 'вознесение', 'вознесения', 'вознесений');
  }

  // One leaderboard row's HTML — shared by the top-50 list and the pinned "your
  // place" row so both render identically (badges, titles, cps). `rankLabel` is
  // a medal / number / "#N"; opts.me adds the highlight, opts.nameOverride swaps
  // the display name (e.g. "Ты" for the self row), opts.subExtra appends to the
  // lifetime sub-line (e.g. "of 231").
  function leaderboardRowHtml(entry, rankLabel, opts = {}) {
    const rt = titleFor(entry.maxActiveFriendsEver);
    const refTitleHtml = rt ? `<span class="lb-title">${rt.icon} ${escapeHtml(t(rt.nameKey))}</span>` : '';
    const pioneerHtml = entry.isPioneer ? `<span class="lb-title lb-pioneer" data-pioneer="1">${t('lb.pioneer')}</span>` : '';
    const p = entry.prestigeCount || 0;
    const bonus = entry.crumbs || 0; // this player's real permanent bonus %
    const prestigeHtml = p > 0 ? `<span class="lb-prestige ${prestigeBadgeClass(p)}" data-prestige="${p}" data-bonus="${bonus}">⭐×${p}</span>` : '';
    // Prestige-tier milestone title (tiers 5 & 10) from their prestige count.
    const pTitle = prestigeTitleForTier(p + 1);
    const prestigeTitleHtml = pTitle ? `<span class="lb-title lb-epoch">${pTitle.icon} ${escapeHtml(t(pTitle.nameKey))}</span>` : '';
    const name = opts.nameOverride != null ? opts.nameOverride : escapeHtml(entry.name);
    // Weekly view (Task #40): the score is cookies baked THIS week and the sub
    // line leads with ascensions THIS week (the primary weekly rank key). All-
    // time view: current CPS as the score, lifetime cookies as the sub.
    let scoreHtml, sub;
    if (opts.weekly) {
      const wPres = entry.weeklyPrestige || 0;
      const wBaked = entry.weeklyBaked || 0;
      const base = wPres > 0
        ? t('lb.weekAsc', { n: wPres, w: ascendWord(wPres) })
        : t('lb.weekBakedLabel');
      sub = opts.subExtra ? `${base} · ${opts.subExtra}` : base;
      scoreHtml = `${formatNum(wBaked)}<span class="leaderboard-score-unit">${t('lb.perWeek')}</span>`;
    } else {
      // Lifetime (never resets) as the secondary figure — a just-ascended player
      // would otherwise show ~0 baked and look empty.
      const lifetime = entry.lifetimeCookies || entry.totalBaked || 0;
      sub = opts.subExtra ? `${t('lb.lifetime', { n: formatNum(lifetime) })} · ${opts.subExtra}` : t('lb.lifetime', { n: formatNum(lifetime) });
      scoreHtml = `${formatNum(entry.cps)}<span class="leaderboard-score-unit">${t('lb.perSec')}</span>`;
    }
    return `
          <div class="leaderboard-row${opts.me ? ' me' : ''}">
            <div class="leaderboard-rank">${rankLabel}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${prestigeHtml}${name}${pioneerHtml}${prestigeTitleHtml}${refTitleHtml}</div>
              <div class="leaderboard-total">${sub}</div>
            </div>
            <div class="leaderboard-score">${scoreHtml}</div>
          </div>`;
  }

  // Pinned "your place" row for players below the top-50 cut (server sends `self`
  // in the /leaderboard response — same call, no extra request). Hidden when the
  // player is in the top-50 (already highlighted in the list) or unknown.
  function renderLeaderboardSelf(self, weekly) {
    const box = el.leaderboardSelf;
    if (!box) return;
    if (!self || !Number.isFinite(self.rank)) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = `<div class="lb-self-label">${t('lb.yourPlace')}</div>` +
      leaderboardRowHtml(self, '#' + self.rank, { me: true, weekly: !!weekly, nameOverride: t('lb.you'), subExtra: t('lb.selfOf', { total: self.total }) });
    box.hidden = false;
  }

  let lbMode = 'global';   // 'global' | 'country' — geo slice the Top tab shows
  let lbPeriod = 'all';    // 'all' | 'week' — time slice (Task #40); independent of lbMode → 4 combos
  let lbData = null;       // last /leaderboard response (all slices), so the toggles re-render without re-fetching

  // ISO-2 → flag emoji (regional indicator letters). '' for unknown/invalid.
  function countryFlag(cc) {
    if (typeof cc !== 'string' || !/^[A-Za-z]{2}$/.test(cc)) return '';
    return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
  }

  // Render the currently-selected leaderboard slice from lbData (no network).
  // Two independent toggles pick the slice: period (all / week) × geo (global /
  // country) → 4 combinations, all delivered in the one response.
  function renderLeaderboardView() {
    if (!lbData) return;
    const hasCountry = !!(lbData.country && Array.isArray(lbData.countryEntries));
    // The country BUTTON only shows when the server knows our geo; the toggle row
    // itself (Global / Friends) is always available.
    if (el.lbToggleCountry) el.lbToggleCountry.hidden = !hasCountry;
    if (lbMode === 'country' && !hasCountry) lbMode = 'global';
    // Friends is always all-time — hide the period toggle in that view.
    const isFriends = lbMode === 'friends';
    if (el.leaderboardPeriodToggle) el.leaderboardPeriodToggle.hidden = isFriends;
    if (el.lbToggleGlobal) el.lbToggleGlobal.classList.toggle('active', lbMode === 'global');
    if (el.lbToggleFriends) el.lbToggleFriends.classList.toggle('active', isFriends);
    if (el.lbToggleCountry) {
      el.lbToggleCountry.classList.toggle('active', lbMode === 'country');
      const flag = countryFlag(lbData.country);
      el.lbToggleCountry.textContent = (flag ? flag + ' ' : '') + t('lb.myCountry');
    }
    if (el.lbToggleAll) el.lbToggleAll.classList.toggle('active', lbPeriod === 'all');
    if (el.lbToggleWeek) el.lbToggleWeek.classList.toggle('active', lbPeriod === 'week');

    const useCountry = lbMode === 'country' && hasCountry;
    const useWeek = lbPeriod === 'week' && !isFriends; // friends board is all-time only
    // Pick the slice + its self row for the active view.
    let entries, selfRow;
    if (isFriends) {
      entries = lbData.friendsEntries;
      selfRow = lbData.friendsSelf;
    } else if (useWeek) {
      entries = useCountry ? lbData.countryWeeklyEntries : lbData.weeklyEntries;
      selfRow = useCountry ? lbData.countryWeeklySelf : lbData.weeklySelf;
    } else {
      entries = useCountry ? lbData.countryEntries : lbData.entries;
      selfRow = useCountry ? lbData.countrySelf : lbData.self;
    }
    // Friends ranks by the same criterion as the main board (prestige → cps).
    const critText = useWeek ? t('lb.criterionWeek') : leaderboardCriterionText();
    const explainer = `<div class="lb-explainer">${t('lb.explainer', { crit: critText })}</div>`;
    if (!entries || entries.length === 0) {
      const emptyKey = isFriends ? 'lb.emptyFriends' : (useWeek ? 'lb.emptyWeek' : 'lb.empty');
      el.leaderboardList.innerHTML = explainer + `<div class="empty-hint">${t(emptyKey)}</div>`;
      renderLeaderboardSelf(null);
      return;
    }
    const myId = ownTelegramUserId();
    const medals = ['🥇', '🥈', '🥉'];
    const rows = entries.map((entry, i) =>
      leaderboardRowHtml(entry, medals[i] || (i + 1), { me: !!(myId && entry.userId === myId), weekly: useWeek })
    ).join('');
    // Rival + momentum are computed on the ALL-TIME GLOBAL board, so they only
    // show in that exact view — not in friends, country, or weekly slices.
    let rivalHtml = '', momentumHtml = '';
    if (lbMode === 'global' && !useWeek) {
      if (lbData.rival && Number.isFinite(lbData.rival.deltaCps) && lbData.rival.deltaCps > 0) {
        rivalHtml = `<div class="lb-rival">${t('lb.rival', { n: formatNum(lbData.rival.deltaCps), name: escapeHtml(lbData.rival.name || '') })}</div>`;
      }
      if (Array.isArray(lbData.movers) && lbData.movers.length) {
        momentumHtml = lbData.movers
          .filter(m => m && Number.isFinite(m.up) && m.up > 0)
          .map(m => `<div class="lb-momentum">${t('lb.momentum', { name: escapeHtml(m.name || ''), n: m.up, w: placesWord(m.up) })}</div>`)
          .join('');
      }
    }
    el.leaderboardList.innerHTML = explainer + momentumHtml + rivalHtml + rows;
    renderLeaderboardSelf(selfRow, useWeek);
  }

  // Russian pluralization for "мест(о/а)"; EN is a simple 1-vs-many.
  function placesWord(n) {
    if ((state.lang || 'en') !== 'ru') return Math.abs(n) === 1 ? 'place' : 'places';
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'мест';
    if (b === 1) return 'место';
    if (b >= 2 && b <= 4) return 'места';
    return 'мест';
  }

  // "+N places!" burst on opening the Top tab when the player climbed since the
  // last visit (feature: live rank-change animation). Compares the server's
  // current global rank with state.lastTopRank (persisted), animates once, then
  // stores the new value. Only celebrates climbs (delta > 0).
  function maybeShowRankJump(myRank) {
    if (!Number.isFinite(myRank) || myRank <= 0) return;
    const prev = Number.isFinite(state.lastTopRank) ? state.lastTopRank : null;
    if (prev !== null && myRank < prev) {
      const jump = prev - myRank;
      if (el.rankJumpBurst) {
        el.rankJumpBurst.textContent = t('lb.rankJump', { n: jump, w: placesWord(jump) });
        el.rankJumpBurst.hidden = false;
        el.rankJumpBurst.classList.remove('show');
        void el.rankJumpBurst.offsetWidth; // restart the CSS animation
        el.rankJumpBurst.classList.add('show');
        haptic('medium');
        setTimeout(() => { if (el.rankJumpBurst) el.rankJumpBurst.hidden = true; }, 2600);
      }
    }
    state.lastTopRank = myRank;
    saveState();
  }

  function setLbMode(mode) {
    if (mode !== 'global' && mode !== 'country' && mode !== 'friends') return;
    lbMode = mode;
    renderLeaderboardView();
  }

  function setLbPeriod(period) {
    if (period !== 'all' && period !== 'week') return;
    lbPeriod = period;
    renderLeaderboardView();
  }

  // Countdown to the weekly reset (feature: week timer). weekEndsAtMs is refreshed
  // from every /leaderboard and /checkin response; the ticker below updates the
  // label each second while the Top tab is open.
  let weekEndsAtMs = 0;
  function fmtWeekLeft(ms) {
    const secs = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (d > 0) return `${d}${t('time.d')} ${h}${t('time.h')}`;
    if (h > 0) return `${h}${t('time.h')} ${m}${t('time.m')}`;
    if (m > 0) return `${m}${t('time.m')} ${s}${t('time.s')}`;
    return `${s}${t('time.s')}`;
  }
  function updateWeekTimer() {
    if (!el.weekTimer) return;
    const onTop = document.body.dataset.activeTab === 'leaderboard';
    if (!onTop || !weekEndsAtMs) { el.weekTimer.hidden = true; return; }
    const left = weekEndsAtMs - Date.now();
    if (left <= 0) { el.weekTimer.hidden = true; return; } // rolled over; next load refreshes it
    el.weekTimer.textContent = t('lb.weekTimer', { t: fmtWeekLeft(left) });
    el.weekTimer.hidden = false;
  }

  function loadLeaderboard() {
    el.leaderboardList.innerHTML = `<div class="empty-hint">${t('lb.loading')}</div>`;
    renderLeaderboardSelf(null);
    // The Global / Friends toggle row stays visible during load; the per-button
    // country visibility is set in renderLeaderboardView once data arrives.
    if (!LEADERBOARD_URL) {
      el.leaderboardList.innerHTML = `<div class="empty-hint">${t('lb.comingSoon')}</div>`;
      return;
    }
    // POST with initData so the server can identify us: it returns our rank if we're
    // below the top-50, and a country-filtered slice for the "My country" toggle —
    // all in this one call. Works without initData too (no self / no country slice).
    fetch(LEADERBOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: (tg && tg.initData) || '' }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.entries || data.entries.length === 0) {
          lbData = null;
          const explainer = `<div class="lb-explainer">${t('lb.explainer', { crit: leaderboardCriterionText() })}</div>`;
          el.leaderboardList.innerHTML = explainer + `<div class="empty-hint">${t('lb.empty')}</div>`;
          renderLeaderboardSelf(null);
          return;
        }
        if (Number.isFinite(data.pioneerLimit)) leaderboardPioneerLimit = data.pioneerLimit;
        if (Number.isFinite(data.weekEndsAt)) weekEndsAtMs = data.weekEndsAt;
        lbData = data;
        renderLeaderboardView();
        updateWeekTimer();
        // Celebrate a climb since the last time this tab was open (feature: live
        // rank-change). Uses the server's authoritative global rank.
        maybeShowRankJump(Number.isFinite(data.myRank) ? data.myRank : (data.self && data.self.rank));
      })
      .catch(() => {
        lbData = null;
        el.leaderboardList.innerHTML = `<div class="empty-hint">${t('lb.loadFail')}</div>`;
        renderLeaderboardSelf(null);
      });
  }

  // Tap a rank badge → explain it with this player's real numbers. Delegated on
  // the persistent list container, so it survives every re-render.
  function onLeaderboardBadgeTap(e) {
    const pres = e.target.closest && e.target.closest('.lb-prestige');
    if (pres) {
      const n = Number(pres.dataset.prestige) || 0;
      const x = Number(pres.dataset.bonus) || 0;
      showToast(t('toast.lbPrestige', { n, word: ascendWord(n), x }), 4000);
      return;
    }
    const pio = e.target.closest && e.target.closest('.lb-pioneer');
    if (pio) {
      showToast(t('toast.lbPioneer', { n: leaderboardPioneerLimit }), 4500);
    }
  }

  // ---------- Referral leaderboard (weekly / all-time) ----------
  let refPeriod = 'weekly';          // which slice is shown
  let refData = null;                // { weekly:[], allTime:[] } from the server

  function loadReferralLeaderboard() {
    el.referralLeaderboardList.innerHTML = `<div class="empty-hint">${t('lb.loading')}</div>`;
    if (!REFERRAL_LEADERBOARD_URL) return;
    fetch(REFERRAL_LEADERBOARD_URL)
      .then(r => r.json())
      .then(data => {
        refData = (data && data.ok) ? data : { weekly: [], allTime: [] };
        renderReferralLeaderboard();
      })
      .catch(() => {
        el.referralLeaderboardList.innerHTML = `<div class="empty-hint">${t('refLb.loadFail')}</div>`;
      });
  }

  function renderReferralLeaderboard() {
    if (!el.referralLeaderboardList) return;
    const entries = refData ? (refPeriod === 'weekly' ? refData.weekly : refData.allTime) : [];
    if (!entries || entries.length === 0) {
      el.referralLeaderboardList.innerHTML = refPeriod === 'weekly'
        ? `<div class="empty-hint">${t('refLb.emptyWeek')}</div>`
        : `<div class="empty-hint">${t('refLb.emptyAll')}</div>`;
      return;
    }
    const myId = ownTelegramUserId();
    const medals = ['🥇', '🥈', '🥉'];
    el.referralLeaderboardList.innerHTML = entries.map((entry, i) => {
      const n = entry.score || 0;
      return `
        <div class="leaderboard-row${myId && entry.userId === myId ? ' me' : ''}">
          <div class="leaderboard-rank">${medals[i] || (i + 1)}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${escapeHtml(entry.name)}</div>
            <div class="leaderboard-total">${t('lb.refActive')}</div>
          </div>
          <div class="leaderboard-score">${formatNum(n)}<span class="leaderboard-score-unit">${friendWord(n)}</span></div>
        </div>`;
    }).join('');
  }

  function setRefPeriod(period) {
    if (period !== 'weekly' && period !== 'alltime') return;
    refPeriod = period;
    el.refToggleWeekly.classList.toggle('active', period === 'weekly');
    el.refToggleAll.classList.toggle('active', period === 'alltime');
    renderReferralLeaderboard();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // saveTs of a serialized save (or -1 if missing/unparseable). Legacy saves
  // written before saveTs existed report 0, so a tagged save always beats them.
  function saveTsOf(raw) {
    if (!raw) return -1;
    try { const o = JSON.parse(raw); return Number.isFinite(o.saveTs) ? o.saveTs : 0; } catch (e) { return -1; }
  }
  // Pick the freshest of two serialized saves by saveTs. Tie / both-legacy →
  // prefer cloud (`a`), preserving the old cross-device precedence.
  function pickFreshestSave(cloudRaw, localRaw) {
    const tc = saveTsOf(cloudRaw), tl = saveTsOf(localRaw);
    if (tc < 0 && tl < 0) return null;
    return tc >= tl ? cloudRaw : localRaw;
  }

  // First-launch activation bonus. Granted exactly once, to a genuinely NEW
  // player (no progress of any kind), so they can make their first purchase
  // immediately instead of grinding ~15 clicks for the first building. The
  // `welcomeBonusGiven` flag persists in the save, so it never repeats on
  // reopen; existing players (any prior progress) just get the flag set and no
  // cookies. Runs after load so it sees the real state, not defaults.
  function maybeGrantWelcomeBonus() {
    if (state.welcomeBonusGiven) return;
    const brandNew =
      (state.totalBaked || 0) === 0 && (state.totalClicks || 0) === 0 &&
      (state.lifetimeBaked || 0) === 0 && (state.ascensionCount || 0) === 0 &&
      Object.keys(state.upgrades || {}).length === 0 &&
      Object.values(state.buildings || {}).every(n => !n);
    if (brandNew) {
      state.cookies += WELCOME_BONUS;
      state.totalBaked += WELCOME_BONUS;
      haptic('light');
      showToast(t('onb.welcomeBonus', { n: WELCOME_BONUS }), 4000);
    }
    state.welcomeBonusGiven = true; // close the door either way (grant or existing player)
    saveState();
    refreshAll();
  }

  function loadState() {
    // Render immediately with defaults so the UI never sits blank while an async load resolves.
    refreshAll();

    const afterLoad = () => {
      maybeGrantWelcomeBonus(); // brand-new players start with enough to buy immediately
      sendCheckin();
      // Offline claim card first (if there's a meaningful amount waiting), then
      // the daily reward — resolveOfflineThenDaily chains the daily after it.
      setTimeout(() => {
        if (state.offlinePending > 0) showOfflineModal();
        else if (dailyRewardAvailable()) showDailyModal();
      }, 900);
    };

    const localRaw = (() => { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } })();

    // Apply whichever of {cloud, local} is newer by saveTs. CloudStorage is no
    // longer trusted unconditionally: its async write can lag / land out of
    // order / never arrive (webview closed after an ascension), so a stale cloud
    // value could roll back a just-made change. localStorage is synchronous and
    // holds this device's latest save, so newest-wins fixes the reopen rollback
    // while staying correct cross-device (the newest save is the truth).
    const finish = (cloudRaw) => {
      const pick = pickFreshestSave(cloudRaw, localRaw);
      if (pick) { try { applyLoaded(pick); } catch (e) { /* keep defaults */ } }
      afterLoad();
    };

    if (cloudStorageUsable()) {
      let settled = false;
      const fallbackTimer = setTimeout(() => { if (!settled) { settled = true; finish(null); } }, 1500);
      tg.CloudStorage.getItem(SAVE_KEY, (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        finish(!err ? value : null);
      });
    } else {
      finish(null);
    }
  }

  // ---------- Seasonal events ----------
  // Fixed, deterministic schedule (UTC) — no server round-trip needed to know
  // whether an event is active right now. The push worker (push/src/index.js)
  // duplicates this same math to know when to broadcast "event started".
  const HAPPY_HOUR_START_HOURS_UTC = [6, 18]; // twice a day, 12h apart
  const HAPPY_HOUR_DURATION_H = 1;

  function getHappyHourWindows(d) {
    return HAPPY_HOUR_START_HOURS_UTC.map(h => ({
      start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h)),
      end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h + HAPPY_HOUR_DURATION_H)),
    }));
  }

  function getWeekendWindow(d) {
    const day = d.getUTCDay(); // 0 = Sun, 6 = Sat
    if (day !== 6 && day !== 0) return null;
    const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const satMidnight = midnight - (day === 0 ? 1 : 0) * 86400000;
    return { start: new Date(satMidnight), end: new Date(satMidnight + 2 * 86400000) };
  }

  function getActiveEvents(now = new Date()) {
    const events = [];
    const activeHH = getHappyHourWindows(now).find(w => now >= w.start && now < w.end);
    if (activeHH) {
      events.push({ id: 'happyHour', label: t('evt.happyHour'), mult: 2, endsAt: activeHH.end.getTime() });
    }
    const we = getWeekendWindow(now);
    if (we && now >= we.start && now < we.end) {
      events.push({ id: 'weekend', label: t('evt.weekend'), mult: 1.5, endsAt: we.end.getTime() });
    }
    return events;
  }

  function eventMultiplier() {
    return getActiveEvents().reduce((m, e) => m * e.mult, 1);
  }

  // ---------- Prestige (ascension) ----------
  // Resets the run but banks lifetime totalBaked into a permanent, additive
  // bonus (+1% production per crumb, never lost on future resets) — the
  // usual idle-game answer to "I've hit the ceiling, there's nothing left to
  // do." Cube-root curve keeps early ascensions modest and later ones (with
  // a much bigger totalBaked) meaningfully more rewarding.
  // Heavenly crumbs earned by ascending now. Logarithmic in the CURRENT run's
  // bakes (state.totalBaked, which resets on ascend) — deliberately NOT the
  // lifetime total, or the runaway growth this formula fixes would just come
  // back slower. K is calibrated so a realistic first tier-1 completion
  // (~1e18–1e19 baked in a run) yields ~40 crumbs (+~40% permanent), a bonus
  // that feels meaningful without trivializing the game — even an extreme
  // 1e25-baked run only gives ~57. CRUMBS_MAX is a soft safety cap that the log
  // curve never reaches in practice.
  const CRUMBS_K = 1;
  const CRUMBS_MAX = 1000;
  function potentialCrumbs() {
    const crumbs = Math.floor(CRUMBS_K * Math.log((state.totalBaked || 0) + 1));
    return Math.max(0, Math.min(CRUMBS_MAX, crumbs));
  }

  function prestigeMultiplier() {
    return 1 + (state.totalCrumbs || 0) * 0.01;
  }

  async function ascend() {
    // Full-completion gate: ascension opens only once every purchasable building
    // and reachable upgrade is bought.
    if (!allContentBought()) {
      showToast(t('toast.ascendGate', { rest: remainingContentLabel() }), 3500);
      haptic('light');
      return;
    }
    const crumbsEarned = potentialCrumbs();
    if (crumbsEarned <= 0) {
      showToast(t('toast.ascendTooEarly'));
      return;
    }
    if (!(await confirmDialog(t('confirm.ascend', { n: formatNum(crumbsEarned) })))) return;

    // Server owns prestige_count (the leaderboard's rank key). Confirm BEFORE
    // resetting, so an anti-farm 'too_soon' reject blocks cleanly without
    // wiping progress. Use the server's returned count as the authoritative
    // ascension number; on a network error, fall back to an optimistic local +1.
    let serverPrestige = null;
    if (tg && tg.initData && PRESTIGE_CONFIRM_URL) {
      try {
        const resp = await fetch(PRESTIGE_CONFIRM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        });
        const data = await resp.json();
        if (data && data.ok === false && (data.error === 'too_soon' || data.error === 'no_activity')) {
          showToast(t('toast.ascendTooSoon'), 4000);
          haptic('light');
          return; // do NOT reset
        }
        if (data && data.ok && Number.isFinite(data.prestigeCount)) serverPrestige = data.prestigeCount;
      } catch (e) { /* network error — proceed locally; server count syncs on next confirm */ }
    }

    backupCurrentState();
    const prevAsc = state.ascensionCount || 0; // to detect crossing a milestone tier
    const keepDailyStreak = state.dailyStreak;
    const keepLastDailyClaim = state.lastDailyClaim;
    const keepTotalCrumbs = (state.totalCrumbs || 0) + crumbsEarned;
    const keepAscensionCount = serverPrestige != null ? serverPrestige : (state.ascensionCount || 0) + 1;
    const keepTutorial = state.tutorial || {}; // don't re-show onboarding hints to a veteran
    // Roll the finished run's bakes into the never-resetting lifetime total.
    const keepLifetime = (state.lifetimeBaked || 0) + (state.totalBaked || 0);
    // Paid unlocks are server-owned and persist across runs — keep them so a
    // paid-skipped upgrade doesn't briefly re-lock right after ascending.
    const keepPaidUnlocks = Array.isArray(state.paidUnlockedUpgrades) ? state.paidUnlockedUpgrades.slice() : [];
    // Referral fields are server-authoritative (refreshed each checkin) and not
    // tied to the current run — keep them so the Friendship Bakery and referral
    // titles don't flicker to 0 / re-lock right after ascending, before the next
    // checkin restores them.
    const keepActiveReferrals = state.activeReferrals || 0;
    const keepMaxFriendsEver = state.maxActiveFriendsEver || 0;

    state = defaultState();
    state.dailyStreak = keepDailyStreak;
    state.lastDailyClaim = keepLastDailyClaim;
    state.totalCrumbs = keepTotalCrumbs;
    state.ascensionCount = keepAscensionCount;
    state.tutorial = keepTutorial;
    state.lifetimeBaked = keepLifetime;
    state.paidUnlockedUpgrades = keepPaidUnlocks;
    state.activeReferrals = keepActiveReferrals;
    state.maxActiveFriendsEver = keepMaxFriendsEver;

    haptic('heavy');
    showToast(t('toast.ascended', { n: keepTotalCrumbs }));
    // Milestone tiers (5 & 10): if this ascension crossed into one, celebrate the
    // earned title separately (a beat after the ascension toast).
    const oldDT = prevAsc + 1, newDT = keepAscensionCount + 1;
    const reached = PRESTIGE_TITLES.filter(t => t.tier > oldDT && t.tier <= newDT).sort((a, b) => b.tier - a.tier)[0];
    if (reached) {
      setTimeout(() => showToast(t('toast.newTitle', { icon: reached.icon, name: t(reached.nameKey), n: newDT }), 5000), 1600);
    }
    saveState();
    refreshAll();
  }

  // Cookies baked across every run (past runs + the current one). Never resets
  // on ascend, so a just-reset profile still shows a meaningful figure.
  function lifetimeCookiesTotal() {
    return (state.lifetimeBaked || 0) + (state.totalBaked || 0);
  }

  // ---------- Formulas ----------
  function buildingCost(b, count) {
    return Math.ceil(b.baseCost * Math.pow(1.15, count));
  }

  function buildingCps(b) {
    let mult = state.buildingMult[b.id] || 1;
    if (b.id === 'cursor') mult *= state.cursorMult;
    // Referral building output scales with peak army size — one bakery, but it
    // bakes harder the more friends you've ever had active.
    if (b.referralLocked) return b.baseCps * (state.maxActiveFriendsEver || 0) * mult;
    return b.baseCps * mult;
  }

  // ---------- Prestige-tier content gating ----------
  // Buildings/upgrades can be gated behind a prestige tier: content only becomes
  // available once the player has ascended (prestiged) enough times. An item's
  // `tier` is the required ascension count — 0 or absent means always available.
  // Generic and open-ended: future content rounds just set tier 1, 2, 3, … and
  // the same gate handles them. `state.ascensionCount` is the prestige count
  // (incremented in ascend()).
  function itemTier(item) { return item.tier || 0; }
  function tierUnlocked(item) { return (state.ascensionCount || 0) >= itemTier(item); }
  function tierLockText(tier) { return t('tier.lockAfter', { n: tier }); }

  // Player-facing tier number: tier 1 at ascension 0, tier 2 after the 1st
  // ascension, … So displayTier = ascensionCount + 1.
  function displayTier() { return (state.ascensionCount || 0) + 1; }

  // Tier "reskin" (optional): a building MAY carry explicit `tierVariants`
  // ({ [tier]: {name, icon} }) to show a re-themed name/icon at a given prestige
  // tier. Without a variant it just shows its base name/icon on every tier — we
  // deliberately do NOT append a level tag like «· ур.N» (no "level" wording on
  // buildings). Only the display changes; cost/cps come from the building config.
  function buildingDisplay(b) {
    const dt = displayTier();
    const v = b.tierVariants && b.tierVariants[dt];
    if (v) return { name: v.name, icon: v.icon || b.icon };
    return { name: itemName(b), icon: b.icon };
  }

  // An upgrade's unlock requirement, honouring the paid bypasses:
  //  - the one-time "skip the clicker" removes the click-count gate on ALL click
  //    upgrades;
  //  - a per-upgrade paid skip (paidUnlockedUpgrades) removes the progress gate
  //    on that specific upgrade.
  // Either way you still pay cookies to actually buy the upgrade.
  function upgradeUnlocked(u) {
    if (u.req(state.buildings, state)) return true;
    if (u.reqType === 'clicks' && state.hasClickBypass) return true;
    return Array.isArray(state.paidUnlockedUpgrades) && state.paidUnlockedUpgrades.includes(u.id);
  }

  // Permanent paid +10% — a standing production multiplier (like the referral
  // bonus), so it belongs inside getCps/getClickPower: it must count in the
  // leaderboard and offline income too. Independent multiplicative factor.
  function permProdMultiplier() {
    return state.hasPermProdBoost ? PERM_PROD_MULT : 1;
  }

  function getCps() {
    let total = 0;
    for (const b of BUILDINGS) total += buildingCps(b) * state.buildings[b.id];
    return total * state.globalMult * eventMultiplier() * prestigeMultiplier() * referralMultiplier() * permProdMultiplier();
  }

  function getClickPower() {
    return (1 + state.buildings.cursor * 0.1) * state.clickMult * state.globalMult * eventMultiplier() * prestigeMultiplier() * referralMultiplier() * permProdMultiplier();
  }

  // Temporary paid "x2 production" boost — applied as a FINAL multiplier at the
  // points where CPS is consumed (online tick + display), NOT baked into
  // getCps(): that keeps it off the base rate used for the leaderboard, daily
  // reward, and the offline calc (which applies x2 itself via its window split,
  // so baking it into getCps would double-count).
  function prod2xMultiplier() {
    return (state.boost2xExpiresAt || 0) > Date.now() ? 2 : 1;
  }

  function formatNum(n) {
    if (n < 1000) return n < 100 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
    const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
      'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'ODc', 'NDc', 'Vg'];
    let u = 0;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
  }

  function upgradeEffectText(u) {
    if (u.category === 'click') {
      const before = getClickPower();
      return t('up.effClick', { a: formatNum(before), b: formatNum(before * 2) });
    }
    if (u.category === 'global') {
      const before = getCps();
      return t('up.effGlobal', { a: formatNum(before), b: formatNum(before * 2) });
    }
    const bl = BUILDINGS.find(x => x.id === u.buildingId);
    const before = buildingCps(bl);
    return t('up.effBuilding', { name: itemName(bl), a: formatNum(before), b: formatNum(before * 2) });
  }

  function upgradeReqText(u) {
    if (u.reqType === 'building') {
      const bl = BUILDINGS.find(x => x.id === u.buildingId);
      return t('up.reqBuilding', { icon: bl.icon, name: itemName(bl) });
    }
    if (u.reqType === 'clicks') return t('up.reqClicks', { n: formatNum(u.reqValue), d: formatNum(state.totalClicks) });
    return t('up.reqBaked', { n: formatNum(u.reqValue) });
  }

  // ---------- Daily reward ----------
  const DAILY_MIN_GAP = 20 * 3600 * 1000;
  const DAILY_RESET_GAP = 48 * 3600 * 1000;
  const DAILY_MAX_STREAK_BONUS = 6;

  function dailyRewardAvailable() {
    return state.lastDailyClaim === 0 || (Date.now() - state.lastDailyClaim) >= DAILY_MIN_GAP;
  }

  function previewDailyStreak() {
    if (state.lastDailyClaim === 0) return 1;
    const gap = Date.now() - state.lastDailyClaim;
    return gap > DAILY_RESET_GAP ? 1 : (state.dailyStreak || 0) + 1;
  }

  function computeDailyReward(streakDay) {
    const base = Math.max(50, getCps() * 300);
    const mult = 1 + 0.15 * Math.min(streakDay - 1, DAILY_MAX_STREAK_BONUS);
    return Math.round(base * mult);
  }

  function updateDailyBadge() {
    el.dailyBadge.hidden = !dailyRewardAvailable();
  }

  function showDailyModal() {
    if (!dailyRewardAvailable()) return;
    const streak = previewDailyStreak();
    if (el.dailyStreak) el.dailyStreak.textContent = t('daily.day', { n: streak });
    el.dailyRewardAmount.textContent = formatNum(computeDailyReward(streak));
    // Tutorial step 3: introduce referrals on a RETURN day (lastDailyClaim != 0
    // means they've claimed before, so this modal is a comeback). Shown once —
    // by now they have progress to protect and have felt the offline mechanic,
    // so "invite a friend, both get a bonus" reads as value, not bot spam.
    const tu = tut();
    const showRef = state.lastDailyClaim !== 0 && !tu.referralIntroShown;
    if (el.dailyReferral) el.dailyReferral.hidden = !showRef;
    if (showRef) { tu.referralIntroShown = true; saveState(); }
    // Channel offer, same one-time-on-return pattern as the referral intro. Shown
    // once (channelHintShown), only on a comeback, not if already claimed, and NOT
    // in the same modal as the referral intro (stagger: ref first, channel next).
    const showChan = state.lastDailyClaim !== 0 && !tu.channelHintShown
      && !state.channelBonusClaimed && !showRef;
    if (el.dailyChannel) el.dailyChannel.hidden = !showChan;
    if (showChan) { tu.channelHintShown = true; saveState(); }
    el.dailyModal.classList.add('show');
  }

  function hideDailyModal() {
    el.dailyModal.classList.remove('show');
  }

  function claimDailyReward() {
    if (!dailyRewardAvailable()) return;
    const streak = previewDailyStreak();
    const reward = computeDailyReward(streak);
    state.cookies += reward;
    state.totalBaked += reward;
    state.dailyStreak = streak;
    state.lastDailyClaim = Date.now();
    hideDailyModal();
    haptic('heavy');
    showToast(t('toast.dailyClaimed', { d: streak, n: formatNum(reward) }));
    saveState();
    refreshAll();
  }

  // ---------- Offline claim (free x1 / paid x2 via Telegram Stars) ----------
  function showOfflineModal() {
    if (!el.offlineModal || !(state.offlinePending > 0)) return;
    el.offlineAmount.textContent = formatNum(state.offlinePending);
    el.offlineX2Amount.textContent = formatNum(state.offlinePending * 2);
    const x2Main = document.getElementById('offlineX2Main');
    if (x2Main) x2Main.textContent = t('off.x2main', { n: OFFLINE_BOOST_STARS });
    const x2Sub = document.getElementById('offlineX2Sub');
    if (x2Sub) x2Sub.textContent = t('off.x2sub', { n: formatNum(state.offlinePending * 2) });
    setOfflineModalProcessing(false);
    el.offlineModal.classList.add('show');
  }

  function hideOfflineModal() {
    if (el.offlineModal) el.offlineModal.classList.remove('show');
  }

  // After the offline card is resolved (claimed free, or paid flow launched),
  // chain the daily reward modal if it's due — same slot it used to own.
  function resolveOfflineThenDaily() {
    hideOfflineModal();
    if (dailyRewardAvailable()) setTimeout(showDailyModal, 250);
  }

  function claimOfflineFree() {
    const n = state.offlinePending || 0;
    if (n > 0) {
      state.cookies += n;
      state.totalBaked += n;
      state.offlinePending = 0;
      haptic('medium');
      showToast(t('toast.offlineFreeClaimed', { n: formatNum(n) }));
      saveState();
      refreshAll();
    }
    resolveOfflineThenDaily();
  }

  function setOfflineModalProcessing(on) {
    if (!el.offlineModal) return;
    el.offlineModal.classList.toggle('processing', !!on);
    if (el.offlineClaimBtn) el.offlineClaimBtn.disabled = !!on;
    if (el.offlineX2Btn) el.offlineX2Btn.disabled = !!on;
  }

  // Nudge a few checkins so the paid credit (set by the successful_payment
  // webhook) lands fast, without waiting for the 2-min periodic checkin.
  function pollPaidCredit() {
    [800, 2500, 5000, 10000].forEach(ms => setTimeout(sendCheckin, ms));
  }

  // ---------- Rewarded ads (AdsGram) ----------
  let adController = null;
  function initAdsgram() {
    if (adController || !window.Adsgram || ADSGRAM_BLOCK_ID === 'REPLACE_WITH_ADSGRAM_BLOCK_ID') return;
    try { adController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID }); } catch (e) { adController = null; }
  }
  function adsUsed() { return state.adsRewardsUsed || 0; }
  function adsLimit() { return Number.isFinite(state.adsDailyLimit) ? state.adsDailyLimit : AD_DAILY_LIMIT_FALLBACK; }

  // Watch a rewarded video for a smaller version of a Stars boost. The grant is
  // server-side (AdsGram's reward callback → /adsgram-reward), verified by the
  // secret — we never grant on the client.
  // type ∈ {'nocap','boost2x','click_bypass_progress'} (last = +1 view toward the
  // free click-bypass unlock; shares the daily ad limit with the other two).
  // Only ONE ad may be in flight at a time. Watching a second ad before the
  // first's reward callback has been processed used to clobber the server intent
  // and silently lose a view — so we block overlapping watches here (and the
  // server rejects them too, as a backstop).
  let adInFlight = false;
  async function watchAd(type) {
    if (!tg || !tg.initData) { showToast(t('toast.onlyTelegram')); return; }
    if (adInFlight) { showToast(t('toast.adInProgress'), 3000); return; }
    if (adsUsed() >= adsLimit()) { showToast(t('toast.adLimitReached', { used: adsUsed(), limit: adsLimit() })); return; }
    initAdsgram();
    if (!adController) { showToast(t('toast.adUnavailable')); return; }
    adInFlight = true;
    // Record which boost this ad grants (server verifies + grants on the reward
    // callback). The intent doubles as a one-shot idempotency guard server-side.
    // The server refuses to create a new intent while one is still pending
    // (409 ad_in_progress) — surface that instead of showing an ad we can't credit.
    try {
      const resp = await fetch(ADSGRAM_INTENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, type }),
      });
      const data = await resp.json().catch(() => null);
      if (data && data.ok === false) {
        adInFlight = false;
        showToast(data.error === 'ad_in_progress' ? t('toast.adInProgress') : t('toast.adUnavailable'), 3000);
        return;
      }
    } catch (e) {
      // Network error creating the intent — abort rather than show an ad whose
      // reward callback would find no intent and grant nothing.
      adInFlight = false;
      showToast(t('toast.adUnavailable'));
      return;
    }
    showToast(t('toast.adLoading'), 2500);
    adController.show().then(() => {
      // Fully watched → AdsGram calls /adsgram-reward server-side; poll checkins
      // to pick up the extended boost window + updated daily counter. Clear the
      // in-flight lock; the server's intent guard covers the brief window until
      // the reward callback consumes the intent.
      adInFlight = false;
      showToast(t('toast.adReward'), 3500);
      haptic('heavy');
      pollPaidCredit();
    }).catch(() => {
      // Ad closed/skipped without completing → no reward callback will come, so
      // cancel the pending intent server-side to free the next ad immediately.
      adInFlight = false;
      fetch(ADSGRAM_CANCEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      }).catch(() => {});
      showToast(t('toast.adNoReward'));
    });
  }

  async function claimOfflinePaid() {
    if (!tg || !tg.openInvoice || !tg.initData) { showToast(t('toast.payOnlyTelegram')); return; }
    const quote = state.offlinePending || 0;
    if (!(quote > 0)) return;
    setOfflineModalProcessing(true);
    try {
      const resp = await fetch(CREATE_OFFLINE_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, amount: quote }),
      });
      const data = await resp.json();
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (status === 'paid') {
          // Server credits via webhook; the credit is applied on checkin.
          showToast(t('toast.payX2'), 4000);
          pollPaidCredit();
          resolveOfflineThenDaily();
        } else {
          // cancelled / failed / pending — balance untouched, allow retry.
          setOfflineModalProcessing(false);
          if (status === 'failed') showToast(t('toast.payFailed'));
        }
      });
    } catch (e) {
      setOfflineModalProcessing(false);
      showToast(t('toast.invoiceFail'));
    }
  }

  // Paid "remove offline cap for 24h" boost. No amount to freeze — the effect
  // is a server-owned time window; boostExpiresAt arrives back on checkin.
  async function buyNocapBoost() {
    if (!tg || !tg.openInvoice || !tg.initData) { showToast(t('toast.payOnlyTelegram')); return; }
    if (el.nocapBtn) el.nocapBtn.disabled = true;
    try {
      const resp = await fetch(CREATE_NOCAP_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await resp.json();
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (el.nocapBtn) el.nocapBtn.disabled = false;
        if (status === 'paid') {
          showToast(t('toast.payNocap'), 4000);
          pollPaidCredit(); // nudges checkins; boostExpiresAt lands via checkin
        } else if (status === 'failed') {
          showToast(t('toast.payFailed'));
        }
      });
    } catch (e) {
      if (el.nocapBtn) el.nocapBtn.disabled = false;
      showToast(t('toast.invoiceFail'));
    }
  }

  // Paid "x2 production for 1h" boost. Server-owned window; boost2xExpiresAt
  // lands on checkin, then online x2 + timer kick in.
  async function buyBoost2x() {
    if (!tg || !tg.openInvoice || !tg.initData) { showToast(t('toast.payOnlyTelegram')); return; }
    if (el.boost2xBtn) el.boost2xBtn.disabled = true;
    try {
      const resp = await fetch(CREATE_BOOST2X_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await resp.json();
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (el.boost2xBtn) el.boost2xBtn.disabled = false;
        if (status === 'paid') {
          showToast(t('toast.payBoost2x'), 4000);
          pollPaidCredit(); // nudges checkins; boost2xExpiresAt lands via checkin
        } else if (status === 'failed') {
          showToast(t('toast.payFailed'));
        }
      });
    } catch (e) {
      if (el.boost2xBtn) el.boost2xBtn.disabled = false;
      showToast(t('toast.invoiceFail'));
    }
  }

  // Paid one-time "+10% forever". The server refuses if already owned; on
  // success the flag arrives via checkin and getCps/getClickPower pick up +10%.
  async function buyPermProd() {
    if (state.hasPermProdBoost) { showToast(t('toast.alreadyOwned')); return; }
    if (!tg || !tg.openInvoice || !tg.initData) { showToast(t('toast.payOnlyTelegram')); return; }
    if (el.permProdBtn) el.permProdBtn.disabled = true;
    try {
      const resp = await fetch(CREATE_PERM_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await resp.json();
      if (data && data.error === 'already_owned') {
        state.hasPermProdBoost = true; saveState(); refreshAll();
        showToast(t('toast.alreadyOwned'));
        return;
      }
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (status === 'paid') {
          // Keep the button disabled — the flag lands via checkin and flips the
          // button to "Куплено", preventing a rapid second (real) purchase.
          showToast(t('toast.payPerm'), 4000);
          pollPaidCredit();
        } else {
          if (el.permProdBtn) el.permProdBtn.disabled = false;
          if (status === 'failed') showToast(t('toast.payFailed'));
        }
      });
    } catch (e) {
      if (el.permProdBtn) el.permProdBtn.disabled = false;
      showToast(t('toast.invoiceFail'));
    }
  }

  // Paid one-time "skip the clicker": removes the click-count requirement on
  // click upgrades. Server owns the has_click_bypass flag (mirrors buyPermProd).
  async function buyClickBypass() {
    if (state.hasClickBypass) { showToast(t('toast.alreadyOwned')); return; }
    if (!tg || !tg.openInvoice || !tg.initData) { showToast(t('toast.payOnlyTelegram')); return; }
    if (el.clickBypassBtn) el.clickBypassBtn.disabled = true;
    try {
      const resp = await fetch(CREATE_CLICKSKIP_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const data = await resp.json();
      if (data && data.error === 'already_owned') {
        state.hasClickBypass = true; saveState(); refreshAll();
        showToast(t('toast.alreadyOwned'));
        return;
      }
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (status === 'paid') {
          // Flag lands via checkin and flips the button to "Куплено".
          showToast(t('toast.payClickBypass'), 4000);
          pollPaidCredit();
        } else {
          if (el.clickBypassBtn) el.clickBypassBtn.disabled = false;
          if (status === 'failed') showToast(t('toast.payFailed'));
        }
      });
    } catch (e) {
      if (el.clickBypassBtn) el.clickBypassBtn.disabled = false;
      showToast(t('toast.invoiceFail'));
    }
  }

  function addPaidUnlock(id) {
    if (!Array.isArray(state.paidUnlockedUpgrades)) state.paidUnlockedUpgrades = [];
    if (!state.paidUnlockedUpgrades.includes(id)) state.paidUnlockedUpgrades.push(id);
    saveState();
    refreshAll();
  }

  // Paid per-upgrade skip: buy instant unlock of a single progress-gated upgrade
  // (price is server-authoritative, keyed by upgrade id). Server refuses to sell
  // one already paid-unlocked; the client also aborts if it got unlocked
  // organically (enough clicks) between render and tap.
  async function buyUpgradeSkip(u) {
    if (upgradeUnlocked(u)) { showToast(t('toast.alreadyUnlocked')); refreshAll(); return; }
    if (!tg || !tg.openInvoice || !tg.initData) { showToast(t('toast.payOnlyTelegram')); return; }
    try {
      const resp = await fetch(CREATE_UPGRADE_SKIP_INVOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, upgradeId: u.id }),
      });
      const data = await resp.json();
      if (data && data.error === 'already_owned') { addPaidUnlock(u.id); showToast(t('toast.alreadyUnlocked')); return; }
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (status === 'paid') {
          // The unlock lands via checkin (paidUnlockedUpgrades); nudge checkins.
          showToast(t('toast.payUpgradeSkip', { name: itemName(u) }), 4000);
          pollPaidCredit();
        } else if (status === 'failed') {
          showToast(t('toast.payFailed'));
        }
      });
    } catch (e) {
      showToast(t('toast.invoiceFail'));
    }
  }

  // ---------- Contextual offers (shared state, one renderer) ----------
  // The same boost can now be triggered from several places: the Shop, the
  // header popups (offline timer / CPS), and upgrade cards. To keep
  // owned/pending/daily-limit state from diverging between those places, EVERY
  // offer button carries data-offer="<id>", is labelled/disabled by ONE render
  // fn from shared `state`, and dispatched by ONE delegated click handler.
  // Never hand-render an offer button's label/disabled/owned anywhere else.
  const adLimited = () => adsUsed() >= adsLimit();
  const OFFERS = {
    nocap: {
      action: buyNocapBoost,
      render(btn) {
        btn.textContent = (state.boostExpiresAt || 0) > Date.now()
          ? t('shop.nocapExtend', { n: NOCAP_BOOST_STARS })
          : t('shop.nocap', { n: NOCAP_BOOST_STARS });
        btn.disabled = false; btn.classList.remove('owned');
      },
    },
    boost2x: {
      action: buyBoost2x,
      render(btn) {
        btn.textContent = (state.boost2xExpiresAt || 0) > Date.now()
          ? t('shop.boost2xExtend', { n: PROD2X_BOOST_STARS })
          : t('shop.boost2x', { n: PROD2X_BOOST_STARS });
        btn.disabled = false; btn.classList.remove('owned');
      },
    },
    permProd: {
      action: buyPermProd,
      render(btn) {
        const owned = !!state.hasPermProdBoost;
        btn.textContent = owned ? t('shop.permOwned') : t('shop.perm', { n: PERM_PROD_STARS });
        btn.disabled = owned; btn.classList.toggle('owned', owned);
      },
    },
    clickBypass: {
      action: buyClickBypass,
      render(btn) {
        const owned = !!state.hasClickBypass;
        btn.textContent = owned ? t('shop.clickBypassOwned') : t('shop.clickBypass', { n: CLICK_BYPASS_STARS });
        btn.disabled = owned; btn.classList.toggle('owned', owned);
      },
    },
    adNocap: {
      action: () => watchAd('nocap'),
      render(btn) { const lim = adLimited(); btn.textContent = lim ? t('shop.adLimit', { used: adsUsed(), limit: adsLimit() }) : t('shop.adNocap'); btn.disabled = lim; },
    },
    adBoost2x: {
      action: () => watchAd('boost2x'),
      render(btn) { const lim = adLimited(); btn.textContent = lim ? t('shop.adLimit', { used: adsUsed(), limit: adsLimit() }) : t('shop.adBoost2x'); btn.disabled = lim; },
    },
    adBypass: {
      action: () => watchAd('click_bypass_progress'),
      render(btn) { const lim = adLimited(); btn.textContent = lim ? t('shop.adLimit', { used: adsUsed(), limit: adsLimit() }) : t('shop.adBypass'); btn.disabled = lim; },
    },
  };

  // Re-render EVERY offer button currently mounted (Shop + open popup) from
  // shared state, so all entry points show identical owned/pending/limit state.
  function renderOffers() {
    document.querySelectorAll('[data-offer]').forEach((btn) => {
      const o = OFFERS[btn.dataset.offer];
      if (o) o.render(btn);
    });
  }

  // Header contextual popup: a small titled sheet with 2 relevant offers
  // (Stars + ad). Buttons are built from the same registry, so no duplicated
  // markup or state. offerIds e.g. ['nocap','adNocap'].
  // explainText (optional): a short plain-language blurb shown above the offers —
  // e.g. what the offline-income line means, so the popup doubles as an always-
  // available explanation (not just a buy sheet).
  function openOfferPopup(titleKey, offerIds, explainText) {
    if (!el.offerPopup) return;
    el.offerPopupTitle.textContent = t(titleKey);
    if (el.offerPopupExplain) {
      el.offerPopupExplain.textContent = explainText || '';
      el.offerPopupExplain.hidden = !explainText;
    }
    el.offerPopupBody.innerHTML = '';
    offerIds.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = id.startsWith('ad') ? 'ad-btn' : 'nocap-btn';
      b.dataset.offer = id;
      el.offerPopupBody.appendChild(b);
    });
    renderOffers(); // label from shared state
    el.offerPopup.classList.add('show');
  }
  function closeOfferPopup() { if (el.offerPopup) el.offerPopup.classList.remove('show'); }

  // ---------- Rendering ----------
  const el = {
    cookieCount: document.getElementById('cookieCount'),
    cps: document.getElementById('cps'),
    clickPowerLine: document.getElementById('clickPowerLine'),
    offlineInfoLine: document.getElementById('offlineInfoLine'),
    rankBadge: document.getElementById('rankBadge'),
    boost2xLine: document.getElementById('boost2xLine'),
    bigCookie: document.getElementById('bigCookie'),
    clickHint: document.getElementById('clickHint'),
    upgradeHint: document.getElementById('upgradeHint'),
    floatLayer: document.getElementById('floatLayer'),
    buildingsList: document.getElementById('buildingsList'),
    upgradesList: document.getElementById('upgradesList'),
    statsList: document.getElementById('statsList'),
    toast: document.getElementById('toast'),
    goldenLayer: document.getElementById('goldenLayer'),
    dailyBadge: document.getElementById('dailyBadge'),
    dailyModal: document.getElementById('dailyModal'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    settingsCloseBtn: document.getElementById('settingsCloseBtn'),
    langRuBtn: document.getElementById('langRuBtn'),
    langEnBtn: document.getElementById('langEnBtn'),
    dailyStreakNum: document.getElementById('dailyStreakNum'),
    dailyStreak: document.getElementById('dailyStreak'),
    dailyRewardAmount: document.getElementById('dailyRewardAmount'),
    dailyClaimBtn: document.getElementById('dailyClaimBtn'),
    dailyReferral: document.getElementById('dailyReferral'),
    dailyInviteBtn: document.getElementById('dailyInviteBtn'),
    dailyChannel: document.getElementById('dailyChannel'),
    dailyChannelSubBtn: document.getElementById('dailyChannelSubBtn'),
    dailyChannelClaimBtn: document.getElementById('dailyChannelClaimBtn'),
    channelCard: document.getElementById('channelCard'),
    channelSubBtn: document.getElementById('channelSubBtn'),
    channelClaimBtn: document.getElementById('channelClaimBtn'),
    offlineModal: document.getElementById('offlineModal'),
    offlineAmount: document.getElementById('offlineAmount'),
    offlineX2Amount: document.getElementById('offlineX2Amount'),
    offlineClaimBtn: document.getElementById('offlineClaimBtn'),
    offlineX2Btn: document.getElementById('offlineX2Btn'),
    unlockModal: document.getElementById('unlockModal'),
    unlockIcon: document.getElementById('unlockIcon'),
    unlockName: document.getElementById('unlockName'),
    unlockDesc: document.getElementById('unlockDesc'),
    unlockPlaceBtn: document.getElementById('unlockPlaceBtn'),
    prestigeBanner: document.getElementById('prestigeBanner'),
    prestigeBannerTitle: document.getElementById('prestigeBannerTitle'),
    prestigeBannerSub: document.getElementById('prestigeBannerSub'),
    prestigeBannerCta: document.getElementById('prestigeBannerCta'),
    rewardTeaser: document.getElementById('rewardTeaser'),
    rewardTeaserTitle: document.getElementById('rewardTeaserTitle'),
    rewardTeaserSub: document.getElementById('rewardTeaserSub'),
    rewardTeaserFill: document.getElementById('rewardTeaserFill'),
    rewardTeaserCta: document.getElementById('rewardTeaserCta'),
    eventBanner: document.getElementById('eventBanner'),
    eventBannerText: document.getElementById('eventBannerText'),
    refEventBanner: document.getElementById('refEventBanner'),
    refEventBannerText: document.getElementById('refEventBannerText'),
    leaderboardList: document.getElementById('leaderboardList'),
    leaderboardSelf: document.getElementById('leaderboardSelf'),
    rankJumpBurst: document.getElementById('rankJumpBurst'),
    weekTimer: document.getElementById('weekTimer'),
    leaderboardToggle: document.getElementById('leaderboardToggle'),
    leaderboardPeriodToggle: document.getElementById('leaderboardPeriodToggle'),
    lbToggleGlobal: document.getElementById('lbToggleGlobal'),
    lbToggleFriends: document.getElementById('lbToggleFriends'),
    lbToggleCountry: document.getElementById('lbToggleCountry'),
    lbToggleAll: document.getElementById('lbToggleAll'),
    lbToggleWeek: document.getElementById('lbToggleWeek'),
    referralLeaderboardList: document.getElementById('referralLeaderboardList'),
    fsFriends: document.getElementById('fsFriends'),
    fsBoost: document.getElementById('fsBoost'),
    fsOffline: document.getElementById('fsOffline'),
    fsInviteBtn: document.getElementById('fsInviteBtn'),
    friendsMilestones: document.getElementById('friendsMilestones'),
    friendsMsNext: document.getElementById('friendsMsNext'),
    refToggleWeekly: document.getElementById('refToggleWeekly'),
    refToggleAll: document.getElementById('refToggleAll'),
    ascendBonus: document.getElementById('ascendBonus'),
    ascendPreview: document.getElementById('ascendPreview'),
    ascendPreviewLabel: document.getElementById('ascendPreviewLabel'),
    ascendFirstTime: document.getElementById('ascendFirstTime'),
    ascendRows: document.getElementById('ascendRows'),
    ascendBtn: document.getElementById('ascendBtn'),
    syncStatus: document.getElementById('syncStatus'),
    pushCloudBtn: document.getElementById('pushCloudBtn'),
    pullCloudBtn: document.getElementById('pullCloudBtn'),
    restoreBackupBtn: document.getElementById('restoreBackupBtn'),
    nocapBtn: document.getElementById('nocapBtn'),
    boost2xBtn: document.getElementById('boost2xBtn'),
    permProdBtn: document.getElementById('permProdBtn'),
    clickBypassBtn: document.getElementById('clickBypassBtn'),
    adNocapBtn: document.getElementById('adNocapBtn'),
    adBoost2xBtn: document.getElementById('adBoost2xBtn'),
    adBypassProgress: document.getElementById('adBypassProgress'),
    adBypassCount: document.getElementById('adBypassCount'),
    adBypassFill: document.getElementById('adBypassFill'),
    adBypassBtn: document.getElementById('adBypassBtn'),
    playerProfile: document.getElementById('playerProfile'),
    fsOfflineLabel: document.getElementById('fsOfflineLabel'),
    rewardBurst: document.getElementById('rewardBurst'),
    rewardBurstAmount: document.getElementById('rewardBurstAmount'),
    offerPopup: document.getElementById('offerPopup'),
    offerPopupTitle: document.getElementById('offerPopupTitle'),
    offerPopupExplain: document.getElementById('offerPopupExplain'),
    offerPopupBody: document.getElementById('offerPopupBody'),
  };

  function countBoughtUpgrades(category) {
    return UPGRADES.filter(u => u.category === category && state.upgrades[u.id]).length;
  }

  function renderTopbar() {
    el.cookieCount.textContent = formatNum(state.cookies);
    const p2 = prod2xMultiplier();
    el.cps.textContent = t('top.cps', { n: formatNum(getCps() * p2) }) + (p2 > 1 ? ' ⚡×2' : '');
    el.cps.classList.toggle('boosted', p2 > 1);
    const clickUpgradesOwned = countBoughtUpgrades('click');
    el.clickPowerLine.textContent = t('top.clickPower', { p: formatNum(getClickPower()), a: clickUpgradesOwned, total: CLICK_UPGRADES_TOTAL });
    renderOfflineInfo();
    renderBoost2xInfo();
    renderRankBadge();
  }

  // Always-on leaderboard rank in the header (feature: rank in the header). Shows
  // "🏆 #23" plus a ▲/▼ delta since the rank last changed. Hidden until the
  // server has told us a rank (new players, or offline). Tapping it opens the Top
  // tab. Rank + delta are maintained in state by the checkin handler.
  function renderRankBadge() {
    if (!el.rankBadge) return;
    const r = state.lastKnownRank;
    if (!Number.isFinite(r) || r <= 0) { el.rankBadge.hidden = true; return; }
    const d = state.rankDelta || 0;
    let arrow = '';
    if (d > 0) arrow = ` <span class="rank-delta up">▲${d}</span>`;
    else if (d < 0) arrow = ` <span class="rank-delta down">▼${-d}</span>`;
    el.rankBadge.innerHTML = t('top.rank', { n: formatNum(r) }) + arrow;
    el.rankBadge.hidden = false;
  }

  // x2-production boost timer, shown next to the CPS indicator only while active.
  function renderBoost2xInfo() {
    if (!el.boost2xLine) return;
    const left = (state.boost2xExpiresAt || 0) - Date.now();
    if (left > 0) {
      el.boost2xLine.hidden = false;
      el.boost2xLine.textContent = t('top.boost2x', { t: fmtDur(left) });
    } else {
      el.boost2xLine.hidden = true;
    }
  }

  // Offline status in the topbar (always visible): the paid no-cap boost
  // countdown when active, otherwise the current full-rate window.
  function renderOfflineInfo() {
    if (!el.offlineInfoLine) return;
    const boostLeft = (state.boostExpiresAt || 0) - Date.now();
    if (boostLeft > 0) {
      el.offlineInfoLine.textContent = t('top.offlineBoost', { t: fmtHM(boostLeft) });
      el.offlineInfoLine.classList.add('boost');
    } else {
      const capMin = Math.round(getOfflineCapHours(state.activeReferrals || 0) * 60);
      el.offlineInfoLine.textContent = t('top.offline100', { t: fmtHMText(capMin) });
      el.offlineInfoLine.classList.remove('boost');
    }
  }

  // Plain-language explanation of the offline-income line, adapted to the current
  // state (uncapped boost active vs the normal full-rate window). Shown in the
  // popup when the header line is tapped — an always-available "what is this?".
  function offlineExplainText() {
    if ((state.boostExpiresAt || 0) > Date.now()) return t('popup.offlineExplainBoost');
    const capMin = Math.round(getOfflineCapHours(state.activeReferrals || 0) * 60);
    return t('popup.offlineExplain', { cap: fmtHMText(capMin) });
  }

  function updateEventBanner() {
    const events = getActiveEvents();
    if (events.length === 0) {
      el.eventBanner.hidden = true;
      return;
    }
    const soonestEnd = Math.min(...events.map(e => e.endsAt));
    const remain = Math.max(0, soonestEnd - Date.now());
    const totalMult = events.reduce((m, e) => m * e.mult, 1);
    const label = events.map(e => e.label).join(' + ');
    const hh = String(Math.floor(remain / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((remain % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
    el.eventBannerText.textContent = `${label} · x${totalMult} · ${t('evt.remain', { t: `${hh}:${mm}:${ss}` })}`;
    el.eventBanner.hidden = false;
  }

  // Referral boost event banner — driven by server config (refEventInfo set on
  // checkin), with a live countdown when the event has an end time.
  let refEventInfo = null;
  function updateRefEventBanner() {
    if (!el.refEventBanner) return;
    if (!refEventInfo || !refEventInfo.active) { el.refEventBanner.hidden = true; return; }
    const mult = refEventInfo.multiplier || 1;
    let text = t('evt.refReward', { mult });
    if (refEventInfo.endAt) {
      const remain = refEventInfo.endAt - Date.now();
      if (remain <= 0) { el.refEventBanner.hidden = true; refEventInfo = null; return; }
      const hh = String(Math.floor(remain / 3600000)).padStart(2, '0');
      const mm = String(Math.floor((remain % 3600000) / 60000)).padStart(2, '0');
      const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
      text += ' · ' + t('evt.remain', { t: `${hh}:${mm}:${ss}` });
    }
    text += ' · ' + t('evt.callFriends');
    el.refEventBannerText.textContent = text;
    el.refEventBanner.hidden = false;
  }

  function renderBuildings() {
    el.buildingsList.innerHTML = '';
    for (const b of BUILDINGS) {
      const count = state.buildings[b.id];
      // Prestige-tier gate comes first — a tier-locked building is shown locked
      // (with its unlock condition) and can't be bought until the tier is reached.
      if (!tierUnlocked(b)) {
        el.buildingsList.appendChild(tierLockedBuildingCard(b, count));
        continue;
      }
      if (b.referralLocked) {
        el.buildingsList.appendChild(referralBuildingCard(b, count));
        continue;
      }
      const cost = buildingCost(b, count);
      const affordable = state.cookies >= cost;
      const disp = buildingDisplay(b);
      const card = document.createElement('button');
      card.className = 'item-card' + (affordable ? '' : ' disabled');
      card.innerHTML = `
        <div class="item-icon">${disp.icon}</div>
        <div class="item-info">
          <div class="item-name">${disp.name}</div>
          <div class="item-sub">${t('bld.persecEach', { n: formatNum(buildingCps(b)) })}</div>
        </div>
        <div class="item-count">${count}</div>
        <div class="item-cost">${formatNum(cost)} 🍪</div>
      `;
      card.addEventListener('click', () => buyBuilding(b));
      el.buildingsList.appendChild(card);
    }
  }

  // A referral-locked building shows right inside the normal shop list — as a
  // 🔒 locked row (with the friend requirement as its tooltip/subtitle) until
  // the peak-friends threshold is met, then as a free "Поставить" row, then as
  // a placed producer. It's never purchasable for cookies.
  function referralBuildingCard(b, count) {
    const peak = state.maxActiveFriendsEver || 0;
    const unlocked = peak >= b.unlockFriends;
    const placed = count >= 1;
    const tip = t('ref.buildingLocked', { n: b.unlockFriends });
    const card = document.createElement('button');

    let subText, costHtml;
    if (placed) {
      card.className = 'item-card referral placed';
      subText = t('ref.placedSub', { n: formatNum(buildingCps(b)) });
      costHtml = `<div class="item-cost referral-tag">${t('ref.gift')}</div>`;
    } else if (unlocked) {
      card.className = 'item-card referral ready';
      subText = t('ref.ready');
      costHtml = `<div class="item-cost referral-place">${t('unlock.place')}</div>`;
    } else {
      card.className = 'item-card disabled referral locked';
      card.title = tip;
      subText = tip;
      costHtml = `<div class="item-cost referral-locked">🔒 ${b.unlockFriends} ${friendWord(b.unlockFriends)}</div>`;
    }

    card.innerHTML = `
      <div class="item-icon">${b.icon}</div>
      <div class="item-info">
        <div class="item-name">${itemName(b)}</div>
        <div class="item-sub">${subText}</div>
      </div>
      <div class="item-count">${count}</div>
      ${costHtml}
    `;
    card.addEventListener('click', () => {
      if (placed) { haptic('light'); return; }
      if (unlocked) placeReferralBuilding(b);
      else { showToast(tip); haptic('light'); }
    });
    return card;
  }

  // A prestige-tier-locked building shows in the shop list as a 🔒 locked row —
  // its identity is revealed (a teaser to motivate ascending) but it's greyed
  // out and unbuyable until the required ascension count is reached. Mirrors the
  // referral-locked look. Tapping it just explains the unlock condition.
  function tierLockedBuildingCard(b, count) {
    const tip = tierLockText(itemTier(b));
    const card = document.createElement('button');
    card.className = 'item-card disabled tier-locked locked';
    card.title = tip;
    card.innerHTML = `
      <div class="item-icon">${b.icon}</div>
      <div class="item-info">
        <div class="item-name">${itemName(b)}</div>
        <div class="item-sub">${tip}</div>
      </div>
      <div class="item-count">${count || 0}</div>
      <div class="item-cost tier-locked-tag">🔒</div>
    `;
    card.addEventListener('click', () => { showToast(tip); haptic('light'); });
    return card;
  }

  // Collapse state for the "Выполнено" (completed) section. Kept in a module
  // var (not persisted) so it survives the frequent full re-renders — default
  // closed, so completed upgrades don't clutter the "what to buy next" view.
  let completedExpanded = false;

  function renderUpgrades() {
    el.upgradesList.innerHTML = '';

    // Count ONLY upgrades available at the current prestige tier — the
    // denominator must not include future-tier upgrades the player can't buy
    // yet, otherwise "13/47" never reaches "all bought" and hides the sense of
    // completion (and misreads the ascension gate). Bought upgrades are always
    // tier-unlocked (locked ones can't be bought; upgrades reset on ascend), so
    // this only really trims the denominator.
    const availableUpgrades = UPGRADES.filter(u => tierUnlocked(u));
    const totalCount = availableUpgrades.length;
    const boughtAll = availableUpgrades.filter(u => state.upgrades[u.id]);
    const boughtTotal = boughtAll.length;

    // Overall progress counter — pinned at the top, always visible regardless of
    // the collapsed section or how many upgrades are still available (stays put
    // even at 17/17 when the "Доступно" list is empty). Tier number in the label
    // explains why the denominator jumps after an ascension (new tier unlocked).
    const progress = document.createElement('div');
    progress.className = 'upgrade-progress';
    progress.innerHTML = t('up.progress', { t: displayTier(), b: boughtTotal, total: totalCount });
    el.upgradesList.appendChild(progress);

    // --- "Доступно" — только НЕ купленные апгрейды, сгруппированы по категориям.
    let anyAvailable = false;
    for (const category of CATEGORY_ORDER) {
      const categoryAll = UPGRADES.filter(u => u.category === category);
      const notBought = categoryAll.filter(u => !state.upgrades[u.id]);

      // Prestige-tier-locked upgrades are ALWAYS surfaced as locked cards (same
      // as tier-locked buildings in the shop), so the «Доступно после N-го
      // вознесения» gate is visible in this tab too — not just in buildings.
      const tierLocked = notBought.filter(u => !tierUnlocked(u)).sort((a, b) => a.cost - b.cost);
      const reachable = notBought.filter(u => tierUnlocked(u));

      // Use upgradeUnlocked (not raw u.req) so paid unlocks — the click-bypass
      // boost (v=51) and per-upgrade skips (v=53) — actually surface the card as
      // buyable instead of leaving it hidden until cookies ≥ 50% of cost. The
      // per-card render below already uses upgradeUnlocked; this makes list
      // inclusion consistent with it.
      let items = reachable.filter(u => upgradeUnlocked(u) || state.cookies >= u.cost * 0.5);

      // Preview the next not-yet-affordable (but tier-unlocked) upgrade in this
      // category so players know there's more coming in the current tier.
      const teaserIds = new Set();
      if (items.length < reachable.length) {
        const shown = new Set(items.map(u => u.id));
        const next = reachable.filter(u => !shown.has(u.id)).sort((a, b) => a.cost - b.cost)[0];
        if (next) {
          items = [...items, next];
          teaserIds.add(next.id);
        }
      }

      // Ascension-locked upgrades go last (they're the highest tier / most
      // expensive anyway), after the current-tier items.
      items = [...items, ...tierLocked];

      if (items.length === 0) continue;
      anyAvailable = true;

      // Category counter is tier-scoped too (denominator = only upgrades
      // available at the current tier), consistent with the main counter — so
      // "(4/8)" doesn't count locked future-tier upgrades the player can't buy.
      const categoryAvailableTotal = categoryAll.filter(u => tierUnlocked(u)).length;
      const boughtCount = categoryAll.filter(u => state.upgrades[u.id]).length;
      const header = document.createElement('div');
      header.className = 'section-header';
      header.textContent = `${t('cat.' + category)} (${boughtCount}/${categoryAvailableTotal})`;
      el.upgradesList.appendChild(header);

      // Free ad-view click-bypass progress: shown ONCE per the "click" section
      // (above its cards), so the free alternative is visible right where the
      // locked click cards live — not only in the Shop. Hidden once the bypass is
      // unlocked by any path; only while a click upgrade is still click-locked.
      if (category === 'click' && !state.hasClickBypass
          && items.some(u => u.reqType === 'clicks' && tierUnlocked(u) && !upgradeUnlocked(u))) {
        el.upgradesList.appendChild(buildAdBypassBlock());
      }

      for (const u of items) {
        const isTeaser = teaserIds.has(u.id);
        const unlocked = upgradeUnlocked(u);
        const tierOk = tierUnlocked(u);
        const affordable = state.cookies >= u.cost;
        // "Locked" = requirement not met yet (teaser preview, gated by
        // clicks/buildings/baked, or behind a prestige tier). Shows WHY it's
        // locked instead of a misleading buyable-looking card with a cost.
        // Prestige tier takes precedence in the reason — it's the outer gate.
        const showLocked = isTeaser || !unlocked || !tierOk;
        const lockReason = !tierOk ? tierLockText(itemTier(u)) : upgradeReqText(u);
        // Paid skip is offered ONLY for progress-gated upgrades (clicks etc.,
        // marked with skipStars in config) that aren't tier-locked. Referral
        // content (Layer 3b) is a building, has no skipStars, and never qualifies.
        const canSkip = tierOk && !upgradeUnlocked(u) && !!u.skipStars;
        let card;
        if (showLocked) {
          // Locked cards can host an inner "buy skip" <button>, so they're a
          // <div> (a <button> can't nest a <button>). They're non-interactive
          // as a whole anyway.
          card = document.createElement('div');
          card.className = 'upgrade-card locked';
          card.dataset.uid = u.id;
          // Per-card we only offer the per-UPGRADE Stars skip (price differs per
          // upgrade). The free ad-view path unlocks ALL click upgrades at once, so
          // it's shown ONCE per section (below the "click" header), not per card.
          const skipHtml = canSkip
            ? `<button class="upgrade-skip-btn" type="button">${u.skipStars} ⭐</button>`
            : '';
          card.innerHTML = `
            <div class="upgrade-icon">🔒</div>
            <div class="item-info">
              <div class="upgrade-name">${itemName(u)}</div>
              <div class="upgrade-desc">${lockReason}</div>
            </div>
            ${skipHtml}
          `;
          if (canSkip) {
            card.querySelector('.upgrade-skip-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              buyUpgradeSkip(u);
            });
          }
        } else {
          card = document.createElement('button');
          card.className = 'upgrade-card' + (affordable ? '' : ' disabled');
          card.dataset.uid = u.id;
          card.innerHTML = `
            <div class="upgrade-icon">${u.icon}</div>
            <div class="item-info">
              <div class="upgrade-name">${itemName(u)}</div>
              <div class="upgrade-desc">${upgradeDescText(u)}</div>
              <div class="upgrade-effect">${upgradeEffectText(u)}</div>
            </div>
            <div class="upgrade-cost">${formatNum(u.cost)} 🍪</div>
          `;
          card.addEventListener('click', () => buyUpgrade(u));
        }
        el.upgradesList.appendChild(card);
      }
    }

    if (!anyAvailable) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = boughtTotal === 0
        ? t('up.emptyGrow')
        : boughtTotal >= totalCount
          ? t('up.emptyAll')
          : t('up.emptyDone');
      el.upgradesList.appendChild(hint);
    }

    // --- "Выполнено (N)" — свёрнутая секция снизу со всеми купленными апгрейдами.
    if (boughtTotal > 0) {
      const section = document.createElement('div');
      section.className = 'completed-section';

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'completed-header';
      head.setAttribute('aria-expanded', String(completedExpanded));
      head.innerHTML = `<span class="chevron">▸</span><span>${t('up.completed', { n: boughtTotal })}</span>`;
      section.appendChild(head);

      const body = document.createElement('div');
      body.className = 'completed-body' + (completedExpanded ? ' open' : '');
      const inner = document.createElement('div');
      inner.className = 'completed-inner';
      for (const category of CATEGORY_ORDER) {
        const boughtInCat = UPGRADES.filter(u => u.category === category && state.upgrades[u.id]);
        if (boughtInCat.length === 0) continue;
        const ch = document.createElement('div');
        ch.className = 'section-header';
        ch.textContent = t('cat.' + category);
        inner.appendChild(ch);
        for (const u of boughtInCat) {
          const card = document.createElement('div');
          card.className = 'upgrade-card bought';
          card.dataset.uid = u.id;
          card.innerHTML = `
            <div class="upgrade-icon">✅</div>
            <div class="item-info">
              <div class="upgrade-name">${itemName(u)}</div>
              <div class="upgrade-desc">${upgradeDescText(u)}</div>
            </div>
          `;
          inner.appendChild(card);
        }
      }
      body.appendChild(inner);
      section.appendChild(body);

      head.addEventListener('click', () => {
        completedExpanded = !completedExpanded;
        body.classList.toggle('open', completedExpanded);
        head.setAttribute('aria-expanded', String(completedExpanded));
        haptic('light');
      });

      el.upgradesList.appendChild(section);
    }
  }

  // Purchase feedback: a bought upgrade shouldn't just vanish from "Доступно".
  // Fly a clone of the card from where it was to the "Выполнено" header (which
  // is collapsed by default), then bump that header so the eye follows it.
  function flyUpgradeToCompleted(u, startRect) {
    const header = el.upgradesList.querySelector('.completed-header');
    const clone = document.createElement('div');
    clone.className = 'upgrade-card bought upgrade-flying-clone';
    clone.innerHTML = `
      <div class="upgrade-icon">✅</div>
      <div class="item-info">
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
      </div>
    `;
    clone.style.left = `${startRect.left}px`;
    clone.style.top = `${startRect.top}px`;
    clone.style.width = `${startRect.width}px`;
    document.body.appendChild(clone);

    const end = header
      ? header.getBoundingClientRect()
      : { left: startRect.left, top: window.innerHeight - 40, width: startRect.width, height: 40 };
    const dx = (end.left + end.width / 2) - (startRect.left + startRect.width / 2);
    const dy = (end.top + end.height / 2) - (startRect.top + startRect.height / 2);

    // Commit the initial state with a forced reflow, then set the target so the
    // transition fires deterministically (doesn't depend on rAF, which browsers
    // pause while the tab is backgrounded).
    void clone.offsetWidth;
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.35)`;
    clone.style.opacity = '0';

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clone.remove();
      if (header) {
        header.classList.remove('bump');
        void header.offsetWidth; // restart the animation if it's already running
        header.classList.add('bump');
      }
    };
    clone.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 600); // fallback if transitionend doesn't fire
  }

  function renderStats() {
    const rows = [
      [t('stat.totalBaked'), formatNum(state.totalBaked)],
      [t('stat.clicks'), formatNum(state.totalClicks)],
      [t('stat.cps'), formatNum(getCps())],
      [t('stat.clickPower'), formatNum(getClickPower())],
      [t('stat.clickUpg'), `${countBoughtUpgrades('click')}/${CLICK_UPGRADES_TOTAL}`],
      [t('stat.buildings'), Object.values(state.buildings).reduce((a, c) => a + c, 0)],
      [t('stat.upgrades'), Object.keys(state.upgrades).length],
      [t('stat.streak'), state.dailyStreak || 0],
      [t('stat.ascensions'), state.ascensionCount || 0],
    ];
    el.statsList.innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><span>${v}</span></div>`).join('');

    // Ascension card: показываем сразу итоговый % (1 крошка = 1%, промежуточную
    // "валюту" не выводим). Число — hero. До первого вознесения строка
    // "Постоянный бонус" = +0% (бессмысленна), поэтому её скрываем и показываем
    // однострочник; после — показываем текущий бонус.
    const ascended = (state.ascensionCount || 0) >= 1;
    el.ascendPreview.textContent = `+${formatNum(potentialCrumbs())}%`;
    if (el.ascendPreviewLabel) el.ascendPreviewLabel.textContent = ascended
      ? t('asc.heroLabelNext')
      : t('asc.heroLabelFirst');
    if (el.ascendFirstTime) el.ascendFirstTime.hidden = ascended;
    if (el.ascendRows) el.ascendRows.hidden = !ascended;
    el.ascendBonus.textContent = `+${state.totalCrumbs || 0}%`;

    // Ascension is gated on buying everything: disable the button (with the
    // remaining count) until the player has completed the tier.
    if (el.ascendBtn) {
      const ready = ascensionAvailable();
      el.ascendBtn.disabled = !ready;
      el.ascendBtn.classList.toggle('locked', !ready);
      if (ready) {
        el.ascendBtn.textContent = t('asc.btn');
      } else {
        el.ascendBtn.textContent = t('asc.locked', { rest: remainingContentLabel() });
      }
    }

    // All Stars/ad offer buttons (Shop + any open header popup) are labelled and
    // disabled by the single shared renderer, from `state` — so every entry
    // point for a given boost shows identical owned/pending/limit state.
    renderOffers();
    // Free ad-view path to the click-bypass: the Shop's progress bar next to the
    // 100⭐ button (hidden once the bypass is unlocked by ANY path). The button
    // inside it is an offer (data-offer="adBypass"), already handled above.
    if (el.adBypassProgress) {
      el.adBypassProgress.hidden = !!state.hasClickBypass;
      if (!state.hasClickBypass) renderAdBypassBar(el.adBypassCount, el.adBypassFill);
    }

    el.syncStatus.textContent = cloudStorageStatusText();
  }

  // Ad-view click-bypass progress, as shared data (used by the Shop's bar and by
  // the "📺 X/Y" badge on locked click-upgrade cards). Reads shared state, so the
  // count never diverges between the two places it's shown.
  function adBypassProgressValues() {
    const target = state.adClickBypassTarget || AD_CLICK_BYPASS_TARGET_FALLBACK;
    const views = Math.min(state.adClickBypassViews || 0, target);
    return { views, target };
  }
  function renderAdBypassBar(countEl, fillEl) {
    const { views, target } = adBypassProgressValues();
    if (countEl) countEl.textContent = `${views} / ${target}`;
    if (fillEl) fillEl.style.width = `${Math.round((views / target) * 100)}%`;
  }

  // Builds the ad-view click-bypass progress block (same visual as the Shop's,
  // reused on the Upgrades tab above the locked click cards). The count/bar are
  // filled from shared state (renderAdBypassBar) and the "+1 view" button is a
  // standard offer (data-offer="adBypass") — so it shares the Shop's daily-limit
  // label and the one shared action. No duplicated logic, just a second mount.
  function buildAdBypassBlock() {
    const wrap = document.createElement('div');
    wrap.className = 'ad-bypass-progress ad-bypass-inline';
    wrap.innerHTML = `
      <div class="ad-bypass-head">
        <span>${t('shop.adBypassOr')}</span>
        <span class="ad-bypass-count"></span>
      </div>
      <div class="ad-bypass-bar"><div class="ad-bypass-fill"></div></div>
      <button class="ad-btn" type="button" data-offer="adBypass"></button>
    `;
    renderAdBypassBar(wrap.querySelector('.ad-bypass-count'), wrap.querySelector('.ad-bypass-fill'));
    OFFERS.adBypass.render(wrap.querySelector('[data-offer="adBypass"]')); // shared label/disabled
    return wrap;
  }

  // Language-aware "Xh Ym" from a minute count (units from the i18n table).
  function fmtHMText(totalMin) {
    return `${Math.floor(totalMin / 60)}${t('time.h')} ${totalMin % 60}${t('time.m')}`;
  }
  function fmtHM(ms) {
    return fmtHMText(Math.max(0, Math.round(ms / 60000)));
  }

  // Compact duration: drops the hours part when zero (good for the ≤1h x2 boost).
  function fmtDur(ms) {
    const secs = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (h > 0) return `${h}${t('time.h')} ${m}${t('time.m')}`;
    if (m > 0) return `${m} ${t('time.m')}`;
    return `${s} ${t('time.s')}`;
  }

  // Russian count agreement for "друг": 1 друг, 2 друга, 5 друзей.
  function friendWord(n) {
    if ((state && state.lang) === 'en') return Math.abs(n) === 1 ? 'friend' : 'friends';
    const a = Math.abs(n) % 100, b = a % 10;
    if (a >= 11 && a <= 14) return 'друзей';
    if (b === 1) return 'друг';
    if (b >= 2 && b <= 4) return 'друга';
    return 'друзей';
  }

  // Generic Russian plural: pluralRu(1,'здание','здания','зданий') → 'здание'.
  function pluralRu(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a >= 11 && a <= 14) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  function buildingWord(n) {
    if ((state && state.lang) === 'en') return Math.abs(n) === 1 ? 'building' : 'buildings';
    return pluralRu(n, 'здание', 'здания', 'зданий');
  }
  function upgradeWord(n) {
    if ((state && state.lang) === 'en') return Math.abs(n) === 1 ? 'upgrade' : 'upgrades';
    return pluralRu(n, 'апгрейд', 'апгрейда', 'апгрейдов');
  }

  // "Друзья" tab: player profile (name + titles, moved here from the old army
  // card) + personal referral payoff (Priority 1) + the full milestone track
  // (Priority 2). Figures come straight from state/formulas.
  function renderFriendsTab() {
    if (!el.fsFriends) return;
    // Channel-subscription card: persistent here, hidden once the bonus is
    // claimed (by any path). Non-blocking — this tab is never the first screen.
    if (el.channelCard) el.channelCard.hidden = !!state.channelBonusClaimed;
    const army = state.activeReferrals || 0;
    const peak = state.maxActiveFriendsEver || 0;

    // Profile line (moved from the removed «Печенькина армия» card): name +
    // earned titles (referral title by peak friends + prestige-tier milestone).
    if (el.playerProfile) {
      const cur = titleFor(peak);
      const refBadge = cur
        ? `<span class="title-badge">${cur.icon} ${t(cur.nameKey)}</span>`
        : `<span class="title-badge title-badge-none">${t('title.none')}</span>`;
      const pt = prestigeTitleForTier(displayTier());
      const prestigeBadge = pt ? `<span class="title-badge title-badge-prestige">${pt.icon} ${t(pt.nameKey)}</span>` : '';
      el.playerProfile.innerHTML = `<span class="pp-name">👤 ${escapeHtml(ownDisplayName())}</span>${prestigeBadge}${refBadge}`;
    }

    // Priority 1 — what you already get from invited friends.
    el.fsFriends.textContent = formatNum(army);
    el.fsBoost.textContent = `+${(referralBoost(army) * 100).toFixed(1).replace(/\.0$/, '')}%`;
    // Offline line — boost-aware: show the paid no-cap countdown while it's live
    // (moved from the army card), otherwise the friend-extended full-rate cap.
    const boostLeft = (state.boostExpiresAt || 0) - Date.now();
    if (boostLeft > 0) {
      if (el.fsOfflineLabel) el.fsOfflineLabel.textContent = t('fr.offlineBoost');
      el.fsOffline.textContent = t('evt.remain', { t: fmtHM(boostLeft) });
    } else {
      if (el.fsOfflineLabel) el.fsOfflineLabel.textContent = t('fr.offlineFull');
      const capMin = Math.round(getOfflineCapHours(army) * 60);
      const baseMin = Math.round((Number.isFinite(state.offlineBaseHours) ? state.offlineBaseHours : OFFLINE_BASE_HOURS_DEFAULT) * 60);
      const extraMin = Math.max(0, capMin - baseMin);
      const capStr = fmtHMText(capMin);
      const extraStr = extraMin >= 60 ? fmtHMText(extraMin) : `${extraMin}${t('time.m')}`;
      el.fsOffline.textContent = extraMin > 0 ? t('fr.offlineExtra', { cap: capStr, extra: extraStr }) : capStr;
    }

    // Priority 2 — full milestone track, current position + next threshold.
    const next = REF_MILESTONES.find(m => peak < m.n);
    el.friendsMilestones.innerHTML = REF_MILESTONES.map(m => {
      const done = peak >= m.n;
      const isNext = next && next.n === m.n;
      const status = done ? t('ms.open') : (isNext ? t('ms.left', { n: m.n - peak }) : '🔒');
      return `<div class="ms-row${done ? ' done' : ''}${isNext ? ' next' : ''}">
        <span class="ms-icon">${done ? m.icon : '🔒'}</span>
        <span class="ms-info"><span class="ms-n">${m.n} ${friendWord(m.n)}</span><span class="ms-label">${t(m.labelKey)}</span></span>
        <span class="ms-status">${status}</span>
      </div>`;
    }).join('');
    el.friendsMsNext.textContent = next
      ? t('ms.nextReward', { n: next.n - peak, friends: friendWord(next.n - peak), label: t(next.labelKey) })
      : t('ms.allOpen');
  }

  function refreshAll() {
    applyStaticI18n();
    renderTopbar();
    renderBuildings();
    renderUpgrades();
    renderStats();
    renderFriendsTab();
    renderPrestigeBanner();
    renderRewardTeaser();
    updateTutorial();
    updateDailyBadge();
    applyPrestigeTheme();
  }

  // Prestige (ascension) unlocks the "Золотой век" look: a golden background and
  // a chocolate cookie. Keyed off ascensionCount so it turns on the moment the
  // player ascends (refreshAll runs right after ascend()) and persists across
  // reloads. Idempotent — safe to call on every refresh.
  function applyPrestigeTheme() {
    const asc = state.ascensionCount || 0;
    // The golden background/topbar kicks in at the 1st ascension and stays for
    // all higher tiers (a good "prestige" backdrop behind every tier cookie).
    document.body.classList.toggle('theme-golden', asc >= 1);
    // Per-tier cookie art: data-tier picks which PNG .cookie-svg shows (see CSS).
    // data-tier == ascensionCount: 0→base (tier1), 1→tier2 … 9→tier10. Clamp to
    // the highest tier we have art for so tier 11+ keeps the tier-10 cookie.
    document.body.dataset.tier = String(Math.min(asc, 9));
  }

  // Onboarding.
  //  Step 0: until the very first cookie tap, gently pulse the cookie and show
  //          a non-blocking "tap me" hint. Nothing intercepts the tap.
  //  Step 1: once tapping is understood and the player can actually afford an
  //          upgrade, glow the "Апгрейды" tab + a bubble above it. Non-modal,
  //          dismissed by the next tap anywhere (or by opening the tab).
  const upgradesTabBtn = document.querySelector('.tab-btn[data-tab="upgrades"]');

  function hasAffordableUpgrade() {
    return UPGRADES.some(u => !state.upgrades[u.id] && tierUnlocked(u) && upgradeUnlocked(u) && state.cookies >= u.cost);
  }

  function tut() { state.tutorial = state.tutorial || {}; return state.tutorial; }

  function updateTutorial() {
    if (!el.clickHint) return;
    const t = tut();
    // totalClicks === 0 keeps step 0 from ambushing players who existed before
    // the tutorial (their tutorial flags are empty but they've clearly tapped).
    const showClick = !t.clicked && state.totalClicks === 0;
    el.clickHint.hidden = !showClick;
    el.bigCookie.classList.toggle('tutorial-pulse', showClick);

    const activeTab = document.querySelector('.tab-btn.active');
    const onUpgrades = activeTab && activeTab.dataset.tab === 'upgrades';
    // Only nudge toward the FIRST upgrade of a genuinely new player: none bought
    // yet AND never ascended (ascension resets upgrades to {} but keeps tutorial
    // flags, which otherwise re-triggers this pulse for veterans).
    const showUpgrade = t.clicked && !t.upgradeHintDone &&
      (state.ascensionCount || 0) === 0 &&
      Object.keys(state.upgrades).length === 0 &&
      state.totalClicks >= 3 && !onUpgrades && hasAffordableUpgrade();
    el.upgradeHint.hidden = !showUpgrade;
    if (upgradesTabBtn) upgradesTabBtn.classList.toggle('tutorial-pulse-tab', showUpgrade);
    if (showUpgrade) { positionUpgradeHint(); armUpgradeDismiss(); }
    else disarmUpgradeDismiss();
  }

  function positionUpgradeHint() {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return;
    const r = tabs.getBoundingClientRect();
    el.upgradeHint.style.bottom = (window.innerHeight - r.top + 8) + 'px';
  }

  let upgradeDismissArmed = false;
  let upgradeDismissTimer = null;
  function onUpgradeDismiss() { markUpgradeHintSeen(); }
  function armUpgradeDismiss() {
    if (upgradeDismissArmed) return;
    upgradeDismissArmed = true;
    document.addEventListener('pointerdown', onUpgradeDismiss, { capture: true, once: true });
    // Also auto-dismiss after a short window so the pulse can never flash
    // indefinitely if the player just ignores it.
    clearTimeout(upgradeDismissTimer);
    upgradeDismissTimer = setTimeout(markUpgradeHintSeen, 8000);
  }
  function disarmUpgradeDismiss() {
    if (!upgradeDismissArmed) return;
    upgradeDismissArmed = false;
    clearTimeout(upgradeDismissTimer);
    document.removeEventListener('pointerdown', onUpgradeDismiss, { capture: true });
  }
  function markUpgradeHintSeen() {
    upgradeDismissArmed = false;
    const t = tut();
    if (!t.upgradeHintDone) { t.upgradeHintDone = true; saveState(); }
    updateTutorial();
  }

  // ---------- Actions ----------
  function buyBuilding(b) {
    if (b.referralLocked) return; // referral buildings are placed for free, never bought
    if (!tierUnlocked(b)) { showToast(tierLockText(itemTier(b))); haptic('light'); return; }
    const count = state.buildings[b.id];
    const cost = buildingCost(b, count);
    if (state.cookies < cost) { haptic('light'); return; }
    state.cookies -= cost;
    state.buildings[b.id] += 1;
    haptic('medium');
    refreshAll();
  }

  function placeReferralBuilding(b) {
    const peak = state.maxActiveFriendsEver || 0;
    if (peak < b.unlockFriends) { showToast(t('ref.buildingLocked', { n: b.unlockFriends })); haptic('light'); return; }
    if (state.buildings[b.id] >= 1) return; // unique — already placed
    state.buildings[b.id] = 1;
    if (state.referralOffered) state.referralOffered[b.id] = true;
    haptic('heavy');
    showToast(t('toast.buildingPlaced', { icon: b.icon, name: itemName(b) }));
    refreshAll();
  }

  // Referral-building unlock popup. Fires once per building (referralOffered
  // flag) when its threshold is first met and it hasn't been placed — covers
  // both crossing the threshold live and being already-eligible on load. Held
  // back while the daily-reward modal is up so the two never stack.
  let pendingUnlockBuilding = null;

  function maybeOfferReferralBuildings() {
    if (!el.unlockModal || el.dailyModal.classList.contains('show') || el.unlockModal.classList.contains('show')) return;
    if (!state.referralOffered) state.referralOffered = {};
    const peak = state.maxActiveFriendsEver || 0;
    for (const b of BUILDINGS) {
      if (!b.referralLocked) continue;
      if (peak >= b.unlockFriends && !state.buildings[b.id] && !state.referralOffered[b.id]) {
        state.referralOffered[b.id] = true;
        saveState();
        showUnlockModal(b);
        return; // one at a time
      }
    }
  }

  function showUnlockModal(b) {
    pendingUnlockBuilding = b;
    el.unlockIcon.textContent = b.icon;
    el.unlockName.textContent = itemName(b);
    el.unlockDesc.textContent = t('ref.unlockDesc', { n: b.unlockFriends });
    el.unlockModal.classList.add('show');
    haptic('heavy');
  }

  function hideUnlockModal() {
    el.unlockModal.classList.remove('show');
    pendingUnlockBuilding = null;
  }

  // Persistent teaser above the cookie for the first not-yet-placed referral
  // building: shows friend progress ("ещё N друзей") and a tap-to-invite CTA,
  // or a "поставить" CTA once unlocked. Hides itself once the building is
  // placed (or if there are no referral buildings left to earn).
  let teaserBuilding = null;
  // Prestige-invitation banner. Fires once the player has bought every upgrade
  // currently reachable (all tier-unlocked ones) — the "nothing left to buy"
  // signal — and ascending is actually worthwhile (crumbs > 0, so the CTA never
  // dead-ends on the "too early" guard in ascend()).
  // --- Прогресс к вознесению: считаем НЕкупленный контент текущего тира. ---
  // Ascension is a full-completion gate: own every currently-purchasable
  // building (≥1 each) and buy every reachable upgrade. The referral-only
  // building (Пекарня дружбы) is excluded — it's gated behind friends, not
  // cookies, so it must never block progression. Tier-locked content doesn't
  // count until the tier it belongs to is reached.
  function purchasableBuildings() {
    return BUILDINGS.filter(b => !b.referralLocked && tierUnlocked(b));
  }
  function unboughtBuildingCount() {
    return purchasableBuildings().filter(b => (state.buildings[b.id] || 0) < 1).length;
  }
  function unboughtUpgradeCount() {
    return UPGRADES.filter(u => tierUnlocked(u) && !state.upgrades[u.id]).length;
  }
  function allContentBought() {
    return unboughtBuildingCount() === 0 && unboughtUpgradeCount() === 0;
  }
  function ascensionAvailable() {
    return allContentBought() && potentialCrumbs() > 0;
  }

  // What's still blocking ascension. When only a few items remain, name them
  // (so the player knows exactly what to buy — e.g. an upgrade that just
  // unlocked by clicks but hasn't been purchased yet); otherwise fall back to
  // counts. The upgrade card itself shows whether it's buyable or still
  // progress-gated, so the label just names them.
  function remainingContentItems() {
    return [
      ...purchasableBuildings().filter(b => (state.buildings[b.id] || 0) < 1),
      ...UPGRADES.filter(u => tierUnlocked(u) && !state.upgrades[u.id]),
    ];
  }
  function remainingContentLabel() {
    const items = remainingContentItems();
    if (items.length === 0) return '';
    if (items.length <= 3) return items.map(it => it.name).join(', ');
    const b = unboughtBuildingCount(), u = unboughtUpgradeCount();
    return t('content.remain', { b, bw: buildingWord(b), u, uw: upgradeWord(u) });
  }

  // Banner has two states: 'available' (everything bought — ascend now) and
  // 'soon' (≤2 buildings AND ≤2 upgrades left — a heads-up). null = not close.
  function prestigeBannerState() {
    if (ascensionAvailable()) return 'available';
    if (unboughtBuildingCount() <= 2 && unboughtUpgradeCount() <= 2) return 'soon';
    return null;
  }

  function renderPrestigeBanner() {
    if (!el.prestigeBanner) return;
    const st = prestigeBannerState();
    if (!st) { el.prestigeBanner.hidden = true; return; }
    el.prestigeBanner.hidden = false;
    el.prestigeBanner.classList.toggle('available', st === 'available');
    el.prestigeBanner.classList.toggle('soon', st === 'soon');
    el.prestigeBannerCta.textContent = t('banner.cta');
    if (st === 'available') {
      el.prestigeBannerTitle.textContent = t('banner.allBought');
      el.prestigeBannerSub.textContent = t('banner.availSub', { n: formatNum(potentialCrumbs()) });
      el.prestigeBannerCta.hidden = false;
    } else {
      el.prestigeBannerTitle.textContent = t('banner.almostAll');
      el.prestigeBannerSub.textContent = t('banner.soonSub', { rest: remainingContentLabel() });
      el.prestigeBannerCta.hidden = true;
    }
  }

  function onPrestigeBannerClick() {
    if (prestigeBannerState() !== 'available') {
      // 'soon' — no ascend yet; nudge toward finishing the last purchases.
      showToast(t('toast.prestigeSoonNudge', { rest: remainingContentLabel() }), 3500);
      haptic('light');
      return;
    }
    // Lead to the confirmation screen (ascend card on the Stats tab) rather than
    // ascending straight away — a first-time player should see what they'll get.
    const stats = document.querySelector('.tab-btn[data-tab="stats"]');
    if (stats) stats.click();
    const card = el.ascendBtn && el.ascendBtn.closest('.ascend-card');
    if (card) {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    }
    haptic('medium');
  }

  function renderRewardTeaser() {
    if (!el.rewardTeaser) return;
    // Prestige banner outranks the referral teaser for the shared slot: nearing
    // (or reaching) full completion, ascending is the primary call to action.
    if (prestigeBannerState()) { el.rewardTeaser.hidden = true; return; }
    const b = BUILDINGS.find(x => x.referralLocked && !state.buildings[x.id]);
    teaserBuilding = b || null;
    if (!b) { el.rewardTeaser.hidden = true; return; }
    el.rewardTeaser.hidden = false;

    const peak = state.maxActiveFriendsEver || 0;
    const unlocked = peak >= b.unlockFriends;
    el.rewardTeaser.classList.toggle('ready', unlocked);
    el.rewardTeaserTitle.textContent = itemName(b);
    el.rewardTeaserFill.style.width = Math.min(100, peak / b.unlockFriends * 100) + '%';
    if (unlocked) {
      el.rewardTeaserSub.textContent = t('teaser.readySub');
      el.rewardTeaserCta.textContent = t('teaser.readyCta');
    } else {
      const n = b.unlockFriends - peak;
      el.rewardTeaserSub.textContent = t('teaser.sub', { n, friends: friendWord(n) });
      el.rewardTeaserCta.textContent = t('teaser.cta');
    }
  }

  function onRewardTeaserClick() {
    const b = teaserBuilding;
    if (!b) return;
    if ((state.maxActiveFriendsEver || 0) >= b.unlockFriends) {
      placeReferralBuilding(b);
      document.querySelector('.tab-btn[data-tab="buildings"]').click();
    } else {
      inviteFriend();
    }
  }

  function buyUpgrade(u) {
    if (state.upgrades[u.id]) return;
    if (!tierUnlocked(u)) { showToast(tierLockText(itemTier(u))); haptic('light'); return; }
    if (!upgradeUnlocked(u)) { haptic('light'); return; }
    if (state.cookies < u.cost) { haptic('light'); return; }
    const isFirstUpgrade = Object.keys(state.upgrades).length === 0;
    if (isFirstUpgrade) sendAnalyticsEvent('first_upgrade');
    // Capture where the card sits now, before the re-render moves it into the
    // (collapsed) "Выполнено" section — so we can fly a clone from here to there.
    const oldCard = el.upgradesList.querySelector(`.upgrade-card[data-uid="${u.id}"]`);
    const startRect = oldCard ? oldCard.getBoundingClientRect() : null;
    state.cookies -= u.cost;
    state.upgrades[u.id] = true;
    u.effect(state);
    haptic('rigid');
    showToast(t('toast.boughtNamed', { name: itemName(u) }));
    refreshAll();
    if (startRect) flyUpgradeToCompleted(u, startRect);
    // Tutorial step 2: the one and only offline-mechanic nudge, right after the
    // first upgrade. Cap/timer details are self-explained by the offline UI, so
    // keep it to a single line. Delayed so it follows the "bought" toast.
    const tu = tut();
    if (isFirstUpgrade && !tu.offlineHintDone) {
      tu.offlineHintDone = true;
      saveState();
      setTimeout(() => showToast(t('toast.offlineHint'), 5000), 1500);
    }
  }

  function clickCookie(x, y) {
    if (state.totalClicks === 0) sendAnalyticsEvent('first_click');
    const gain = getClickPower();
    state.cookies += gain;
    state.totalBaked += gain;
    state.totalClicks += 1;
    spawnFloatNum(gain, x, y);
    haptic('light');
    renderTopbar();
    // Step 0 done on the first-ever tap: dismiss the hint, stop the pulse.
    state.tutorial = state.tutorial || {};
    if (!state.tutorial.clicked) { state.tutorial.clicked = true; saveState(); updateTutorial(); }
    if (state.totalClicks % 5 === 0) { renderBuildings(); renderUpgrades(); }
  }

  function spawnFloatNum(gain, x, y) {
    const rect = el.bigCookie.getBoundingClientRect();
    const layerRect = el.floatLayer.getBoundingClientRect();
    const px = (x != null ? x : rect.left + rect.width / 2) - layerRect.left + (Math.random() * 30 - 15);
    const py = (y != null ? y : rect.top + rect.height / 2) - layerRect.top;
    const span = document.createElement('div');
    span.className = 'float-num';
    span.textContent = '+' + formatNum(gain);
    span.style.left = px + 'px';
    span.style.top = py + 'px';
    el.floatLayer.appendChild(span);
    setTimeout(() => span.remove(), 900);
  }

  let toastTimer = null;
  function showToast(msg, duration = 2200) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), duration);
  }

  let rewardBurstTimer = null;
  function showRewardBurst(amount) {
    el.rewardBurstAmount.textContent = formatNum(amount);
    el.rewardBurst.hidden = false;
    el.rewardBurst.classList.remove('show');
    void el.rewardBurst.offsetWidth; // restart the animation if it's already mid-play
    el.rewardBurst.classList.add('show');
    clearTimeout(rewardBurstTimer);
    rewardBurstTimer = setTimeout(() => {
      el.rewardBurst.hidden = true;
      el.rewardBurst.classList.remove('show');
    }, 3500);
  }

  async function resetProgress() {
    if (!(await confirmDialog(t('confirm.reset')))) return;
    backupCurrentState();
    state = defaultState();
    saveState();
    refreshAll();
  }

  // ---------- Golden cookie ----------
  function spawnGoldenCookie() {
    const zone = document.querySelector('.clicker-zone');
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const gc = document.createElement('button');
    gc.className = 'golden-cookie';
    gc.textContent = '🍪';
    const x = Math.random() * (rect.width - 60) + 10;
    const y = Math.random() * (rect.height - 60) + 10;
    gc.style.left = x + 'px';
    gc.style.top = y + 'px';
    gc.style.position = 'absolute';
    let expired = false;
    const timeout = setTimeout(() => { expired = true; gc.remove(); }, 8000);
    gc.addEventListener('click', () => {
      if (expired) return;
      clearTimeout(timeout);
      const bonusType = Math.random() < 0.5 ? 'frenzy' : 'bonus';
      if (bonusType === 'frenzy') {
        applyFrenzy();
        showToast(t('toast.frenzy'));
      } else {
        const bonus = Math.max(getCps() * 60, 50);
        state.cookies += bonus;
        state.totalBaked += bonus;
        showToast(t('toast.golden', { n: formatNum(bonus) }));
      }
      haptic('heavy');
      gc.remove();
      refreshAll();
    });
    el.floatLayer.appendChild(gc);
  }

  let frenzyUntil = 0;
  function applyFrenzy() {
    frenzyUntil = Date.now() + 30000;
  }

  function scheduleGolden() {
    const weekendActive = getActiveEvents().some(e => e.id === 'weekend');
    const factor = weekendActive ? 0.5 : 1;
    const delay = (25000 + Math.random() * 45000) * factor;
    setTimeout(() => {
      spawnGoldenCookie();
      scheduleGolden();
    }, delay);
  }

  // ---------- Tabs ----------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      // Drives the layout shrink: on non-buildings tabs the decorative cookie
      // collapses (CSS body[data-active-tab]) so the tab content gets the room.
      document.body.dataset.activeTab = btn.dataset.tab;
      if (btn.dataset.tab === 'leaderboard') { sendCheckin(); loadLeaderboard(); updateWeekTimer(); }
      if (btn.dataset.tab === 'friends') { sendCheckin(); loadReferralLeaderboard(); renderFriendsTab(); }
      if (btn.dataset.tab === 'upgrades') markUpgradeHintSeen(); // they followed the step-1 nudge
    });
  });
  document.body.dataset.activeTab = 'buildings'; // initial active tab (drives layout)

  el.refToggleWeekly.addEventListener('click', () => setRefPeriod('weekly'));
  el.refToggleAll.addEventListener('click', () => setRefPeriod('alltime'));
  if (el.lbToggleGlobal) el.lbToggleGlobal.addEventListener('click', () => setLbMode('global'));
  if (el.lbToggleFriends) el.lbToggleFriends.addEventListener('click', () => setLbMode('friends'));
  if (el.lbToggleCountry) el.lbToggleCountry.addEventListener('click', () => setLbMode('country'));
  if (el.lbToggleAll) el.lbToggleAll.addEventListener('click', () => setLbPeriod('all'));
  if (el.lbToggleWeek) el.lbToggleWeek.addEventListener('click', () => setLbPeriod('week'));
  // Header rank badge → jump to the Top tab.
  if (el.rankBadge) el.rankBadge.addEventListener('click', () => {
    const btn = document.querySelector('.tab-btn[data-tab="leaderboard"]');
    if (btn) btn.click();
  });

  // ---------- Passive income loop ----------
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const frenzyMult = now < frenzyUntil ? 7 : 1;
    const gain = getCps() * prod2xMultiplier() * frenzyMult * dt;
    if (gain > 0) {
      state.cookies += gain;
      state.totalBaked += gain;
      renderTopbar();
    }
    requestAnimationFrame(tick);
  }

  // ---------- Init ----------
  el.bigCookie.addEventListener('click', (e) => {
    clickCookie(e.clientX, e.clientY);
  });

  document.getElementById('resetBtn').addEventListener('click', resetProgress);
  el.ascendBtn.addEventListener('click', ascend);
  el.pushCloudBtn.addEventListener('click', pushToCloud);
  el.pullCloudBtn.addEventListener('click', pullFromCloud);
  el.restoreBackupBtn.addEventListener('click', restoreBackup);
  if (el.fsInviteBtn) el.fsInviteBtn.addEventListener('click', inviteFriend);
  if (el.channelSubBtn) el.channelSubBtn.addEventListener('click', openChannel);
  if (el.channelClaimBtn) el.channelClaimBtn.addEventListener('click', claimChannelBonus);
  if (el.dailyChannelSubBtn) el.dailyChannelSubBtn.addEventListener('click', openChannel);
  if (el.dailyChannelClaimBtn) el.dailyChannelClaimBtn.addEventListener('click', claimChannelBonus);
  el.dailyBadge.addEventListener('click', showDailyModal);
  el.dailyClaimBtn.addEventListener('click', claimDailyReward);
  el.dailyInviteBtn.addEventListener('click', inviteFriend);
  el.offlineClaimBtn.addEventListener('click', claimOfflineFree);
  el.offlineX2Btn.addEventListener('click', claimOfflinePaid);
  // Single delegated dispatch for EVERY offer button (Shop + header popups),
  // so a boost triggered from any entry point runs the one shared action.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-offer]');
    if (!btn || btn.disabled) return;
    const o = OFFERS[btn.dataset.offer];
    if (!o) return;
    if (btn.closest('.offer-popup')) closeOfferPopup(); // header popup: dismiss on choice
    o.action();
  });
  // Header contextual entry points: tap the offline timer / CPS number to open a
  // 2-offer popup right where the friction is felt.
  if (el.offlineInfoLine) el.offlineInfoLine.addEventListener('click', () => openOfferPopup('popup.offlineTitle', ['nocap', 'adNocap'], offlineExplainText()));
  if (el.cps) el.cps.addEventListener('click', () => openOfferPopup('popup.cpsTitle', ['boost2x', 'adBoost2x']));
  if (el.offerPopup) el.offerPopup.addEventListener('click', (e) => { if (e.target === el.offerPopup) closeOfferPopup(); });
  // Tapping the backdrop = free claim (never lose offline income); ignored while
  // a payment is processing.
  el.offlineModal.addEventListener('click', (e) => {
    if (e.target === el.offlineModal && !el.offlineModal.classList.contains('processing')) claimOfflineFree();
  });
  el.unlockPlaceBtn.addEventListener('click', () => {
    const b = pendingUnlockBuilding;
    hideUnlockModal();
    if (b) {
      placeReferralBuilding(b);
      document.querySelector('.tab-btn[data-tab="buildings"]').click(); // show the newly placed building
    }
  });
  el.unlockModal.addEventListener('click', (e) => { if (e.target === el.unlockModal) hideUnlockModal(); });
  // Settings (⚙️): open the modal; close via the button or backdrop tap.
  if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => el.settingsModal.classList.add('show'));
  if (el.langRuBtn) el.langRuBtn.addEventListener('click', () => setLang('ru'));
  if (el.langEnBtn) el.langEnBtn.addEventListener('click', () => setLang('en'));
  if (el.settingsCloseBtn) el.settingsCloseBtn.addEventListener('click', () => el.settingsModal.classList.remove('show'));
  if (el.settingsModal) el.settingsModal.addEventListener('click', (e) => { if (e.target === el.settingsModal) el.settingsModal.classList.remove('show'); });
  el.rewardTeaser.addEventListener('click', onRewardTeaserClick);
  if (el.leaderboardList) el.leaderboardList.addEventListener('click', onLeaderboardBadgeTap);
  if (el.leaderboardSelf) el.leaderboardSelf.addEventListener('click', onLeaderboardBadgeTap);
  if (el.prestigeBanner) el.prestigeBanner.addEventListener('click', onPrestigeBannerClick);

  initAdsgram();
  loadState();
  requestAnimationFrame(tick);
  setInterval(() => { renderBuildings(); renderUpgrades(); renderStats(); renderPrestigeBanner(); renderRewardTeaser(); updateTutorial(); updateDailyBadge(); maybeOfferReferralBuildings(); }, 3000);
  setInterval(() => { state.lastTs = Date.now(); saveState(); }, 10000);
  // Keep the leaderboard/push-worker record fresh during a long play session
  // instead of only ever reflecting the moment the app was opened. Managed so we
  // can PAUSE it while the tab is hidden: a backgrounded Mini App left open all
  // day would otherwise keep writing to KV every few minutes — the dominant
  // driver of KV put usage (and the free-tier daily put cap). Interval widened
  // 2→4 min (still within the ~6-min "online" window); reward pickup is
  // unaffected because we also checkin immediately whenever the tab is shown.
  let checkinTimer = null;
  function startCheckinLoop() { if (checkinTimer == null) checkinTimer = setInterval(sendCheckin, 240000); }
  function stopCheckinLoop() { if (checkinTimer != null) { clearInterval(checkinTimer); checkinTimer = null; } }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCheckinLoop();
    else { sendCheckin(); startCheckinLoop(); } // catch up on return, then resume
  });
  if (!document.hidden) startCheckinLoop();
  updateEventBanner();
  setInterval(updateEventBanner, 1000);
  setInterval(updateRefEventBanner, 1000);
  setInterval(updateWeekTimer, 1000);
  setInterval(() => {
    renderOfflineInfo();
    // Keep an open header popup's offer labels fresh (extend-vs-buy, ad limit).
    if (el.offerPopup && el.offerPopup.classList.contains('show')) renderOffers();
  }, 1000);
  setInterval(renderBoost2xInfo, 1000);
  scheduleGolden();

  window.addEventListener('beforeunload', () => { state.lastTs = Date.now(); saveState(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { state.lastTs = Date.now(); saveState(); }
  });
})();
