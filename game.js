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
  ];

  const CATEGORY_LABELS = {
    click: '⚡ Улучшения клика',
    building: '🏭 Улучшения зданий',
    global: '✨ Глобальные',
  };
  const CATEGORY_ORDER = ['click', 'building', 'global'];
  const CLICK_UPGRADES_TOTAL = UPGRADES.filter(u => u.category === 'click').length;

  const SAVE_KEY = 'cookie_clicker_tma_save_v1';

  const CHECKIN_URL = 'https://cookie-clicker-tma-push.mscherbin.workers.dev/checkin';

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
  });

  let state = defaultState();

  // ---------- Save / Load ----------
  function saveState() {
    const data = JSON.stringify(state);
    if (tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
      tg.CloudStorage.setItem(SAVE_KEY, data, () => {});
    }
    try { localStorage.setItem(SAVE_KEY, data); } catch (e) {}
  }

  function applyLoaded(raw) {
    if (!raw) return;
    try {
      const loaded = JSON.parse(raw);
      state = Object.assign(defaultState(), loaded);
      state.buildings = Object.assign(defaultState().buildings, loaded.buildings || {});
      state.buildingMult = Object.assign(defaultState().buildingMult, loaded.buildingMult || {});
      state.upgrades = loaded.upgrades || {};
      // offline progress: full speed, uncapped — cookies keep baking while the app is closed
      const elapsed = Math.max(0, (Date.now() - (loaded.lastTs || Date.now())) / 1000);
      const offlineGain = elapsed * getCps();
      if (offlineGain > 1) {
        state.cookies += offlineGain;
        state.totalBaked += offlineGain;
        showToast(`Пока вас не было, испечено ${formatNum(offlineGain)} 🍪`);
      }
    } catch (e) { /* ignore corrupt save */ }
    refreshAll();
  }

  function cloudStorageUsable() {
    return !!(tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9'));
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
      }),
    }).catch(() => {});
  }

  function loadState() {
    // Render immediately with defaults so the UI never sits blank while an async load resolves.
    refreshAll();

    const afterLoad = () => {
      sendCheckin();
      setTimeout(() => { if (dailyRewardAvailable()) showDailyModal(); }, 900);
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

  // ---------- Formulas ----------
  function buildingCost(b, count) {
    return Math.ceil(b.baseCost * Math.pow(1.15, count));
  }

  function buildingCps(b) {
    let mult = state.buildingMult[b.id] || 1;
    if (b.id === 'cursor') mult *= state.cursorMult;
    return b.baseCps * mult;
  }

  function getCps() {
    let total = 0;
    for (const b of BUILDINGS) total += buildingCps(b) * state.buildings[b.id];
    return total * state.globalMult;
  }

  function getClickPower() {
    return (1 + state.buildings.cursor * 0.1) * state.clickMult * state.globalMult;
  }

  function formatNum(n) {
    if (n < 1000) return n < 100 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
    const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
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

  // ---------- Rendering ----------
  const el = {
    cookieCount: document.getElementById('cookieCount'),
    cps: document.getElementById('cps'),
    clickPowerLine: document.getElementById('clickPowerLine'),
    bigCookie: document.getElementById('bigCookie'),
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
  };

  function countBoughtUpgrades(category) {
    return UPGRADES.filter(u => u.category === category && state.upgrades[u.id]).length;
  }

  function renderTopbar() {
    el.cookieCount.textContent = formatNum(state.cookies);
    el.cps.textContent = `${formatNum(getCps())} печенек/сек`;
    const clickUpgradesOwned = countBoughtUpgrades('click');
    el.clickPowerLine.textContent = `Сила клика: ${formatNum(getClickPower())} · апгрейдов клика: ${clickUpgradesOwned}/${CLICK_UPGRADES_TOTAL}`;
  }

  function renderBuildings() {
    el.buildingsList.innerHTML = '';
    for (const b of BUILDINGS) {
      const count = state.buildings[b.id];
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
    ];
    el.statsList.innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><span>${v}</span></div>`).join('');
  }

  function refreshAll() {
    renderTopbar();
    renderBuildings();
    renderUpgrades();
    renderStats();
    updateDailyBadge();
  }

  // ---------- Actions ----------
  function buyBuilding(b) {
    const count = state.buildings[b.id];
    const cost = buildingCost(b, count);
    if (state.cookies < cost) { haptic('light'); return; }
    state.cookies -= cost;
    state.buildings[b.id] += 1;
    haptic('medium');
    refreshAll();
  }

  function buyUpgrade(u) {
    if (state.upgrades[u.id]) return;
    if (state.cookies < u.cost) { haptic('light'); return; }
    state.cookies -= u.cost;
    state.upgrades[u.id] = true;
    u.effect(state);
    haptic('rigid');
    showToast(`Куплено: ${u.name}`);
    refreshAll();
  }

  function clickCookie(x, y) {
    const gain = getClickPower();
    state.cookies += gain;
    state.totalBaked += gain;
    state.totalClicks += 1;
    spawnFloatNum(gain, x, y);
    haptic('light');
    renderTopbar();
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
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  function resetProgress() {
    if (!confirm('Точно сбросить весь прогресс?')) return;
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
    const delay = 25000 + Math.random() * 45000;
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
    });
  });

  // ---------- Passive income loop ----------
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const frenzyMult = now < frenzyUntil ? 7 : 1;
    const gain = getCps() * frenzyMult * dt;
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
  el.dailyBadge.addEventListener('click', showDailyModal);
  el.dailyClaimBtn.addEventListener('click', claimDailyReward);

  loadState();
  requestAnimationFrame(tick);
  setInterval(() => { renderBuildings(); renderUpgrades(); renderStats(); updateDailyBadge(); }, 3000);
  setInterval(() => { state.lastTs = Date.now(); saveState(); }, 10000);
  scheduleGolden();

  window.addEventListener('beforeunload', () => { state.lastTs = Date.now(); saveState(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { state.lastTs = Date.now(); saveState(); }
  });
})();
