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

  // ---------- Game data ----------
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
    { id: 'click_u1', name: 'Крепкая хватка', desc: 'Сила клика x2', icon: '💪', cost: 500, category: 'click', reqType: 'clicks', reqValue: 20, req: (b, s) => s.totalClicks >= 20, effect: s => s.clickMult *= 2 },
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
    { id: 'click_u4', name: 'Космический щелчок', desc: 'Сила клика x2', icon: '👊', cost: 4000000, category: 'click', reqType: 'clicks', reqValue: 20000, req: (b, s) => s.totalClicks >= 20000, effect: s => s.clickMult *= 2 },
    // --- New global upgrades ---
    { id: 'global_u8', name: 'Космическая закваска', desc: 'Всё производство x2', icon: '💠', cost: 1500000000000000, category: 'global', reqType: 'baked', reqValue: 340000000000000, req: (b, s) => s.totalBaked >= 340000000000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u9', name: 'Пекарня богов', desc: 'Всё производство x2', icon: '🔆', cost: 20000000000000000, category: 'global', reqType: 'baked', reqValue: 4500000000000000, req: (b, s) => s.totalBaked >= 4500000000000000, effect: s => s.globalMult *= 2 },
    { id: 'global_u10', name: 'Печенька-творец', desc: 'Всё производство x2', icon: '🎆', cost: 260000000000000000, category: 'global', reqType: 'baked', reqValue: 60000000000000000, req: (b, s) => s.totalBaked >= 60000000000000000, effect: s => s.globalMult *= 2 },
  ];

  const CATEGORY_LABELS = {
    click: '⚡ Улучшения клика',
    building: '🏭 Улучшения зданий',
    global: '✨ Глобальные',
  };
  const CATEGORY_ORDER = ['click', 'building', 'global'];
  const CLICK_UPGRADES_TOTAL = UPGRADES.filter(u => u.category === 'click').length;

  // Referral titles, unlocked by peak active-friend count (max_active_friends_ever
  // on the server — never the live count, so a title never regresses when a
  // friend goes inactive). Ascending by threshold. Also used to render other
  // players' titles in the leaderboard from their maxActiveFriendsEver.
  const TITLES = [
    { threshold: 25,  name: 'Общительная печенька', icon: '🍪' },
    { threshold: 50,  name: 'Легенда Печенек',      icon: '⭐' },
    { threshold: 100, name: 'Император Печенек',    icon: '👑' },
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
  const EVENTS_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/event';

  // Offline claim: below this, offline income auto-applies silently (as before);
  // at/above it we show the claim card with the free x1 / paid x2 choice.
  const OFFLINE_CLAIM_THRESHOLD_SECONDS = 300; // ~5 min of current production
  const OFFLINE_CLAIM_MIN = 100;               // absolute floor, so low-cps players aren't prompted for crumbs
  const OFFLINE_BOOST_STARS = 15;              // must match OFFLINE_BOOST_STARS in push/src/index.js
  const BOT_USERNAME = 'bestcookieclickerbot';

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
  });

  let state = defaultState();

  // ---------- Save / Load ----------
  function saveState() {
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
          if (state.offlinePending > 1) showToast(`Пока вас не было, испечено ${formatNum(state.offlinePending)} 🍪`);
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
      case 'ok': return '☁️ Облако Telegram — синхронизируется между устройствами';
      case 'no-telegram': return '📱 Не в Telegram — сохранение только в этом браузере';
      case 'no-cloudstorage-api': return '⚠️ CloudStorage недоступен — сохранение только на этом устройстве';
      default: return '⚠️ Версия Telegram устарела для облака — сохранение только на этом устройстве';
    }
  }

  // One level of undo for any destructive action (pull/reset/ascend) — a
  // snapshot taken right before the action, restorable via restoreBackup().
  function backupCurrentState() {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function restoreBackup() {
    let raw;
    try { raw = localStorage.getItem(BACKUP_KEY); } catch (e) { raw = null; }
    if (!raw) { showToast('Резервной копии нет'); return; }
    if (!confirm('Восстановить прогресс на этом устройстве из последней резервной копии? Текущий прогресс на этом устройстве заменится.')) return;
    if (applyLoaded(raw, { grantOfflineProgress: false })) {
      saveState();
      showToast('✅ Восстановлено из резервной копии');
    } else {
      showToast('Резервная копия повреждена');
    }
  }

  function pushToCloud() {
    if (!tg || !tg.CloudStorage) { showToast('CloudStorage недоступен на этом устройстве'); return; }
    tg.CloudStorage.getItem(SAVE_KEY, (getErr, existing) => {
      let existingBaked = 0;
      if (!getErr && existing) {
        try { existingBaked = JSON.parse(existing).totalBaked || 0; } catch (e) { /* ignore */ }
      }
      const msg = `Здесь: всего испечено ${formatNum(state.totalBaked)} 🍪.\n`
        + `Сейчас в облаке: всего испечено ${formatNum(existingBaked)} 🍪.\n\n`
        + `Заменить сохранение в облаке данными с этого устройства?`;
      if (!confirm(msg)) return;
      tg.CloudStorage.setItem(SAVE_KEY, JSON.stringify(state), (err, success) => {
        if (err || success === false) { showToast('Не удалось отправить в облако'); return; }
        showToast('✅ Это сохранение отправлено в облако');
      });
    });
  }

  function pullFromCloud() {
    if (!tg || !tg.CloudStorage) { showToast('CloudStorage недоступен на этом устройстве'); return; }
    tg.CloudStorage.getItem(SAVE_KEY, (err, value) => {
      if (err || !value) { showToast('В облаке пусто или ошибка загрузки'); return; }
      let cloudData;
      try { cloudData = JSON.parse(value); } catch (e) { showToast('Сохранение в облаке повреждено'); return; }
      const msg = `Здесь: всего испечено ${formatNum(state.totalBaked)} 🍪.\n`
        + `В облаке: всего испечено ${formatNum(cloudData.totalBaked || 0)} 🍪.\n\n`
        + `Заменить прогресс на этом устройстве данными из облака? (текущее состояние сохранится как резервная копия)`;
      if (!confirm(msg)) return;
      backupCurrentState();
      if (applyLoaded(value, { grantOfflineProgress: false })) {
        saveState();
        showToast('✅ Загружено из облака (резервная копия сохранена)');
      } else {
        showToast('Не удалось разобрать сохранение из облака');
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
          showToast(`🍪 ×2 офлайн-доход начислен: +${formatNum(credit)}`, 4000);
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
          if (!wasActive && data.boostExpiresAt > Date.now()) showToast('🚀 Кап офлайна снят на 24 часа!', 4000);
        }
        // x2-production boost window (server-authoritative).
        if (data && typeof data.boost2xExpiresAt === 'number' && data.boost2xExpiresAt !== (state.boost2xExpiresAt || 0)) {
          const wasActive = (state.boost2xExpiresAt || 0) > Date.now();
          state.boost2xExpiresAt = data.boost2xExpiresAt;
          saveState();
          refreshAll();
          if (!wasActive && data.boost2xExpiresAt > Date.now()) showToast('⚡ ×2 производство активно на 1 час!', 4000);
        }
        // Permanent +10% flag (server-authoritative, one-time).
        if (data && typeof data.hasPermProdBoost === 'boolean' && data.hasPermProdBoost !== !!state.hasPermProdBoost) {
          const wasOwned = !!state.hasPermProdBoost;
          state.hasPermProdBoost = data.hasPermProdBoost;
          saveState();
          refreshAll();
          if (!wasOwned && data.hasPermProdBoost) showToast('🌟 +10% к производству навсегда!', 4000);
        }
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
    return (u && (u.first_name || u.username)) || 'Игрок';
  }

  function inviteFriend() {
    const myId = ownTelegramUserId();
    if (!myId || !tg || !tg.openTelegramLink) { showToast('Доступно только в Telegram'); return; }
    const deepLink = `https://t.me/${BOT_USERNAME}?start=ref${myId}`;
    const shareText = 'Залипаю в Cookie Clicker — залетай печь печеньки со мной! 🍪';
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`);
  }

  function loadLeaderboard() {
    el.leaderboardList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
    if (!LEADERBOARD_URL) {
      el.leaderboardList.innerHTML = '<div class="empty-hint">Лидерборд скоро появится</div>';
      return;
    }
    fetch(LEADERBOARD_URL)
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.entries || data.entries.length === 0) {
          el.leaderboardList.innerHTML = '<div class="empty-hint">Пока никого нет — станьте первым!</div>';
          return;
        }
        const myId = ownTelegramUserId();
        const medals = ['🥇', '🥈', '🥉'];
        el.leaderboardList.innerHTML = data.entries.map((entry, i) => {
          const t = titleFor(entry.maxActiveFriendsEver);
          const titleHtml = t ? `<span class="lb-title">${t.icon} ${escapeHtml(t.name)}</span>` : '';
          return `
          <div class="leaderboard-row${myId && entry.userId === myId ? ' me' : ''}">
            <div class="leaderboard-rank">${medals[i] || (i + 1)}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${escapeHtml(entry.name)}${titleHtml}</div>
              <div class="leaderboard-total">${formatNum(entry.totalBaked)} 🍪 всего</div>
            </div>
            <div class="leaderboard-score">${formatNum(entry.cps)}<span class="leaderboard-score-unit">печ/сек</span></div>
          </div>`;
        }).join('');
      })
      .catch(() => {
        el.leaderboardList.innerHTML = '<div class="empty-hint">Не удалось загрузить лидерборд. Попробуйте позже.</div>';
      });
  }

  // ---------- Referral leaderboard (weekly / all-time) ----------
  let refPeriod = 'weekly';          // which slice is shown
  let refData = null;                // { weekly:[], allTime:[] } from the server

  function loadReferralLeaderboard() {
    el.referralLeaderboardList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
    if (!REFERRAL_LEADERBOARD_URL) return;
    fetch(REFERRAL_LEADERBOARD_URL)
      .then(r => r.json())
      .then(data => {
        refData = (data && data.ok) ? data : { weekly: [], allTime: [] };
        renderReferralLeaderboard();
      })
      .catch(() => {
        el.referralLeaderboardList.innerHTML = '<div class="empty-hint">Не удалось загрузить. Попробуйте позже.</div>';
      });
  }

  function renderReferralLeaderboard() {
    if (!el.referralLeaderboardList) return;
    const entries = refData ? (refPeriod === 'weekly' ? refData.weekly : refData.allTime) : [];
    if (!entries || entries.length === 0) {
      el.referralLeaderboardList.innerHTML = refPeriod === 'weekly'
        ? '<div class="empty-hint">На этой неделе ещё никто не звал друзей — будь первым! 🤝</div>'
        : '<div class="empty-hint">Пока никто не привёл друзей — стань первым! 🤝</div>';
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
            <div class="leaderboard-total">🤝 активных друзей</div>
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

  function loadState() {
    // Render immediately with defaults so the UI never sits blank while an async load resolves.
    refreshAll();

    const afterLoad = () => {
      sendCheckin();
      // Offline claim card first (if there's a meaningful amount waiting), then
      // the daily reward — resolveOfflineThenDaily chains the daily after it.
      setTimeout(() => {
        if (state.offlinePending > 0) showOfflineModal();
        else if (dailyRewardAvailable()) showDailyModal();
      }, 900);
    };

    const loadFromLocal = () => {
      try { applyLoaded(localStorage.getItem(SAVE_KEY)); } catch (e) { /* keep defaults */ }
      afterLoad();
    };

    if (cloudStorageUsable()) {
      let settled = false;
      const fallbackTimer = setTimeout(() => { if (!settled) { settled = true; loadFromLocal(); } }, 1500);
      tg.CloudStorage.getItem(SAVE_KEY, (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        if (!err && value) applyLoaded(value);
        else loadFromLocal();
        if (!err && value) afterLoad();
      });
    } else {
      loadFromLocal();
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
      events.push({ id: 'happyHour', label: '🎉 Печеньковый час', mult: 2, endsAt: activeHH.end.getTime() });
    }
    const we = getWeekendWindow(now);
    if (we && now >= we.start && now < we.end) {
      events.push({ id: 'weekend', label: '🎊 Печеньковые выходные', mult: 1.5, endsAt: we.end.getTime() });
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
  function potentialCrumbs() {
    return Math.floor(Math.cbrt(state.totalBaked / 1e9));
  }

  function prestigeMultiplier() {
    return 1 + (state.totalCrumbs || 0) * 0.01;
  }

  function ascend() {
    const crumbsEarned = potentialCrumbs();
    if (crumbsEarned <= 0) {
      showToast('Пока рано — испеките больше печенек, чтобы получить крошки');
      return;
    }
    if (!confirm(`Вознестись? Прогресс обнулится, но вы получите ${formatNum(crumbsEarned)} 👼 небесных крошек (+${crumbsEarned}% к производству навсегда).`)) return;

    backupCurrentState();
    const keepDailyStreak = state.dailyStreak;
    const keepLastDailyClaim = state.lastDailyClaim;
    const keepTotalCrumbs = (state.totalCrumbs || 0) + crumbsEarned;
    const keepAscensionCount = (state.ascensionCount || 0) + 1;
    const keepTutorial = state.tutorial || {}; // don't re-show onboarding hints to a veteran

    state = defaultState();
    state.dailyStreak = keepDailyStreak;
    state.lastDailyClaim = keepLastDailyClaim;
    state.totalCrumbs = keepTotalCrumbs;
    state.ascensionCount = keepAscensionCount;
    state.tutorial = keepTutorial;

    haptic('heavy');
    showToast(`👼 Вознесение! +${formatNum(crumbsEarned)} крошек · бонус теперь +${keepTotalCrumbs}%`);
    saveState();
    refreshAll();
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
    const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    let u = 0;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
  }

  function upgradeEffectText(u) {
    if (u.category === 'click') {
      const before = getClickPower();
      return `Сила клика: ${formatNum(before)} → ${formatNum(before * 2)}`;
    }
    if (u.category === 'global') {
      const before = getCps();
      return `Всё производство: ${formatNum(before)} → ${formatNum(before * 2)} печ/сек`;
    }
    const b = BUILDINGS.find(x => x.id === u.buildingId);
    const before = buildingCps(b);
    return `${b.name}: ${formatNum(before)} → ${formatNum(before * 2)} печ/сек за шт.`;
  }

  function upgradeReqText(u) {
    if (u.reqType === 'building') {
      const b = BUILDINGS.find(x => x.id === u.buildingId);
      return `🔒 Откроется: купите ${b.icon} ${b.name}`;
    }
    if (u.reqType === 'clicks') return `🔒 Откроется: ${formatNum(u.reqValue)} кликов`;
    return `🔒 Откроется: испечено ${formatNum(u.reqValue)} печенек`;
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
    el.dailyStreakNum.textContent = streak;
    el.dailyRewardAmount.textContent = formatNum(computeDailyReward(streak));
    // Tutorial step 3: introduce referrals on a RETURN day (lastDailyClaim != 0
    // means they've claimed before, so this modal is a comeback). Shown once —
    // by now they have progress to protect and have felt the offline mechanic,
    // so "invite a friend, both get a bonus" reads as value, not bot spam.
    const t = tut();
    const showRef = state.lastDailyClaim !== 0 && !t.referralIntroShown;
    if (el.dailyReferral) el.dailyReferral.hidden = !showRef;
    if (showRef) { t.referralIntroShown = true; saveState(); }
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
    showToast(`🎁 День ${streak}: +${formatNum(reward)} 🍪`);
    saveState();
    refreshAll();
  }

  // ---------- Offline claim (free x1 / paid x2 via Telegram Stars) ----------
  function showOfflineModal() {
    if (!el.offlineModal || !(state.offlinePending > 0)) return;
    el.offlineAmount.textContent = formatNum(state.offlinePending);
    el.offlineX2Amount.textContent = formatNum(state.offlinePending * 2);
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
      showToast(`Забрано ${formatNum(n)} 🍪`);
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

  async function claimOfflinePaid() {
    if (!tg || !tg.openInvoice || !tg.initData) { showToast('Оплата доступна только в Telegram'); return; }
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
          showToast('Оплата принята — начисляем ×2…', 4000);
          pollPaidCredit();
          resolveOfflineThenDaily();
        } else {
          // cancelled / failed / pending — balance untouched, allow retry.
          setOfflineModalProcessing(false);
          if (status === 'failed') showToast('Оплата не прошла — попробуй ещё раз');
        }
      });
    } catch (e) {
      setOfflineModalProcessing(false);
      showToast('Не удалось создать счёт — попробуй позже');
    }
  }

  // Paid "remove offline cap for 24h" boost. No amount to freeze — the effect
  // is a server-owned time window; boostExpiresAt arrives back on checkin.
  async function buyNocapBoost() {
    if (!tg || !tg.openInvoice || !tg.initData) { showToast('Оплата доступна только в Telegram'); return; }
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
          showToast('Оплата принята — снимаем кап…', 4000);
          pollPaidCredit(); // nudges checkins; boostExpiresAt lands via checkin
        } else if (status === 'failed') {
          showToast('Оплата не прошла — попробуй ещё раз');
        }
      });
    } catch (e) {
      if (el.nocapBtn) el.nocapBtn.disabled = false;
      showToast('Не удалось создать счёт — попробуй позже');
    }
  }

  // Paid "x2 production for 1h" boost. Server-owned window; boost2xExpiresAt
  // lands on checkin, then online x2 + timer kick in.
  async function buyBoost2x() {
    if (!tg || !tg.openInvoice || !tg.initData) { showToast('Оплата доступна только в Telegram'); return; }
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
          showToast('Оплата принята — включаем ×2…', 4000);
          pollPaidCredit(); // nudges checkins; boost2xExpiresAt lands via checkin
        } else if (status === 'failed') {
          showToast('Оплата не прошла — попробуй ещё раз');
        }
      });
    } catch (e) {
      if (el.boost2xBtn) el.boost2xBtn.disabled = false;
      showToast('Не удалось создать счёт — попробуй позже');
    }
  }

  // Paid one-time "+10% forever". The server refuses if already owned; on
  // success the flag arrives via checkin and getCps/getClickPower pick up +10%.
  async function buyPermProd() {
    if (state.hasPermProdBoost) { showToast('Уже куплено ✓'); return; }
    if (!tg || !tg.openInvoice || !tg.initData) { showToast('Оплата доступна только в Telegram'); return; }
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
        showToast('Уже куплено ✓');
        return;
      }
      if (!data || !data.ok || !data.link) throw new Error('no_link');
      tg.openInvoice(data.link, (status) => {
        if (status === 'paid') {
          // Keep the button disabled — the flag lands via checkin and flips the
          // button to "Куплено", preventing a rapid second (real) purchase.
          showToast('Оплата принята — активируем +10%…', 4000);
          pollPaidCredit();
        } else {
          if (el.permProdBtn) el.permProdBtn.disabled = false;
          if (status === 'failed') showToast('Оплата не прошла — попробуй ещё раз');
        }
      });
    } catch (e) {
      if (el.permProdBtn) el.permProdBtn.disabled = false;
      showToast('Не удалось создать счёт — попробуй позже');
    }
  }

  // ---------- Rendering ----------
  const el = {
    cookieCount: document.getElementById('cookieCount'),
    cps: document.getElementById('cps'),
    clickPowerLine: document.getElementById('clickPowerLine'),
    offlineInfoLine: document.getElementById('offlineInfoLine'),
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
    dailyStreakNum: document.getElementById('dailyStreakNum'),
    dailyRewardAmount: document.getElementById('dailyRewardAmount'),
    dailyClaimBtn: document.getElementById('dailyClaimBtn'),
    dailyReferral: document.getElementById('dailyReferral'),
    dailyInviteBtn: document.getElementById('dailyInviteBtn'),
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
    referralLeaderboardList: document.getElementById('referralLeaderboardList'),
    refToggleWeekly: document.getElementById('refToggleWeekly'),
    refToggleAll: document.getElementById('refToggleAll'),
    ascendCrumbs: document.getElementById('ascendCrumbs'),
    ascendBonus: document.getElementById('ascendBonus'),
    ascendPreview: document.getElementById('ascendPreview'),
    ascendBtn: document.getElementById('ascendBtn'),
    syncStatus: document.getElementById('syncStatus'),
    pushCloudBtn: document.getElementById('pushCloudBtn'),
    pullCloudBtn: document.getElementById('pullCloudBtn'),
    restoreBackupBtn: document.getElementById('restoreBackupBtn'),
    inviteBtn: document.getElementById('inviteBtn'),
    armyCount: document.getElementById('armyCount'),
    armyBoost: document.getElementById('armyBoost'),
    armyOfflineCap: document.getElementById('armyOfflineCap'),
    armyOfflineLabel: document.getElementById('armyOfflineLabel'),
    nocapBtn: document.getElementById('nocapBtn'),
    boost2xBtn: document.getElementById('boost2xBtn'),
    permProdBtn: document.getElementById('permProdBtn'),
    playerProfile: document.getElementById('playerProfile'),
    titleTrack: document.getElementById('titleTrack'),
    titleNext: document.getElementById('titleNext'),
    rewardBurst: document.getElementById('rewardBurst'),
    rewardBurstAmount: document.getElementById('rewardBurstAmount'),
  };

  function countBoughtUpgrades(category) {
    return UPGRADES.filter(u => u.category === category && state.upgrades[u.id]).length;
  }

  function renderTopbar() {
    el.cookieCount.textContent = formatNum(state.cookies);
    const p2 = prod2xMultiplier();
    el.cps.textContent = `${formatNum(getCps() * p2)} печенек/сек${p2 > 1 ? ' ⚡×2' : ''}`;
    el.cps.classList.toggle('boosted', p2 > 1);
    const clickUpgradesOwned = countBoughtUpgrades('click');
    el.clickPowerLine.textContent = `Сила клика: ${formatNum(getClickPower())} · апгрейдов клика: ${clickUpgradesOwned}/${CLICK_UPGRADES_TOTAL}`;
    renderOfflineInfo();
    renderBoost2xInfo();
  }

  // x2-production boost timer, shown next to the CPS indicator only while active.
  function renderBoost2xInfo() {
    if (!el.boost2xLine) return;
    const left = (state.boost2xExpiresAt || 0) - Date.now();
    if (left > 0) {
      el.boost2xLine.hidden = false;
      el.boost2xLine.textContent = `⚡ ×2 производство · ещё ${fmtDur(left)}`;
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
      el.offlineInfoLine.textContent = `🚀 Офлайн без ограничений · ещё ${fmtHM(boostLeft)}`;
      el.offlineInfoLine.classList.add('boost');
    } else {
      const capMin = Math.round(getOfflineCapHours(state.activeReferrals || 0) * 60);
      el.offlineInfoLine.textContent = `💤 Офлайн 100%: ${Math.floor(capMin / 60)}ч ${capMin % 60}мин`;
      el.offlineInfoLine.classList.remove('boost');
    }
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
    el.eventBannerText.textContent = `${label} · x${totalMult} · осталось ${hh}:${mm}:${ss}`;
    el.eventBanner.hidden = false;
  }

  // Referral boost event banner — driven by server config (refEventInfo set on
  // checkin), with a live countdown when the event has an end time.
  let refEventInfo = null;
  function updateRefEventBanner() {
    if (!el.refEventBanner) return;
    if (!refEventInfo || !refEventInfo.active) { el.refEventBanner.hidden = true; return; }
    const mult = refEventInfo.multiplier || 1;
    let text = `🎉 Награда за друзей ×${mult}`;
    if (refEventInfo.endAt) {
      const remain = refEventInfo.endAt - Date.now();
      if (remain <= 0) { el.refEventBanner.hidden = true; refEventInfo = null; return; }
      const hh = String(Math.floor(remain / 3600000)).padStart(2, '0');
      const mm = String(Math.floor((remain % 3600000) / 60000)).padStart(2, '0');
      const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, '0');
      text += ` · осталось ${hh}:${mm}:${ss}`;
    }
    text += ' · зови друзей!';
    el.refEventBannerText.textContent = text;
    el.refEventBanner.hidden = false;
  }

  function renderBuildings() {
    el.buildingsList.innerHTML = '';
    for (const b of BUILDINGS) {
      const count = state.buildings[b.id];
      if (b.referralLocked) {
        el.buildingsList.appendChild(referralBuildingCard(b, count));
        continue;
      }
      const cost = buildingCost(b, count);
      const affordable = state.cookies >= cost;
      const card = document.createElement('button');
      card.className = 'item-card' + (affordable ? '' : ' disabled');
      card.innerHTML = `
        <div class="item-icon">${b.icon}</div>
        <div class="item-info">
          <div class="item-name">${b.name}</div>
          <div class="item-sub">${formatNum(buildingCps(b))} печ/сек за шт.</div>
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
    const tip = `Доступно за ${b.unlockFriends} активных друзей`;
    const card = document.createElement('button');

    let subText, costHtml;
    if (placed) {
      card.className = 'item-card referral placed';
      subText = `${formatNum(buildingCps(b))} печ/сек`;
      costHtml = '<div class="item-cost referral-tag">🫶 дар друзей</div>';
    } else if (unlocked) {
      card.className = 'item-card referral ready';
      subText = 'Готово к установке — бесплатно';
      costHtml = '<div class="item-cost referral-place">Поставить</div>';
    } else {
      card.className = 'item-card disabled referral locked';
      card.title = tip;
      subText = tip;
      costHtml = `<div class="item-cost referral-locked">🔒 ${b.unlockFriends} друзей</div>`;
    }

    card.innerHTML = `
      <div class="item-icon">${b.icon}</div>
      <div class="item-info">
        <div class="item-name">${b.name}</div>
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

  function renderUpgrades() {
    el.upgradesList.innerHTML = '';
    let anyRendered = false;

    for (const category of CATEGORY_ORDER) {
      const categoryAll = UPGRADES.filter(u => u.category === category);
      let items = categoryAll.filter(u => !state.upgrades[u.id] ? u.req(state.buildings, state) || state.cookies >= u.cost * 0.5 : true);

      // Always surface a preview of the next locked upgrade in this category
      // (even far from unlocking it) so players know there's more coming.
      const teaserIds = new Set();
      if (items.length < categoryAll.length) {
        const shown = new Set(items.map(u => u.id));
        const next = categoryAll.filter(u => !shown.has(u.id)).sort((a, b) => a.cost - b.cost)[0];
        if (next) {
          items = [...items, next];
          teaserIds.add(next.id);
        }
      }
      if (items.length === 0) continue;
      anyRendered = true;

      const boughtCount = categoryAll.filter(u => state.upgrades[u.id]).length;
      const header = document.createElement('div');
      header.className = 'section-header';
      header.textContent = `${CATEGORY_LABELS[category]} (${boughtCount}/${categoryAll.length})`;
      el.upgradesList.appendChild(header);

      for (const u of items) {
        const bought = !!state.upgrades[u.id];
        const isTeaser = teaserIds.has(u.id);
        const unlocked = u.req(state.buildings, state);
        const affordable = state.cookies >= u.cost;
        const card = document.createElement('button');
        card.className = 'upgrade-card' + (bought ? ' bought' : isTeaser ? ' teaser' : unlocked ? (affordable ? '' : ' disabled') : ' locked');
        card.innerHTML = isTeaser ? `
          <div class="upgrade-icon">🔒</div>
          <div class="item-info">
            <div class="upgrade-name">${u.name}</div>
            <div class="upgrade-desc">${upgradeReqText(u)}</div>
          </div>
        ` : `
          <div class="upgrade-icon">${bought ? '✅' : u.icon}</div>
          <div class="item-info">
            <div class="upgrade-name">${u.name}</div>
            <div class="upgrade-desc">${u.desc}</div>
            ${bought ? '' : `<div class="upgrade-effect">${upgradeEffectText(u)}</div>`}
          </div>
          ${bought ? '' : `<div class="upgrade-cost">${formatNum(u.cost)} 🍪</div>`}
        `;
        if (!bought && !isTeaser && unlocked) {
          card.addEventListener('click', () => buyUpgrade(u));
        }
        el.upgradesList.appendChild(card);
      }
    }

    if (!anyRendered) {
      el.upgradesList.innerHTML = '<div class="empty-hint">Апгрейды появятся по мере роста производства</div>';
    }
  }

  function renderStats() {
    const rows = [
      ['Всего испечено', formatNum(state.totalBaked)],
      ['Кликов сделано', formatNum(state.totalClicks)],
      ['Печенек в секунду', formatNum(getCps())],
      ['Сила клика', formatNum(getClickPower())],
      ['Апгрейдов клика', `${countBoughtUpgrades('click')}/${CLICK_UPGRADES_TOTAL}`],
      ['Зданий всего', Object.values(state.buildings).reduce((a, c) => a + c, 0)],
      ['Апгрейдов куплено', Object.keys(state.upgrades).length],
      ['Дней подряд', state.dailyStreak || 0],
      ['Вознесений', state.ascensionCount || 0],
    ];
    el.statsList.innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><span>${v}</span></div>`).join('');

    el.ascendCrumbs.textContent = formatNum(state.totalCrumbs || 0);
    el.ascendBonus.textContent = `+${state.totalCrumbs || 0}%`;
    el.ascendPreview.textContent = `+${formatNum(potentialCrumbs())} 👼`;

    const army = state.activeReferrals || 0;
    el.armyCount.textContent = formatNum(army);
    el.armyBoost.textContent = `+${(referralBoost(army) * 100).toFixed(1).replace(/\.0$/, '')}%`;
    // Offline row is boost-aware: while the paid no-cap boost is live, show its
    // countdown here (the transparency slot); otherwise the normal full-rate cap.
    const boostLeft = (state.boostExpiresAt || 0) - Date.now();
    if (boostLeft > 0) {
      if (el.armyOfflineLabel) el.armyOfflineLabel.textContent = '🚀 Офлайн без ограничений';
      el.armyOfflineCap.textContent = `ещё ${fmtHM(boostLeft)}`;
    } else {
      if (el.armyOfflineLabel) el.armyOfflineLabel.textContent = 'Офлайн на полной скорости';
      const capTotalMin = Math.round(getOfflineCapHours(army) * 60);
      el.armyOfflineCap.textContent = `${Math.floor(capTotalMin / 60)}ч ${capTotalMin % 60}мин`;
    }
    if (el.nocapBtn) el.nocapBtn.textContent = boostLeft > 0
      ? `Продлить ещё на 24ч · ${NOCAP_BOOST_STARS} ⭐`
      : `🚀 Снять кап офлайна на 24ч · ${NOCAP_BOOST_STARS} ⭐`;
    if (el.boost2xBtn) el.boost2xBtn.textContent = (state.boost2xExpiresAt || 0) > Date.now()
      ? `Продлить ×2 ещё на 1ч · ${PROD2X_BOOST_STARS} ⭐`
      : `⚡ ×2 производство на 1ч · ${PROD2X_BOOST_STARS} ⭐`;
    if (el.permProdBtn) {
      if (state.hasPermProdBoost) {
        el.permProdBtn.textContent = '🌟 +10% навсегда · Куплено ✓';
        el.permProdBtn.disabled = true;
        el.permProdBtn.classList.add('owned');
      } else {
        el.permProdBtn.textContent = `🌟 +10% к производству навсегда · ${PERM_PROD_STARS} ⭐`;
        el.permProdBtn.disabled = false;
        el.permProdBtn.classList.remove('owned');
      }
    }

    renderTitles();
    el.syncStatus.textContent = cloudStorageStatusText();
  }

  function fmtHM(ms) {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    return `${Math.floor(totalMin / 60)}ч ${totalMin % 60}мин`;
  }

  // Compact duration: drops the hours part when zero (good for the ≤1h x2 boost).
  function fmtDur(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    if (h > 0) return `${h}ч ${m}мин`;
    if (m > 0) return `${m} мин`;
    return `${s} сек`;
  }

  // Russian count agreement for "друг": 1 друг, 2 друга, 5 друзей.
  function friendWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a >= 11 && a <= 14) return 'друзей';
    if (b === 1) return 'друг';
    if (b >= 2 && b <= 4) return 'друга';
    return 'друзей';
  }

  // Referral-title profile badge + threshold progress track. Everything keys
  // off the peak army size (maxActiveFriendsEver), so a title/track position
  // never regresses when a friend goes inactive.
  function renderTitles() {
    if (!el.titleTrack) return;
    const peak = state.maxActiveFriendsEver || 0;
    const cur = titleFor(peak);
    const nt = nextTitle(peak);
    const lastTh = TITLES[TITLES.length - 1].threshold;

    const badge = cur
      ? `<span class="title-badge">${cur.icon} ${cur.name}</span>`
      : `<span class="title-badge title-badge-none">Пока без титула</span>`;
    el.playerProfile.innerHTML = `<span class="pp-name">👤 ${escapeHtml(ownDisplayName())}</span>${badge}`;

    const fillPct = Math.min(100, peak / lastTh * 100);
    el.titleTrack.innerHTML =
      `<div class="track-rail"><div class="track-fill" style="width:${fillPct}%"></div>` +
      TITLES.map(t => {
        const on = peak >= t.threshold;
        const isNext = nt && nt.threshold === t.threshold;
        return `<div class="track-node${on ? ' on' : ''}${isNext ? ' next' : ''}" style="left:${t.threshold / lastTh * 100}%">` +
          `<span class="track-dot">${on ? t.icon : '🔒'}</span>` +
          `<span class="track-cap">${t.threshold}</span></div>`;
      }).join('') +
      `</div>`;

    el.titleNext.textContent = nt
      ? `Ещё ${nt.threshold - peak} ${friendWord(nt.threshold - peak)} до «${nt.name}»`
      : 'Все титулы открыты! 👑';
  }

  function refreshAll() {
    renderTopbar();
    renderBuildings();
    renderUpgrades();
    renderStats();
    renderRewardTeaser();
    updateTutorial();
    updateDailyBadge();
  }

  // Onboarding.
  //  Step 0: until the very first cookie tap, gently pulse the cookie and show
  //          a non-blocking "tap me" hint. Nothing intercepts the tap.
  //  Step 1: once tapping is understood and the player can actually afford an
  //          upgrade, glow the "Апгрейды" tab + a bubble above it. Non-modal,
  //          dismissed by the next tap anywhere (or by opening the tab).
  const upgradesTabBtn = document.querySelector('.tab-btn[data-tab="upgrades"]');

  function hasAffordableUpgrade() {
    return UPGRADES.some(u => !state.upgrades[u.id] && u.req(state.buildings, state) && state.cookies >= u.cost);
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
      state.totalClicks >= 5 && !onUpgrades && hasAffordableUpgrade();
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
    if (peak < b.unlockFriends) { showToast(`Доступно за ${b.unlockFriends} активных друзей`); haptic('light'); return; }
    if (state.buildings[b.id] >= 1) return; // unique — already placed
    state.buildings[b.id] = 1;
    if (state.referralOffered) state.referralOffered[b.id] = true;
    haptic('heavy');
    showToast(`${b.icon} ${b.name} установлена!`);
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
    el.unlockName.textContent = b.name;
    el.unlockDesc.textContent = `Награда за ${b.unlockFriends} активных друзей. Ставится бесплатно и печёт вместе с твоей армией!`;
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
  function renderRewardTeaser() {
    if (!el.rewardTeaser) return;
    const b = BUILDINGS.find(x => x.referralLocked && !state.buildings[x.id]);
    teaserBuilding = b || null;
    if (!b) { el.rewardTeaser.hidden = true; return; }
    el.rewardTeaser.hidden = false;

    const peak = state.maxActiveFriendsEver || 0;
    const unlocked = peak >= b.unlockFriends;
    el.rewardTeaser.classList.toggle('ready', unlocked);
    el.rewardTeaserTitle.textContent = b.name;
    el.rewardTeaserFill.style.width = Math.min(100, peak / b.unlockFriends * 100) + '%';
    if (unlocked) {
      el.rewardTeaserSub.textContent = 'Открыта! Нажми, чтобы поставить';
      el.rewardTeaserCta.textContent = 'Поставить';
    } else {
      const n = b.unlockFriends - peak;
      el.rewardTeaserSub.textContent = `Ещё ${n} ${friendWord(n)} — особое здание`;
      el.rewardTeaserCta.textContent = 'Позвать';
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
    if (state.cookies < u.cost) { haptic('light'); return; }
    const isFirstUpgrade = Object.keys(state.upgrades).length === 0;
    if (isFirstUpgrade) sendAnalyticsEvent('first_upgrade');
    state.cookies -= u.cost;
    state.upgrades[u.id] = true;
    u.effect(state);
    haptic('rigid');
    showToast(`Куплено: ${u.name}`);
    refreshAll();
    // Tutorial step 2: the one and only offline-mechanic nudge, right after the
    // first upgrade. Cap/timer details are self-explained by the offline UI, so
    // keep it to a single line. Delayed so it follows the "bought" toast.
    const t = tut();
    if (isFirstUpgrade && !t.offlineHintDone) {
      t.offlineHintDone = true;
      saveState();
      setTimeout(() => showToast('🍪 Печеньки копятся, даже когда ты вышел — загляни попозже за добычей', 5000), 1500);
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

  function resetProgress() {
    if (!confirm('Точно сбросить весь прогресс?')) return;
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
        showToast('🔥 Безумие печенья! x7 на 30 сек');
      } else {
        const bonus = Math.max(getCps() * 60, 50);
        state.cookies += bonus;
        state.totalBaked += bonus;
        showToast(`✨ Золотое печенье! +${formatNum(bonus)}`);
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
      if (btn.dataset.tab === 'leaderboard') { sendCheckin(); loadLeaderboard(); }
      if (btn.dataset.tab === 'friends') { sendCheckin(); loadReferralLeaderboard(); }
      if (btn.dataset.tab === 'upgrades') markUpgradeHintSeen(); // they followed the step-1 nudge
    });
  });

  el.refToggleWeekly.addEventListener('click', () => setRefPeriod('weekly'));
  el.refToggleAll.addEventListener('click', () => setRefPeriod('alltime'));

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
  el.inviteBtn.addEventListener('click', inviteFriend);
  el.dailyBadge.addEventListener('click', showDailyModal);
  el.dailyClaimBtn.addEventListener('click', claimDailyReward);
  el.dailyInviteBtn.addEventListener('click', inviteFriend);
  el.offlineClaimBtn.addEventListener('click', claimOfflineFree);
  el.offlineX2Btn.addEventListener('click', claimOfflinePaid);
  if (el.nocapBtn) el.nocapBtn.addEventListener('click', buyNocapBoost);
  if (el.boost2xBtn) el.boost2xBtn.addEventListener('click', buyBoost2x);
  if (el.permProdBtn) el.permProdBtn.addEventListener('click', buyPermProd);
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
  el.rewardTeaser.addEventListener('click', onRewardTeaserClick);

  loadState();
  requestAnimationFrame(tick);
  setInterval(() => { renderBuildings(); renderUpgrades(); renderStats(); renderRewardTeaser(); updateTutorial(); updateDailyBadge(); maybeOfferReferralBuildings(); }, 3000);
  setInterval(() => { state.lastTs = Date.now(); saveState(); }, 10000);
  // Keep the leaderboard/push-worker record fresh during a long play session
  // instead of only ever reflecting the moment the app was opened.
  setInterval(sendCheckin, 120000);
  updateEventBanner();
  setInterval(updateEventBanner, 1000);
  setInterval(updateRefEventBanner, 1000);
  setInterval(renderOfflineInfo, 1000);
  setInterval(renderBoost2xInfo, 1000);
  scheduleGolden();

  window.addEventListener('beforeunload', () => { state.lastTs = Date.now(); saveState(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { state.lastTs = Date.now(); saveState(); }
  });
})();
