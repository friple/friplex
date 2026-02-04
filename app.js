(() => {
  const STORAGE_KEY = 'miniapp_v4_4_state';
  // default state (added lastFreeSpin, profile.subscribed and market)
  let state = {
    balance: 999999,
    inventory: [],
    history: [],
    spins: [],
    market: [], // marketplace listings
    profile: { name: 'Пользователь', tgnick: '@yourtg', id: '000000', subscribed: false },
    lastFreeSpin: 0
  };

  const roulettes = {
    r1: { id:'r1', prize:25, spinCost:13, sticker:{id:'gift', emoji:'🎁', title:'Подарок', price:400} },
    r2: { id:'r2', prize:50, spinCost:25, sticker:{id:'champ', emoji:'🍾', title:'Шампанское', price:50} },
    r3: { id:'r3', prize:100, spinCost:50, sticker:{id:'ring', emoji:'💍', title:'Кольцо', price:100} },
    rnft: { id:'rnft', prize:'NFT', spinCost:200, sticker:{id:'lollipop', emoji:'🍭', title:'Леденец (NFT)', price:200} }
  };

  // Inject stronger dark theme + brighter buttons styling and visibility improvements
  (function injectTheme() {
    const css = `
      /* App-wide dark theme */
      body, .app, .page, .card, .modal-content { background: #070708 !important; color: #e6eef9 !important; }
      .topbar { background: transparent !important; }
      .page { background: transparent !important; }
      .card { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)) !important; border: 1px solid rgba(255,255,255,0.04) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.6); }
      .btn { background: rgba(255,255,255,0.04); color: #e6eef9; border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 12px; cursor: pointer; transition: transform .08s, box-shadow .12s; font-weight:700; }
      .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.6); }
      .btn:active { transform: translateY(0); }
      .btn-primary { background: linear-gradient(90deg,#00a3ff,#6a8bff); color: #021022; border: none; box-shadow: 0 8px 20px rgba(0,160,255,0.12); }
      .btn-primary:hover { box-shadow: 0 12px 30px rgba(0,160,255,0.18); }
      .nav-btn { padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,0.02); color: #cfe8ff; border: none; }
      .nav-btn.active { background: linear-gradient(90deg,#0ea5ff22,#7c3aed22); box-shadow: 0 8px 20px rgba(0,0,0,0.6) inset; }
      .inventory-item, .market-card { background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.008)); border: 1px solid rgba(255,255,255,0.03); }
      .modal { background: rgba(0,0,0,0.6) !important; }
      .modal-content { background: linear-gradient(180deg,#071018,#041018) !important; border-radius: 14px; padding: 14px; color: #e6eef9; }
      input, .topup-btn, .topup-grid button { background: #071018; color: #e6eef9; border: 1px solid rgba(255,255,255,0.04); padding:8px; border-radius:8px; }
      #market-search { border:1px solid rgba(255,255,255,0.04); }
      .market-grid .market-card { transition: transform .12s; }
      .market-grid .market-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(0,0,0,0.6); }
      .win-popup { background: linear-gradient(180deg,#061018,#021018); color: #e6eef9; border-radius: 12px; padding: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.06) }
      .market-buy, .market-view, .sell-btn, .listing-action { padding:8px 12px; border-radius:10px; font-weight:700; }
      .market-buy { background: linear-gradient(90deg,#00e6a8,#00a3ff); color:#021022; border:none; }
      .market-buy:hover { box-shadow: 0 12px 30px rgba(0,160,200,0.12); }
      .sell-btn { background: linear-gradient(90deg,#ffcf4d,#ff7a7a); color:#021022; border:none; }
      .listing-action { background: linear-gradient(90deg,#7c3aed,#00a3ff); color:#fff; border:none; }
      .price-range { display:flex; gap:8px; align-items:center; }
      .price-range input { width:100px; }
      #balance-panel { background: linear-gradient(180deg,#0b1620,#051019); color: #f7fbff !important; border-radius:12px; padding:10px 14px; }
      .muted { color:#9fb0c8 !important; }
      .highlight-text { color: #fff9c4 !important; text-shadow: 0 2px 8px rgba(124,58,237,0.2); font-weight:800; }
      .market-grid { max-height: 420px; overflow:auto; padding:8px; }
      .market-card { min-height: 110px; display:flex; flex-direction:column; justify-content:space-between; }
      .market-card .seller { color:#9fb0c8; font-size:12px; }
      .profile-info .btn#profile-market-btn { margin-top:8px; background: linear-gradient(90deg,#00e6a8,#00a3ff); color:#021022; border:none; }
      .listing-modal .modal-content, .modal.listing-modal .modal-content { max-width:480px; }
      .mylist-modal .modal-content { max-width:640px; }
      .market-card .price-badge { font-weight:900; color:#bfe8ff; background: linear-gradient(90deg,#042233,#053042); padding:8px 12px; border-radius:12px; }
      /* ensure text contrast for small elements */
      .history-item .history-left, .inventory-item .label { color:#e6eef9; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
    `;
    const st = document.createElement('style');
    st.setAttribute('id','injected-theme');
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  })();

  // DOM refs (some elements are created later)
  const pages = {
    main: document.getElementById('page-main'),
    roulette: document.getElementById('page-roulette'),
    profile: document.getElementById('page-profile'),
    history: document.getElementById('page-history')
  };
  const nav = document.querySelector('.bottom-nav');
  let navBtns = Array.from(document.querySelectorAll('.nav-btn'));
  const balanceInline = document.getElementById('balance-inline');
  const balanceField = document.getElementById('balance');
  const rightBalance = document.getElementById('balance-right');
  const invGrid = document.getElementById('inventory-list');
  const historyList = document.getElementById('history-list');

  const goRoulette = document.getElementById('go-roulette');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalCost = document.getElementById('modal-cost');
  const spinAction = document.getElementById('spin-action');
  const modalResult = document.getElementById('modal-result');
  const modalClose = document.getElementById('modal-close');
  const canvas = document.getElementById('wheel-canvas');
  const confetti = document.getElementById('confetti');
  const clouds = document.getElementById('clouds');

  const winPopup = document.getElementById('win-popup');
  const winSticker = document.getElementById('win-sticker');
  const winText = document.getElementById('win-text');

  // free spin UI
  const freeSpinBtn = document.getElementById('free-spin-btn');
  const freeSpinStatus = document.getElementById('free-spin-status');

  // profile/topup DOM
  const topupBtn = document.getElementById('topup-btn');
  const topupModal = document.getElementById('topup-modal');
  const topupClose = document.getElementById('topup-close');
  const topupAmounts = document.getElementById('topup-amounts');
  const topupConfirm = document.getElementById('topup-confirm');
  const topupCancel = document.getElementById('topup-cancel');
  const topupMsg = document.getElementById('topup-msg');
  const profileNameEl = document.getElementById('profile-name');
  const profileTgEl = document.getElementById('profile-tgnick');
  const profileIdEl = document.getElementById('profile-id');
  const send15Btn = document.getElementById('send15');
  const subscribeBtn = document.getElementById('subscribe-btn');
  const subscribeIndicator = document.getElementById('subscribe-indicator');

  // withdraw DOM
  const openWithdraw = document.getElementById('open-withdraw');
  const withdrawModal = document.getElementById('withdraw-modal');
  const withdrawClose = document.getElementById('withdraw-close');
  const withdrawList = document.getElementById('withdraw-list');
  const withdrawConfirm = document.getElementById('withdraw-confirm');
  const withdrawCancel = document.getElementById('withdraw-cancel');
  const withdrawMsg = document.getElementById('withdraw-msg');

  // speed controls
  const speedButtons = Array.from(document.querySelectorAll('.speed-btn'));
  let spinMode = 'medium';

  const ctx = canvas ? canvas.getContext('2d') : null;
  const size = canvas ? canvas.width : 360;
  let currentType = null;

  // animation control
  let rafHandle = null;
  let animCancel = false;

  // timers
  let winAutoKeepTimer = null;

  // persistence
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(state, parsed);
        if (!state.profile) state.profile = { name: 'Пользователь', tgnick: '@yourtg', id: '000000', subscribed: false };
        if (!('lastFreeSpin' in state)) state.lastFreeSpin = 0;
        if (!Array.isArray(state.market)) state.market = [];
      }
    } catch(e){ console.warn('loadState', e); }
  }
  function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){console.warn(e);} }

  // tx id generator (6 uppercase alnum)
  function genTxId(){
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i=0;i<6;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
    return s;
  }

  function addHistory(type, amount, desc){
    const entry = {
      id: genTxId(),
      type,
      amount: Number(amount) || 0,
      desc: desc || '',
      ts: new Date().toISOString()
    };
    state.history = state.history || [];
    state.history.unshift(entry);
    renderHistory();
    saveState();
  }

  function addSpinRecord({ rouletteId, speed, cost, outcome, prize }) {
    const rec = {
      id: genTxId(),
      rouletteId,
      speed,
      cost,
      outcome,
      prize,
      ts: new Date().toISOString()
    };
    state.spins = state.spins || [];
    state.spins.unshift(rec);
    saveState();
  }

  // easing helpers
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function easeOutQuart(t){ return 1 - Math.pow(1 - t, 4); }
  function easeOutQuint(t){ return 1 - Math.pow(1 - t, 5); }

  // get current rotation degrees of canvas
  function getCurrentRotationDeg(){
    if (!canvas) return 0;
    const st = window.getComputedStyle(canvas);
    const tr = st.transform || st.webkitTransform || 'none';
    if (tr === 'none') return 0;
    const vals = tr.match(/matrix\(([^)]+)\)/);
    if (vals && vals[1]) {
      const parts = vals[1].split(',').map(s => parseFloat(s.trim()));
      const a = parts[0], b = parts[1];
      const angle = Math.round(Math.atan2(b, a) * (180/Math.PI));
      return angle;
    }
    const rot = tr.match(/rotate\(([^)]+)deg\)/);
    if (rot) return parseFloat(rot[1]);
    return 0;
  }

  // animate rotation with requestAnimationFrame (returns promise)
  function animateRotation(toDeg, duration = 2000, easingFn = easeOutCubic){
    if (!canvas) return Promise.resolve(false);
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    animCancel = false;
    return new Promise((resolve) => {
      const start = performance.now();
      const from = getCurrentRotationDeg();
      const delta = toDeg - from;
      function frame(now){
        if (animCancel) { resolve(false); return; }
        const t = Math.min(1, (now - start) / duration);
        const e = easingFn(t);
        const cur = from + delta * e;
        canvas.style.transform = `rotate(${cur}deg)`;
        if (t < 1) {
          rafHandle = requestAnimationFrame(frame);
        } else {
          rafHandle = null;
          resolve(true);
        }
      }
      rafHandle = requestAnimationFrame(frame);
    });
  }

  // constants for free spin
  const FREE_SPIN_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
  // free spin odds: nothing 90%, stars 7% (25⭐), nft 3% (леденец)
  function sampleFreePrize(){
    const r = Math.random();
    if (r < 0.03) return 'nft';
    if (r < 0.03 + 0.07) return 'stars';
    return 'nothing';
  }

  // MARKET UI creation and search/filters
  function createMarketUI(){
    // if market nav button already exists skip
    if (nav && !document.querySelector('[data-page="market"]')) {
      const marketBtn = document.createElement('button');
      marketBtn.className = 'nav-btn';
      marketBtn.dataset.page = 'market';
      marketBtn.textContent = 'Маркет';
      nav.appendChild(marketBtn);
      navBtns = Array.from(document.querySelectorAll('.nav-btn')); // refresh
      marketBtn.addEventListener('click', ()=> showPage('market'));
    }

    // create market page if not present
    if (!document.getElementById('page-market')) {
      const app = document.getElementById('app');
      if (!app) return;
      const marketPage = document.createElement('main');
      marketPage.className = 'page hidden';
      marketPage.id = 'page-market';
      marketPage.innerHTML = `
        <section class="market card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0" class="highlight-text">Маркет</h3>
            <div style="font-size:13px;color:#cfe8ff">Баланс: <strong id="market-balance-display"></strong></div>
          </div>
          <div style="margin-bottom:10px;color:#a8b7c9">Просматривайте выставленные подарки, покупайте их, или выставляйте свои из профиля.</div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
            <input id="market-search" placeholder="Поиск..." style="flex:1;padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
            <div class="price-range">
              <input id="market-min" type="number" placeholder="min ⭐" style="padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
              <input id="market-max" type="number" placeholder="max ⭐" style="padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
            </div>
            <button id="market-refresh" class="btn">Обновить</button>
          </div>
          <div id="market-list" class="market-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:8px;max-height:420px;overflow:auto"></div>
        </section>
      `;
      app.appendChild(marketPage);
      pages.market = marketPage;
    }
  }

  function renderMarket(){
    const marketList = document.getElementById('market-list');
    const balDisp = document.getElementById('market-balance-display');
    if (balDisp) balDisp.textContent = `${state.balance} ⭐`;
    if (!marketList) return;
    const qEl = document.getElementById('market-search');
    const minEl = document.getElementById('market-min');
    const maxEl = document.getElementById('market-max');
    const query = qEl ? qEl.value.trim().toLowerCase() : '';
    const minV = minEl && Number(minEl.value) ? Number(minEl.value) : 0;
    const maxV = maxEl && Number(maxEl.value) ? Number(maxEl.value) : Number.MAX_SAFE_INTEGER;

    const listings = (state.market || []).filter(listing => {
      const title = (listing.item && listing.item.title || '').toLowerCase();
      const matchesQuery = !query || title.includes(query);
      const price = Number(listing.price || 0);
      const inRange = price >= minV && price <= maxV;
      return matchesQuery && inRange;
    });

    marketList.innerHTML = '';
    if (!listings || listings.length === 0) {
      marketList.innerHTML = `<div class="muted">В маркетплейсе пока нет подходящих подарков.</div>`;
      return;
    }
    listings.forEach(listing => {
      const el = document.createElement('div');
      el.className = 'market-card';
      el.style.background = 'linear-gradient(180deg,#061018,#041018)';
      el.style.border = '1px solid rgba(255,255,255,0.04)';
      el.style.borderRadius = '12px';
      el.style.padding = '10px';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(180deg,#071827,#04202a);display:flex;align-items:center;justify-content:center;font-size:28px">${listing.item.emoji}</div>
          <div style="flex:1">
            <div style="font-weight:700;color:#fff">${listing.item.title}</div>
            <div class="seller" style="font-size:12px;color:#9fb0c8">Продавец: ${listing.seller || '—'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
          <div class="price-badge">${listing.price} ⭐</div>
          <div style="display:flex;gap:8px">
            <button class="btn market-buy market-buy-visible" data-id="${listing.id}">Купить</button>
            <button class="btn market-view" data-id="${listing.id}">Просмотр</button>
          </div>
        </div>
      `;
      marketList.appendChild(el);
    });

    // attach buy handlers
    marketList.querySelectorAll('.market-buy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const listing = (state.market || []).find(m => m.id === id);
        if (!listing) return alert('Листинг не найден.');
        if ((state.balance || 0) < listing.price) {
          const ok = await showConfirm(`У вас ${state.balance} ⭐ — недостаточно для покупки (${listing.price} ⭐). Открыть пополнение?`);
          if (ok) openTopupModal();
          return;
        }
        const ok1 = await showConfirm(`Купить "${listing.item.title}" за ${listing.price} ⭐ у ${listing.seller || 'продавца'}?`);
        if (!ok1) return;
        const ok2 = await showConfirm('Это окончательное подтверждение покупки — списание произойдёт сразу. Продолжить?');
        if (!ok2) return;
        // perform purchase
        state.balance = (state.balance || 0) - listing.price;
        const bought = Object.assign({}, listing.item, { _id: `${Date.now()}_${Math.random().toString(36).slice(2,9)}`, fromMarket: true });
        state.inventory = state.inventory || [];
        state.inventory.push(bought);
        state.market = (state.market || []).filter(m => m.id !== id);
        addHistory('purchase', -listing.price, `Purchased ${listing.item.title} from ${listing.seller || 'market'}`);
        addHistory('acquire', 0, `Acquired ${bought.title} from market`);
        saveState();
        renderProfile();
        renderMarket();
        spawnConfetti(12);
        alert('Покупка прошла успешно — подарок добавлен в инвентарь.');
      });
    });

    marketList.querySelectorAll('.market-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const listing = (state.market || []).find(m => m.id === id);
        if (!listing) return alert('Листинг не найден.');
        alert(`${listing.item.title}\nЦена: ${listing.price} ⭐\nПродавец: ${listing.seller || '—'}`);
      });
    });
  }

  // helper to suggest price based on same-title listings (average) or fallback
  function suggestPriceForItem(item){
    const same = (state.market || []).filter(m => m.item && m.item.title === item.title);
    if (same.length === 0) return Math.max(1, item.price || 100);
    const avg = Math.round(same.reduce((s,x)=>s + Number(x.price||0),0) / same.length);
    return Math.max(1, avg);
  }

  // Add "Выставленные подарки" button to profile (shows only user's listings)
  function ensureProfileMarketButton(){
    const profileBlock = document.querySelector('.profile-info') || document.querySelector('.profile-block');
    if (!profileBlock) return;
    if (document.getElementById('profile-market-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'profile-market-btn';
    btn.className = 'btn btn-primary';
    btn.textContent = 'Выставленные подарки';
    btn.style.marginLeft = '8px';
    // place near topup button area
    const container = profileBlock.querySelector('div[style*="margin-top:12px"]') || profileBlock;
    container.appendChild(btn);
    btn.addEventListener('click', () => openMyListingsModal());
  }

  // my listings modal
  let myListingsModal = null;
  function ensureMyListingsModal(){
    if (myListingsModal) return;
    myListingsModal = document.createElement('div');
    myListingsModal.className = 'modal mylist-modal hidden';
    myListingsModal.style.zIndex = 10000;
    myListingsModal.innerHTML = `
      <div class="modal-content" style="max-width:640px">
        <button class="modal-close" id="mylist-close" aria-label="Закрыть">✕</button>
        <h3 style="margin-top:0" class="highlight-text">Мои выставленные подарки</h3>
        <div id="mylist-body" style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;margin-top:12px"></div>
      </div>
    `;
    document.body.appendChild(myListingsModal);
    myListingsModal.querySelector('#mylist-close').addEventListener('click', ()=> myListingsModal.classList.add('hidden'));
  }

  // refresh modal content (used after delist)
  function refreshMyListingsModalContent(){
    ensureMyListingsModal();
    const body = myListingsModal.querySelector('#mylist-body');
    body.innerHTML = '';
    const mine = (state.market || []).filter(m => String(m.sellerId || '') === String(state.profile && state.profile.id || ''));
    if (!mine || mine.length === 0) {
      body.innerHTML = `<div class="muted">У вас нет выставленных подарков.</div>`;
      return;
    }
    mine.forEach(l => {
      const row = document.createElement('div');
      row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
      row.style.padding='8px'; row.style.borderBottom='1px solid rgba(255,255,255,0.03)'; row.style.borderRadius='8px';
      row.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div style="font-size:26px">${l.item.emoji}</div>
        <div><div style="font-weight:700;color:#fff">${l.item.title}</div><div style="font-size:12px;color:#9fb0c8">${l.price} ⭐</div></div></div>
        <div style="display:flex;gap:8px">
          <button class="btn listing-action delist-btn" data-id="${l.id}">Снять с продажи</button>
        </div>`;
      body.appendChild(row);
    });
    // attach handlers
    body.querySelectorAll('.delist-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await showConfirm('Вы уверены, что хотите снять этот лот с продажи и вернуть его в инвентарь?');
        if (!ok) return;
        const idx = (state.market || []).findIndex(x => x.id === id);
        if (idx >= 0) {
          const listing = state.market.splice(idx,1)[0];
          // return item to inventory (new id)
          const item = Object.assign({}, listing.item, { _id: `${Date.now()}_${Math.random().toString(36).slice(2,9)}` });
          state.inventory = state.inventory || [];
          state.inventory.push(item);
          addHistory('delist', 0, `Delisted ${listing.item.title}`);
          saveState();
          renderProfile();
          renderMarket();
          // refresh modal content and if none left, show message
          refreshMyListingsModalContent();
          alert('Лот снят с продажи и возвращён в инвентарь.');
        }
      });
    });
  }

  function openMyListingsModal(){
    ensureMyListingsModal();
    refreshMyListingsModalContent();
    myListingsModal.classList.remove('hidden');
  }

  // init
  loadState();
  createMarketUI();
  ensureProfileMarketButton();
  renderProfile();
  renderHistory();
  renderMarket();
  // стартовая страница: рулетка
  showPage('roulette');
  if (modal) modal.classList.add('hidden');
  if (canvas) canvas.style.transform = 'rotate(0deg)';

  // attach nav buttons (refresh list)
  navBtns = Array.from(document.querySelectorAll('.nav-btn'));
  navBtns.forEach(b => b.addEventListener('click', ()=> showPage(b.dataset.page)));
  if (goRoulette) goRoulette.addEventListener('click', ()=> showPage('roulette'));

  // market filters interactions (if present)
  const marketSearch = document.getElementById('market-search');
  const marketMin = document.getElementById('market-min');
  const marketMax = document.getElementById('market-max');
  const marketRefresh = document.getElementById('market-refresh');
  if (marketSearch) marketSearch.addEventListener('input', () => renderMarket());
  if (marketMin) marketMin.addEventListener('change', () => renderMarket());
  if (marketMax) marketMax.addEventListener('change', () => renderMarket());
  if (marketRefresh) marketRefresh.addEventListener('click', () => renderMarket());

  // speed buttons
  speedButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      spinMode = btn.dataset.speed;
    });
  });

  // Top-up handlers
  if (topupBtn) topupBtn.addEventListener('click', openTopupModal);
  if (topupClose) topupClose.addEventListener('click', ()=> topupModal.classList.add('hidden'));
  if (topupCancel) topupCancel.addEventListener('click', ()=> topupModal.classList.add('hidden'));
  if (topupConfirm) topupConfirm.addEventListener('click', ()=> handleTopupConfirm());

  let selectedTopup = null;
  if (topupAmounts) {
    topupAmounts.querySelectorAll('.topup-btn').forEach(b => {
      b.addEventListener('click', () => {
        topupAmounts.querySelectorAll('.topup-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        selectedTopup = Number(b.dataset.amount);
        topupMsg.textContent = `Выбран��: ${selectedTopup} ⭐`;
      });
    });
  }

  function openTopupModal(){
    selectedTopup = null;
    if (topupMsg) topupMsg.textContent = '';
    if (topupAmounts) topupAmounts.querySelectorAll('.topup-btn').forEach(x => x.classList.remove('active'));
    if (topupModal) topupModal.classList.remove('hidden');
  }

  function handleTopupConfirm(){
    if (!selectedTopup) {
      if (topupMsg) topupMsg.textContent = 'Выберите сумму.';
      return;
    }
    state.balance = (state.balance || 0) + selectedTopup;
    addHistory('topup', selectedTopup, `Пополнение +${selectedTopup} ⭐`);
    renderProfile();

    const amount = selectedTopup;
    let gifts = [];
    if (amount >= 100 && amount % 100 === 0) {
      const n = amount / 100;
      for (let i=0;i<n;i++) gifts.push(100);
    } else {
      gifts.push(amount);
    }

    let totalGifts = gifts.reduce((s,v)=>s+v,0);
    if ((state.balance || 0) >= totalGifts) {
      state.balance -= totalGifts;
      addHistory('send_gifts', -totalGifts, `Отправлено ${gifts.length} подарков @xionzq (${gifts.join('⭐, ')}⭐)`);
      renderProfile();
    } else {
      if (topupMsg) topupMsg.textContent = 'Ошибка: недостаточно средств для отправки подарков.';
    }

    gifts.forEach((g, i) => {
      const delayMs = 1200 + i * 700;
      setTimeout(() => {
        state.balance = (state.balance || 0) + g;
        addHistory('gift_arrived', g, `Подарок ${g}⭐ доставлен @xionzq — зачислено ${g}⭐ отправителю`);
        renderProfile();
        spawnConfetti(8);
        saveState();
      }, delayMs);
    });

    if (topupMsg) topupMsg.textContent = `Пополнение ${selectedTopup} ⭐ прошло. Отправлено ${gifts.length} подарков @xionzq.`;
    setTimeout(()=> topupModal.classList.add('hidden'), 1100);
    saveState();
  }

  // quick send 15
  if (send15Btn) {
    send15Btn.addEventListener('click', () => {
      const gift = 15;
      if ((state.balance || 0) < gift) {
        if (!confirm(`У вас ${state.balance} ⭐ — недостаточно. Пополнить и отправить подарки?`)) return;
      }
      state.balance = (state.balance || 0) - gift;
      addHistory('send_gift', -gift, `Отправлен подарок ${gift}⭐ @xionzq`);
      renderProfile();
      setTimeout(()=> {
        state.balance = (state.balance || 0) + gift;
        addHistory('gift_arrived', gift, `Подарок ${gift}⭐ доставлен @xionzq — зачислено ${gift}⭐ отправителю`);
        renderProfile();
        spawnConfetti(8);
        saveState();
      }, 1300);
      saveState();
    });
  }

  // Subscribe toggle
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', () => {
      state.profile = state.profile || {};
      state.profile.subscribed = !state.profile.subscribed;
      updateSubscribeUI();
      saveState();
    });
  }
  function updateSubscribeUI(){
    if (!subscribeBtn || !subscribeIndicator) return;
    if (state.profile && state.profile.subscribed) {
      subscribeBtn.textContent = 'Подписан в TG (симуляция)';
      subscribeIndicator.textContent = 'Подписан';
      subscribeIndicator.classList.remove('muted');
      subscribeIndicator.style.color = '';
    } else {
      subscribeBtn.textContent = 'Я подписан в TG (симуляция)';
      subscribeIndicator.textContent = 'Не подписан';
      subscribeIndicator.classList.add('muted');
      subscribeIndicator.style.color = '';
    }
    updateFreeSpinStatus();
  }

  // Withdraw handlers
  if (openWithdraw) openWithdraw.addEventListener('click', () => openWithdrawModal());
  if (withdrawClose) withdrawClose.addEventListener('click', ()=> withdrawModal.classList.add('hidden'));
  if (withdrawCancel) withdrawCancel.addEventListener('click', ()=> withdrawModal.classList.add('hidden'));
  if (withdrawConfirm) withdrawConfirm.addEventListener('click', () => handleWithdrawConfirm());

  function openWithdrawModal(){
    if (!withdrawList) return;
    withdrawList.innerHTML = '';
    if (withdrawMsg) withdrawMsg.textContent = '';
    if (!state.inventory || state.inventory.length === 0) {
      withdrawList.innerHTML = '<div class="muted">В инвентаре нет подарков для вывода.</div>';
    } else {
      state.inventory.forEach(it => {
        const row = document.createElement('label');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '8px';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        row.innerHTML = `<input type="checkbox" data-id="${it._id}"> <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center">${it.emoji}</div>
          <div style="flex:1"><div style="font-weight:700;color:#fff">${it.title}</div><div style="font-size:12px;color:#9fb0c8">Цена: ${it.price} ⭐</div></div>`;
        withdrawList.appendChild(row);
      });
    }
    withdrawModal.classList.remove('hidden');
  }

  async function handleWithdrawConfirm(){
    if (!withdrawList) return;
    const selected = Array.from(withdrawList.querySelectorAll('input[data-id]:checked')).map(i => i.dataset.id);
    if (selected.length === 0) {
      if (withdrawMsg) withdrawMsg.textContent = 'Выберите хотя бы один подарок.';
      return;
    }
    const required = 25 * selected.length;
    if (state.balance >= required) {
      const conf = confirm(`Списать ${required} ⭐ для вывода ${selected.length} подарков? Подтверждаете?`);
      if (!conf) return;
      state.balance -= required;
      addHistory('spend', -required, `Withdraw ${selected.length} gift(s)`);
      const removedTitles = [];
      state.inventory = state.inventory.filter(item => {
        if (selected.includes(item._id)) { removedTitles.push(item.title); return false; }
        return true;
      });
      addHistory('withdraw', 0, `Withdrawn: ${removedTitles.join(', ')}`);
      if (withdrawMsg) withdrawMsg.textContent = `Выведено ${removedTitles.length} подарков. Стоимость ${required} ⭐ списана.`;
      renderProfile();
      renderHistory();
      spawnWithdrawAnimation();
      setTimeout(()=> withdrawModal.classList.add('hidden'), 1200);
    } else {
      const conf = confirm(`У вас недостаточно звёзд (${state.balance} ⭐). Подарить выбранные подарки пользователю @Xionzq за 25 ⭐ каждый и удалить их из инвентаря? Подтверждаете?`);
      if (!conf) return;
      const removedTitles = [];
      state.inventory = state.inventory.filter(item => {
        if (selected.includes(item._id)) { removedTitles.push(item.title); return false; }
        return true;
      });
      addHistory('gift', 0, `Gifted to @Xionzq: ${removedTitles.join(', ')}`);
      if (withdrawMsg) withdrawMsg.textContent = `Подарки отправлены @Xionzq.`;
      renderProfile();
      renderHistory();
      spawnWithdrawAnimation();
      setTimeout(()=> withdrawModal.classList.add('hidden'), 1200);
    }
  }

  function spawnWithdrawAnimation(){ spawnConfetti(18); }

  function showPage(name){
    Object.values(pages).forEach(p => p && p.classList.add('hidden'));
    if (!pages[name]) return;
    pages[name].classList.remove('hidden');
    navBtns = Array.from(document.querySelectorAll('.nav-btn'));
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === name));
    if (name === 'market') renderMarket();
  }

  // render profile + inventory
  function renderProfile(){
    profileNameEl && (profileNameEl.textContent = (state.profile && state.profile.name) || 'Пользователь');
    profileTgEl && (profileTgEl.textContent = (state.profile && state.profile.tgnick) || '@yourtg');
    profileIdEl && (profileIdEl.textContent = `ID: ${(state.profile && state.profile.id) || '000000'}`);

    if (balanceInline) balanceInline.textContent = state.balance;
    if (balanceField) balanceField.textContent = state.balance;
    if (rightBalance) rightBalance.textContent = `${state.balance} ⭐`;
    invGrid.innerHTML = '';
    if (!state.inventory || state.inventory.length === 0) {
      invGrid.innerHTML = '<div class="empty">— пусто —</div>';
    } else {
      state.inventory.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'inventory-item';
        card.style.background = 'linear-gradient(180deg,#041018,#021018)';
        card.style.border = '1px solid rgba(255,255,255,0.03)';
        card.style.borderRadius = '10px';
        card.style.padding = '10px';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';
        const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='12px';
        const emoji = document.createElement('div'); emoji.className = 'sticker-emoji'; emoji.textContent = item.emoji || '🎁'; emoji.style.fontSize='28px';
        left.appendChild(emoji);
        const info = document.createElement('div');
        info.style.flex='1';
        const label = document.createElement('div'); label.className = 'label'; label.textContent = item.title || '';
        label.style.fontWeight = '700';
        label.style.color = '#fff';
        const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = `Цена: ${item.price} ⭐`;
        sub.style.fontSize='12px'; sub.style.color='#9fb0c8';
        info.appendChild(label);
        info.appendChild(sub);
        left.appendChild(info);

        const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px';
        const sell = document.createElement('button'); sell.className = 'sell-btn'; sell.textContent = `Продать: ${item.price} ⭐`;
        sell.addEventListener('click', async () => {
          const ok = await showConfirm(`Вы точно хотите продать "${item.title}" за ${item.price} ⭐?`);
          if (!ok) return;
          const idx = state.inventory.findIndex(x => x._id === item._id);
          if (idx >= 0) {
            state.inventory.splice(idx, 1);
            state.balance += item.price;
            addHistory('sell', item.price, `Sold ${item.title}`);
            renderProfile();
            saveState();
            spawnConfetti(10);
          }
        });
        // new: list on market button (bright)
        const listBtn = document.createElement('button');
        listBtn.className = 'btn listing-action';
        listBtn.textContent = 'Выставить';
        listBtn.addEventListener('click', () => openListModalForItem(item));
        actions.appendChild(sell);
        actions.appendChild(listBtn);

        card.appendChild(left);
        card.appendChild(actions);
        invGrid.appendChild(card);
      });
    }
    saveState();
    // update subscribe/free spin UI after render
    updateSubscribeUI();
    updateFreeSpinStatus();
  }

  // Listing modal flow
  let listModalEl = null;
  function ensureListModal(){
    if (listModalEl) return;
    listModalEl = document.createElement('div');
    listModalEl.className = 'modal listing-modal hidden';
    listModalEl.style.zIndex = 10000;
    listModalEl.innerHTML = `
      <div class="modal-content" style="max-width:480px">
        <button class="modal-close" id="list-close" aria-label="Закрыть">✕</button>
        <h3 id="list-title" class="highlight-text">Выставить подарок</h3>
        <div id="list-body"></div>
      </div>
    `;
    document.body.appendChild(listModalEl);
    document.getElementById('list-close').addEventListener('click', ()=> listModalEl.classList.add('hidden'));
  }

  async function openListModalForItem(item){
    ensureListModal();
    const body = listModalEl.querySelector('#list-body');
    body.innerHTML = '';
    // suggested price should not limit the user; allow up to 1_000_000
    const suggested = suggestPriceForItem(item);
    body.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        <div style="font-size:40px">${item.emoji}</div>
        <div>
          <div style="font-weight:700;color:#fff">${item.title}</div>
          <div style="font-size:12px;color:#9fb0c8">Исходная цена: ${item.price} ⭐</div>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:13px;display:block;margin-bottom:6px">Предлагаемая цена (1 - 1 000 000 ⭐)</label>
        <input id="list-price-input" type="number" value="${suggested}" min="1" max="1000000" style="width:100%;padding:10px;border-radius:10px;border:none;background:#061018;color:#e6eef9" />
      </div>
      <div style="margin-bottom:12px;color:#9fb0c8">Рекомендованная цена: ${suggested} ⭐</div>
      <div style="display:flex;gap:8px">
        <button id="list-confirm" class="btn btn-primary">Выставить</button>
        <button id="list-cancel" class="btn">Отмена</button>
      </div>
    `;
    listModalEl.classList.remove('hidden');

    const input = listModalEl.querySelector('#list-price-input');
    const confirmBtn = listModalEl.querySelector('#list-confirm');
    const cancelBtn = listModalEl.querySelector('#list-cancel');

    cancelBtn.addEventListener('click', () => listModalEl.classList.add('hidden'), { once: true });

    confirmBtn.addEventListener('click', async () => {
      const val = Number(input.value) || 0;
      if (val < 1 || val > 1000000) {
        alert('Цена должна быть в диапазоне от 1 до 1 000 000 ⭐');
        return;
      }
      const ok1 = await showConfirm(`Вы точно хотите выставить "${item.title}" на маркет за ${val} ⭐?`);
      if (!ok1) return;
      const ok2 = await showConfirm('Это окончательное подтверждение — после подтверждения подарок будет снят с вашего инвентаря и появится в маркете. Продолжить?');
      if (!ok2) return;
      // perform listing: remove from inventory, add to market array
      const idx = (state.inventory || []).findIndex(x => x._id === item._id);
      if (idx >= 0) state.inventory.splice(idx, 1);
      const listing = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
        item: { title: item.title, emoji: item.emoji, price: item.price },
        price: val,
        sellerId: state.profile && state.profile.id,
        seller: (state.profile && (state.profile.tgnick || state.profile.name)) || 'Продавец'
      };
      state.market = state.market || [];
      state.market.unshift(listing);
      addHistory('list', 0, `Listed ${item.title} for ${val} ⭐`);
      saveState();
      renderProfile();
      renderMarket();
      listModalEl.classList.add('hidden');
      alert('Подарок успешно выставлен в маркет.');
    }, { once: true });
  }

  function renderHistory(){
    if (!historyList) return;
    historyList.innerHTML = '';
    if (!state.history || state.history.length === 0) {
      historyList.innerHTML = '<div class="muted">Транзакции появятся здесь.</div>';
      return;
    }
    state.history.forEach(h => {
      const row = document.createElement('div'); row.className = 'history-item';
      const left = document.createElement('div'); left.className = 'history-left';
      const d = new Date(h.ts);
      left.innerHTML = `<div><span class="history-id">#${h.id}</span> — <strong>${h.type.toUpperCase()}</strong></div>
        <div style="font-size:13px;color:#6f8fa0">${d.toLocaleString()}</div>
        <div style="margin-top:6px;color:#334">${h.desc}</div>`;
      const right = document.createElement('div'); right.className = 'history-right';
      right.innerHTML = `<div class="history-amount">${h.amount > 0 ? '+'+h.amount : h.amount}</div>`;
      row.appendChild(left); row.appendChild(right);
      historyList.appendChild(row);
    });
  }

  // roulette card selection visuals
  const rouletteCards = Array.from(document.querySelectorAll('.card-roulette'));
  rouletteCards.forEach(card => {
    card.addEventListener('click', () => {
      rouletteCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const type = card.dataset.type;
      openModal(type);
    });
  });

  // modal / wheel interactions
  if (modalClose) modalClose.addEventListener('click', closeModal);
  function openModal(type){
    const r = roulettes[type];
    if (!r) return;
    currentType = type;
    if (modal) modal.classList.remove('hidden');
    modalTitle && (modalTitle.textContent = (type === 'rnft' ? 'NFT‑рулетка' : `Рулетка — ${r.prize} ⭐`));
    modalCost && (modalCost.textContent = r.spinCost);
    if (modalResult) modalResult.textContent = '';
    hideWinPopup();
    drawStaticWheel(r);
    if (spinAction) {
      spinAction.dataset.type = type;
      spinAction.disabled = false;
    }
  }
  function closeModal(){
    if (modal) modal.classList.add('hidden');
    resetWheelImmediately();
    hideWinPopup();
  }

  // draw wheel
  function drawStaticWheel(r){
    if (!ctx) return;
    const cx = size/2, cy = size/2, radius = size/2 - 8;
    ctx.clearRect(0,0,size,size);

    // white top semicircle
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // black bottom semicircle
    ctx.beginPath();
    ctx.fillStyle = '#111111';
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    // stroke
    ctx.beginPath();
    ctx.strokeStyle = '#e6f1ff';
    ctx.lineWidth = 6;
    ctx.arc(cx, cy, radius+4, 0, Math.PI*2);
    ctx.stroke();

    // sticker top
    const stickerAngle = -Math.PI/2;
    const stickerR = 36;
    const stickerX = cx + Math.cos(stickerAngle) * (radius * 0.65);
    const stickerY = cy + Math.sin(stickerAngle) * (radius * 0.65);
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(stickerX, stickerY, stickerR, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e2f0ff';
    ctx.arc(stickerX, stickerY, stickerR, 0, Math.PI*2);
    ctx.stroke();
    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rCurr = roulettes[currentType] || { sticker: { emoji: '🎁' } };
    const emoji = rCurr.sticker.emoji || '🎁';
    ctx.fillStyle = '#222';
    ctx.fillText(emoji, stickerX, stickerY + 2);

    // "Пусто" bottom
    const emptyAngle = Math.PI/2;
    const emptyX = cx + Math.cos(emptyAngle) * (radius * 0.65);
    const emptyY = cy + Math.sin(emptyAngle) * (radius * 0.65);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Пусто', emptyX, emptyY + 6);
  }

  // speed config
  const speedConfig = {
    fast: { duration: 1200, easing: easeOutCubic },
    medium: { duration: 2400, easing: easeOutQuart },
    slow: { duration: 3800, easing: easeOutQuint }
  };

  // spin animator
  async function spinToHalfAnimation(forceWin = null){
    const cfg = speedConfig[spinMode] || speedConfig.medium;
    const r = roulettes[currentType];
    const winWhite = (typeof forceWin === 'boolean') ? forceWin : (Math.random() < 0.5);
    const turns = 6 + Math.floor(Math.random()*6);
    const base = turns * 360;
    const target = winWhite ? 0 : 180;
    const jitter = (Math.random()*18)-9;
    const finalAngle = base + target + jitter;

    addSpinRecord({ rouletteId: currentType, speed: spinMode, cost: 0, outcome: winWhite ? 'white' : 'black', prize: r ? r.prize : null });

    if (canvas) canvas.style.transition = 'none';
    animCancel = false;
    const ok = await animateRotation(finalAngle, cfg.duration, cfg.easing);

    if (ok) {
      await animateRotation(finalAngle - (Math.random()*8 + 4), 180, easeOutCubic);
      await animateRotation(finalAngle, 160, easeOutCubic);
    } else {
      if (canvas) canvas.style.transform = `rotate(${finalAngle}deg)`;
    }
    return winWhite ? 'white' : 'black';
  }

  // spin free with odds
  async function spinFreeWithOdds(type){
    const cfg = speedConfig[spinMode] || speedConfig.medium;
    const turns = 5 + Math.floor(Math.random()*6);
    const base = turns * 360;
    const prize = sampleFreePrize();
    const target = (prize === 'nothing') ? 180 : 0;
    const jitter = (Math.random()*18)-9;
    const finalAngle = base + target + jitter;

    addSpinRecord({ rouletteId: type || currentType || 'r1', speed: spinMode, cost: 0, outcome: prize, prize: prize });

    if (canvas) canvas.style.transition = 'none';
    animCancel = false;
    const ok = await animateRotation(finalAngle, cfg.duration, cfg.easing);

    if (ok) {
      await animateRotation(finalAngle - (Math.random()*8 + 4), 180, easeOutCubic);
      await animateRotation(finalAngle, 160, easeOutCubic);
    } else {
      if (canvas) canvas.style.transform = `rotate(${finalAngle}deg)`;
    }
    return prize;
  }

  // canvas click triggers spin
  if (canvas) {
    canvas.addEventListener('click', ()=> {
      const type = spinAction && spinAction.dataset.type;
      if (type && spinAction) spinAction.click();
    });
  }

  // improved paid spin handler: check balance, deduct once, then animate + handle result and ensure modal closes after result
  if (spinAction) {
    spinAction.addEventListener('click', async () => {
      const type = spinAction.dataset.type;
      const r = roulettes[type];
      if (!r) return;
      if (spinAction.disabled) return;
      spinAction.disabled = true;
      if (modalResult) modalResult.textContent = '';
      hideWinPopup();

      if ((state.balance || 0) < r.spinCost) {
        const ok = await showConfirm(`У вас ${state.balance} ⭐ — недостаточно для прокрутки (${r.spinCost} ⭐). Открыть окно пополнения?`);
        spinAction.disabled = false;
        if (ok) openTopupModal();
        return;
      }
      // deduct immediately and persist
      state.balance = (state.balance || 0) - r.spinCost;
      addHistory('spend', -r.spinCost, `Spin ${type}`);
      saveState();
      renderProfile();

      try {
        const which = await spinToHalfAnimation();
        await handleSpinResult(type, r, which);
      } catch(e){
        if (modalResult) {
          modalResult.textContent = 'Ошибка прокрутки';
          modalResult.className = 'modal-result fail';
        }
        console.error(e);
      } finally {
        spinAction.disabled = false;
      }
    });
  }

  async function handleSpinResult(type, r, which){
    // always close modal after handling result to keep UI clean
    if (which === 'white') {
      const item = {
        _id: `${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
        title: r.sticker.title,
        emoji: r.sticker.emoji,
        price: r.sticker.price,
        fromSpin: true
      };
      state.inventory = state.inventory || [];
      state.inventory.push(item);
      addHistory('acquire', 0, `Acquired ${item.title} (price ${item.price})`);
      if (r.prize !== 'NFT' && typeof r.prize === 'number') {
        state.balance = (state.balance || 0) + r.prize;
        addHistory('win', r.prize, `Win on ${type}`);
      }
      saveState();
      renderProfile();

      showWinPopup(r);
      if (modalResult) {
        modalResult.textContent = 'Стикер добавлен в инвентарь.';
        modalResult.className = 'modal-result success';
      }
      spawnConfetti();

      const userChoice = await waitForWinChoiceWithTimeout(6000);
      hideWinPopup();
      // close modal and go either to profile or remain on roulette
      closeModal();
      if (userChoice === 'open_inventory') {
        showPage('profile');
      } else {
        showPage('roulette');
      }
      await delay(220);
      await resetToZero();
    } else {
      if (modalResult) {
        modalResult.textContent = 'Увы — ничего не выиграли.';
        modalResult.className = 'modal-result fail';
      }
      await delay(900);
      hideWinPopup();
      closeModal();
      await resetToZero();
    }
  }

  // free spin result handling (also closes modal)
  async function handleFreeSpinResult(type, outcome){
    if (outcome === 'nft') {
      const r = roulettes['rnft'];
      const item = {
        _id: `${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
        title: r.sticker.title,
        emoji: r.sticker.emoji,
        price: r.sticker.price,
        fromSpin: true
      };
      state.inventory = state.inventory || [];
      state.inventory.push(item);
      addHistory('acquire', 0, `Acquired NFT ${item.title}`);
      saveState();
      renderProfile();
      showWinPopup(r);
      if (modalResult) { modalResult.textContent = 'Вы получили NFT — леденец!'; modalResult.className = 'modal-result success'; }
      spawnConfetti();
      const userChoice = await waitForWinChoiceWithTimeout(6000);
      hideWinPopup();
      closeModal();
      if (userChoice === 'open_inventory') showPage('profile'); else showPage('roulette');
      await delay(220);
      await resetToZero();
    } else if (outcome === 'stars') {
      const amount = 25;
      state.balance = (state.balance || 0) + amount;
      addHistory('win', amount, `Free spin win ${amount} ⭐`);
      saveState();
      renderProfile();
      if (modalResult) { modalResult.textContent = `Поздравляем! Вы выиграли ${amount} ⭐`; modalResult.className = 'modal-result success'; }
      spawnConfetti();
      await delay(900);
      closeModal();
      await resetToZero();
    } else {
      if (modalResult) { modalResult.textContent = 'Увы — ничего не выиграли.'; modalResult.className = 'modal-result fail'; }
      await delay(900);
      closeModal();
      await resetToZero();
    }
  }

  // free spin button logic
  if (freeSpinBtn) {
    freeSpinBtn.addEventListener('click', async () => {
      state.profile = state.profile || {};
      if (!state.profile.subscribed) {
        const ok = await showConfirm('Бесплатная прокрутка доступна только подписанным. Симулировать подписку?');
        if (!ok) return;
        state.profile.subscribed = true;
        updateSubscribeUI();
        saveState();
      }
      const now = Date.now();
      const elapsed = now - (state.lastFreeSpin || 0);
      if (elapsed < FREE_SPIN_COOLDOWN) {
        updateFreeSpinStatus();
        return;
      }
      state.lastFreeSpin = Date.now();
      saveState();
      updateFreeSpinStatus();
      const type = currentType || 'r1';
      openModal(type);
      if (modalResult) modalResult.textContent = '';
      hideWinPopup();
      drawStaticWheel(roulettes[type]);
      freeSpinBtn.disabled = true;
      try {
        const outcome = await spinFreeWithOdds(type);
        await handleFreeSpinResult(type, outcome);
      } catch (e) {
        console.error(e);
      } finally {
        freeSpinBtn.disabled = false;
      }
    });
  }

  function updateFreeSpinStatus(){
    if (!freeSpinStatus || !freeSpinBtn) return;
    if (!(state.profile && state.profile.subscribed)) {
      freeSpinStatus.textContent = '— только для подписанных in TG (симуляция)';
      freeSpinBtn.disabled = false;
      return;
    }
    const now = Date.now();
    const last = state.lastFreeSpin || 0;
    const left = Math.max(0, FREE_SPIN_COOLDOWN - (now - last));
    if (left === 0) {
      freeSpinStatus.textContent = 'Доступна — используйте сейчас';
      freeSpinBtn.disabled = false;
    } else {
      const hrs = Math.floor(left / (60*60*1000));
      const mins = Math.floor((left % (60*60*1000)) / (60*1000));
      const secs = Math.floor((left % (60*1000)) / 1000);
      const hh = String(hrs).padStart(2,'0');
      const mm = String(mins).padStart(2,'0');
      const ss = String(secs).padStart(2,'0');
      freeSpinStatus.textContent = `Доступно через ${hh}ч ${mm}м ${ss}с`;
      freeSpinBtn.disabled = true;
    }
  }

  // show/hide win popup and wait for user
  function showWinPopup(r){
    if (winAutoKeepTimer) { clearTimeout(winAutoKeepTimer); winAutoKeepTimer = null; }
    winSticker && (winSticker.textContent = (r && r.sticker && r.sticker.emoji) || '🎁');
    winText && (winText.textContent = `Поздравляем! Вы выиграли — ${(r && r.sticker && r.sticker.title) || ''}`);
    if (winPopup) winPopup.classList.remove('hidden');
    if (canvas) canvas.classList.add('win-highlight');
  }

  function hideWinPopup(){
    if (winAutoKeepTimer) { clearTimeout(winAutoKeepTimer); winAutoKeepTimer = null; }
    if (winPopup) winPopup.classList.add('hidden');
    if (canvas) canvas.classList.remove('win-highlight');
  }

  function waitForWinChoiceWithTimeout(ms){
    return new Promise((resolve) => {
      let resolved = false;
      function onKeepWrap() { if (resolved) return; resolved = true; cleanup(); resolve('keep'); }
      function onOpenWrap() { if (resolved) return; resolved = true; cleanup(); resolve('open_inventory'); }
      function cleanup(){
        const k = document.getElementById('win-keep');
        const s = document.getElementById('win-spin');
        if (k) k.removeEventListener('click', onKeepWrap);
        if (s) s.removeEventListener('click', onOpenWrap);
        if (winAutoKeepTimer) { clearTimeout(winAutoKeepTimer); winAutoKeepTimer = null; }
      }
      const k = document.getElementById('win-keep');
      const s = document.getElementById('win-spin');
      if (k) k.addEventListener('click', onKeepWrap);
      if (s) s.addEventListener('click', onOpenWrap);
      winAutoKeepTimer = setTimeout(()=> {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve('keep');
      }, ms);
    });
  }

  async function resetToZero(){
    animCancel = false;
    await animateRotation(0, 700, easeOutQuart);
    drawStaticWheel(roulettes[currentType]);
  }

  function resetWheelImmediately(){
    animCancel = true;
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
    if (canvas) canvas.style.transition = 'none';
    if (canvas) canvas.style.transform = 'rotate(0deg)';
    if (canvas) canvas.classList.remove('win-highlight');
    setTimeout(()=> { if (canvas) canvas.style.transition = ''; }, 50);
  }

  function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

  // confetti
  function spawnConfetti(n=36){
    if (!confetti) return;
    confetti.innerHTML = '';
    confetti.setAttribute('aria-hidden','false');
    const colors = ['#00e6a8','#00a3ff','#7c3aed','#ffcf4d','#ff7a7a','#9be6ff','#60b7ff','#8affc1'];
    for (let i=0;i<n;i++){
      const el = document.createElement('div');
      el.className = 'p';
      el.style.left = (5 + Math.random()*90) + '%';
      el.style.background = colors[Math.floor(Math.random()*colors.length)];
      el.style.width = (6 + Math.random()*10) + 'px';
      el.style.height = (6 + Math.random()*10) + 'px';
      el.style.top = (-20 - Math.random()*40) + 'px';
      el.style.transform = `translateY(-20px) rotate(${Math.random()*360}deg)`;
      el.style.animationDelay = (Math.random()*120) + 'ms';
      confetti.appendChild(el);
    }
    setTimeout(()=> { confetti.innerHTML=''; confetti.setAttribute('aria-hidden','true'); }, 2200);
  }

  // clouds click effect
  document.addEventListener('click', (e) => {
    const skip = e.target.closest('.modal-content') || e.target.closest('.btn') || e.target.closest('.sell-btn') || e.target.closest('.withdraw-btn') || e.target.closest('.speed-btn');
    if (skip) return;
    if (!clouds) return;
    const el = document.createElement('div'); el.className = 'cloud';
    el.style.left = (e.clientX - 32) + 'px'; el.style.top = (e.clientY - 20) + 'px';
    clouds.appendChild(el);
    setTimeout(()=> { try{ el.remove(); }catch{} }, 800);
  });

  // custom confirm modal (returns Promise<boolean>)
  function showConfirm(message){
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'confirm-modal-backdrop';
      backdrop.style.position = 'fixed';
      backdrop.style.inset = 0;
      backdrop.style.display = 'flex';
      backdrop.style.alignItems = 'center';
      backdrop.style.justifyContent = 'center';
      backdrop.style.zIndex = 12000;
      const box = document.createElement('div');
      box.className = 'confirm-modal';
      box.style.minWidth = '320px';
      box.style.maxWidth = '420px';
      box.style.background = 'linear-gradient(180deg,#061018,#041018)';
      box.style.borderRadius = '12px';
      box.style.padding = '14px';
      box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.style.marginBottom = '12px';
      msg.textContent = message;
      msg.style.color = '#e6eef9';
      const buttons = document.createElement('div');
      buttons.className = 'buttons';
      buttons.style.display = 'flex';
      buttons.style.gap = '8px';
      buttons.style.justifyContent = 'flex-end';
      const yes = document.createElement('button');
      yes.className = 'btn btn-primary';
      yes.textContent = 'Да';
      const no = document.createElement('button');
      no.className = 'btn';
      no.textContent = 'Нет';
      buttons.appendChild(no);
      buttons.appendChild(yes);
      box.appendChild(msg);
      box.appendChild(buttons);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      yes.focus();
      const cleanup = (res) => {
        try { backdrop.remove(); } catch(e){}
        resolve(res);
      };
      yes.addEventListener('click', ()=> cleanup(true));
      no.addEventListener('click', ()=> cleanup(false));
      backdrop.addEventListener('click', (ev) => {
        if (ev.target === backdrop) cleanup(false);
      });
    });
  }

  // ensure modal hidden on load and update UI
  window.addEventListener('load', () => { if (modal) modal.classList.add('hidden'); updateFreeSpinStatus(); renderMarket(); ensureProfileMarketButton(); });

  // persist
  setInterval(saveState, 2500);

})();
