// Full updated app.js — adjusted for mobile: fixed layout, no horizontal scroll, profile shows 2 NFTs per row with equal frames.
// Kept all existing logic (offers, auctions, market, CDN index fetch, NFT seeding). Only layout/CSS and inventory rendering changed for mobile friendliness.

(() => {
  const STORAGE_KEY = 'miniapp_v4_4_state';
  const CDN_BASE = 'https://cdn.changes.tg/gifts';

  const ASSET_MAP = {
    gift: 'gift.png',
    champ: 'champ.png',
    ring: 'ring.png',
    lollipop: 'lollipop.png'
  };

  const EN_NAME_MAP = {
    gift: 'Gift',
    champ: 'Champagne',
    ring: 'Ring',
    lollipop: 'Lollipop (NFT)'
  };

  // Random NFT models examples
  const RANDOM_NFT_MODELS = [
    { _id: 'AstralShark-001', title: 'Astral Shark', image: `${CDN_BASE}/astral_shark.png`, aliases: ['astral shark', 'shark'] },
    { _id: 'SnakeBox-002', title: 'Snake Box', image: `${CDN_BASE}/snake_box.png`, aliases: ['snake box', 'snakebox'] },
    { _id: 'Doshirak-003', title: 'Доширак', image: `${CDN_BASE}/doshirak.png`, aliases: ['доширак', 'doshirak'] },
    { _id: 'Lollipop-004', title: 'Леденец', image: `${CDN_BASE}/lollipop.png`, aliases: ['леденец', 'lollipop'] },
    { _id: 'PlushPP-005', title: 'Плюш ПП', image: `${CDN_BASE}/plush_pp.png`, aliases: ['плюш', 'plush'] },
    { _id: 'Nehpot-006', title: 'Nehpot', image: `${CDN_BASE}/nehpot.png`, aliases: ['nehpot'] },
    { _id: 'KidsackFrog-007', title: 'Kidsack Frog', image: `${CDN_BASE}/kidsack_frog.png`, aliases: ['kidsack frog','kidsack','frog'] },
    { _id: 'MagicPotion-008', title: 'Magic Potion', image: `${CDN_BASE}/magic_potion.png`, aliases: ['magic potion','potion'] }
  ];

  let state = {
    balance: 999999,
    inventory: [],
    history: [],
    spins: [],
    market: [],
    offers: [],
    auctions: [],
    profile: { name: 'Пользователь', tgnick: '@yourtg', id: '000000', subscribed: false },
    lastFreeSpin: 0,
    pendingPayment: null,
    _nftsSeeded: false,
    cdnIndex: null
  };

  const roulettes = {
    r1: { id:'r1', prize:25, spinCost:13, sticker:{id:'gift', emoji:'🎁', title:'Подарок', price:400} },
    r2: { id:'r2', prize:50, spinCost:25, sticker:{id:'champ', emoji:'🍾', title:'Шампанское', price:50} },
    r3: { id:'r3', prize:100, spinCost:50, sticker:{id:'ring', emoji:'💍', title:'Кольцо', price:100} },
    rnft: { id:'rnft', prize:'NFT', spinCost:200, sticker:{id:'lollipop', emoji:'🍭', title:'Леденец (NFT)', price:200} }
  };

  // Inject improved theme + mobile-friendly CSS
  (function injectTheme() {
    // Ensure mobile viewport meta is present (if page doesn't already set it)
    try {
      const existing = document.querySelector('meta[name="viewport"]');
      if (!existing) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width,initial-scale=1,maximum-scale=1';
        document.head.appendChild(meta);
      }
    } catch (e){}

    const css = `
      /* Prevent horizontal scrolling globally */
      html, body, #app { overflow-x: hidden !important; -webkit-overflow-scrolling: touch; }
      /* Page container */
      .page { box-sizing: border-box; padding: 12px; max-width: 100%; }
      /* Buttons and theme */
      body, .app, .page, .card, .modal-content { background: #070708 !important; color: #e6eef9 !important; -webkit-font-smoothing:antialiased; }
      .btn { background: rgba(255,255,255,0.04); color: #e6eef9; border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 12px; cursor: pointer; transition: transform .08s, box-shadow .12s; font-weight:700; min-height:36px; }
      .btn-primary { background: linear-gradient(90deg,#00a3ff,#6a8bff); color: #021022; border: none; }
      .sell-btn { background: linear-gradient(90deg,#ffcf4d,#ff7a7a); color:#021022; border:none; }
      .auction-btn { background: linear-gradient(90deg,#ffd36a,#ff8a5c); color:#021022; border:none; font-weight:900; }
      .market-buy { background: linear-gradient(90deg,#2eb85c,#15a34a); color:#021022; border:none; }
      .inventory-footer { display:flex;gap:8px; margin-top:8px; justify-content:flex-start; align-items:center; }
      .muted { color:#9fb0c8 !important; }
      .auction-time { font-weight:700; color:#ffd36a; }
      .market-card .preview { width:72px;height:72px;border-radius:8px;object-fit:cover; }
      .price-badge { background:linear-gradient(90deg,#0b3b5a,#0d6b8a);color:#fff;padding:6px 10px;border-radius:8px;font-weight:800; }

      /* Filters row wraps on small screens */
      .filters-row { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center; }
      .filters-row select, .filters-row input { background:#061018;color:#e6eef9;border-radius:8px;padding:8px;border:1px solid rgba(255,255,255,0.04); }

      /* Bottom nav: prevent horizontal overflow and keep buttons centered */
      .bottom-nav { display:flex;gap:10px;justify-content:center;align-items:center; padding:10px; box-sizing:border-box; width:100%; overflow:hidden; }
      .nav-btn { min-width:64px; padding:8px 10px; border-radius:12px; white-space:nowrap; }

      /* Inventory grid: 2 columns on narrow screens, consistent frames */
      #inventory-list { box-sizing:border-box; width:100%; }
      .inventory-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; align-items:start; }
      @media(min-width:720px) {
        .inventory-grid { grid-template-columns: repeat(3, 1fr); }
      }
      .inventory-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        padding: 10px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 160px;
        height: 160px;
      }
      .inventory-card .card-top { display:flex; gap:12px; align-items:center; }
      .inventory-card .img-wrap { width:86px; height:86px; border-radius:8px; background:#071827; display:flex; align-items:center; justify-content:center; overflow:hidden; flex:0 0 86px; }
      .inventory-card img.sticker-img { width:100%; height:100%; object-fit:cover; display:block; }
      .inventory-card .card-body { flex:1; display:flex; flex-direction:column; justify-content:center; }
      .inventory-card .card-actions { display:flex; gap:8px; justify-content:flex-start; margin-top:8px; }

      /* Market list: keep cards fit on mobile */
      .market-grid { box-sizing:border-box; }
      .market-card { box-sizing:border-box; }

      /* Prevent oversized elements from causing horizontal scroll */
      img, input, select, button, .card { max-width:100%; }

      /* Tighter spacing for mobile */
      .page .card { padding: 14px; border-radius:12px; }

      /* Make modals fit mobile */
      .modal .modal-content { max-width: 94vw; margin: 12px auto; }

      /* Small helper for equalizing text wrap */
      .text-ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    `;
    const st = document.createElement('style');
    st.setAttribute('id','injected-theme-fixes');
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  })();

  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  function isNFTItem(item){
    if (!item) return false;
    const t = (item.title || '').toLowerCase();
    if (item.nftLink) return true;
    if (item._id && String(item._id).toLowerCase().includes('lollipop')) return true;
    if (t.includes('леден') || t.includes('nft')) return true;
    return false;
  }

  function getDisplayTitle(item){
    if (!item) return '';
    if (isNFTItem(item)) {
      const t = (item.title || '').toLowerCase();
      for (const k in EN_NAME_MAP) {
        if ((item._id && String(item._id).toLowerCase().includes(k)) || t.includes(k)) return EN_NAME_MAP[k];
      }
      return item.title && typeof item.title === 'string' ? item.title.replace(/[^\x00-\x7F]/g, '') || item.title : item.title || '';
    }
    return item.title || '';
  }

  // Dom refs
  const navBottom = document.querySelector('.bottom-nav');
  const invGrid = document.getElementById('inventory-list');
  const historyList = document.getElementById('history-list');
  const balTonEl = document.getElementById('bal-ton');
  const balUsdtEl = document.getElementById('bal-usdt');
  const topupBtn = document.getElementById('topup-btn');
  const paymentModal = document.getElementById('payment-modal');
  const paymentClose = document.getElementById('payment-close');

  const openWithdraw = document.getElementById('open-withdraw');
  const withdrawModal = document.getElementById('withdraw-modal');
  const withdrawList = document.getElementById('withdraw-list');
  const withdrawConfirm = document.getElementById('withdraw-confirm');
  const withdrawCancel = document.getElementById('withdraw-cancel');
  const withdrawClose = document.getElementById('withdraw-close');
  const withdrawMsg = document.getElementById('withdraw-msg');

  // dynamic elements
  let listingConfirmModal = null;
  let auctionCreateModal = null;
  let auctionsPage = null;
  let auctionItemPage = null;
  let offersGlobalModal = null;
  let sendGiftModal = null;
  let myListingsModal = null;
  let listingOffersModal = null;

  const WITHDRAW_FEE = 0.20;

  // persistence helpers
  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(state, parsed);
        if (!state.profile) state.profile = { name: 'Пользователь', tgnick: '@yourtg', id: '000000', subscribed: false };
        if (!Array.isArray(state.market)) state.market = [];
        if (!Array.isArray(state.offers)) state.offers = [];
        if (!Array.isArray(state.auctions)) state.auctions = [];
      }
    } catch(e){ console.warn('loadState', e); }
  }
  function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){console.warn(e);} }

  // Attempt to fetch CDN index.json (if exists) to populate filters
  async function fetchCDNIndex(timeoutMs = 6000) {
    try {
      const url = `${CDN_BASE.replace(/\/$/, '')}/index.json`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { mode: 'cors', cache: 'no-cache', signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) {
        console.warn('CDN index fetch returned', resp.status);
        return null;
      }
      const data = await resp.json();
      if (!data || !Array.isArray(data)) {
        console.warn('CDN index is not an array');
        return null;
      }
      state.cdnIndex = data;
      saveState();
      console.info('CDN index loaded, entries:', (data && data.length) || 0);
      populateMarketFilters();
      renderMarket();
      return data;
    } catch (err) {
      console.warn('fetchCDNIndex failed', err && err.name ? err.name : err);
      return null;
    }
  }

  // seed sample data
  function populateSampleGiftsIfEmpty(){
    if (!state.market || state.market.length > 0) return;
    const samples = [
      {
        id: `L-369710-lolpop`,
        item: { _id: 'LolPop-369710', title: 'LolPop', emoji: '🍭', image: `${CDN_BASE}/${ASSET_MAP.lollipop}`, description: 'Lolipop NFT', aliases: ['lollipop','lolpop','nehpot'], model: 'Magic', background: 'Ivory White', symbol: 'Star', modelRarity: 1.2, backgroundRarity: 2.0, symbolRarity: 0.5 },
        price: 250,
        seller: '@market_owner',
        sellerId: 'owner_1',
        createdAt: Date.now(),
        nftLink: 'https://t.me/nft/LolPop-369710'
      },
      {
        id: `L-369713-giftbox`,
        item: { _id: 'GiftBox-369713', title: 'GiftBox', emoji: '🎁', image: `${CDN_BASE}/${ASSET_MAP.gift}`, description: 'Gift box NFT', aliases: ['giftbox','kidsack frog','magic potion'], model: 'Boxy', background: 'Navy Blue', symbol: 'Turtle', modelRarity: 0.8, backgroundRarity: 1.5, symbolRarity: 0.4 },
        price: 95,
        seller: '@market_owner',
        sellerId: 'owner_4',
        createdAt: Date.now(),
        nftLink: 'https://t.me/nft/GiftBox-369713'
      }
    ];
    state.market.push(...samples);
    state.inventory = state.inventory || [];
    if (state.inventory.length === 0) {
      state.inventory.push({ _id: 'LolPop-369710', title: 'LolPop', image: `${CDN_BASE}/${ASSET_MAP.lollipop}`, aliases: ['lollipop'] });
      state.inventory.push({ _id: 'GiftBox-369713', title: 'GiftBox', image: `${CDN_BASE}/${ASSET_MAP.gift}`, aliases: ['giftbox'] });
    }
    saveState();
  }

  function genTxId(){
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i=0;i<6;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
    return s;
  }

  // HISTORY: only keep purchase & sale
  function addHistory(type, amount, desc){
    if (!['purchase','sale'].includes(type)) return; // ignore other types
    const entry = { id: genTxId(), type, amount: Number(amount) || 0, desc: desc || '', ts: new Date().toISOString() };
    state.history = state.history || [];
    state.history.unshift(entry);
    renderHistory();
    saveState();
  }

  function getImageForItem(item){
    if (!item) return '';
    if (item.image) return item.image;
    const t = (item.title || '').toLowerCase();
    for (const k in ASSET_MAP) {
      if (item._id && String(item._id).toLowerCase().includes(k)) return `${CDN_BASE}/${ASSET_MAP[k]}`;
      if (t.includes(k) || (t.includes('подарок') && k === 'gift')) return `${CDN_BASE}/${ASSET_MAP[k]}`;
      if (t.includes('шампан') && k === 'champ') return `${CDN_BASE}/${ASSET_MAP[k]}`;
      if (t.includes('кольц') && k === 'ring') return `${CDN_BASE}/${ASSET_MAP[k]}`;
      if (t.includes('леден') && k === 'lollipop') return `${CDN_BASE}/${ASSET_MAP[k]}`;
    }
    const slug = (item.title || '').toLowerCase().replace(/[^\w\-]+/g, '_').replace(/__+/g, '_').replace(/^_|_$/g,'');
    return slug ? `${CDN_BASE}/${slug}.png` : '';
  }

  function suggestPriceForItem(item, excludeListingId = null){
    const same = (state.market || []).filter(m => m.item && m.item.title === item.title && m.id !== excludeListingId);
    if (same.length === 0) return Math.max(1, item.price || 100);
    const avg = Math.round(same.reduce((s,x)=>s + Number(x.price||0),0) / same.length);
    return Math.max(1, avg);
  }

  // Confirm modal for listing (explicit phrasing)
  function ensureListingConfirmModal(){
    if (listingConfirmModal) return;
    listingConfirmModal = document.createElement('div');
    listingConfirmModal.className = 'modal listing-confirm hidden';
    listingConfirmModal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" id="listing-confirm-close">✕</button>
        <h3 class="highlight-text" style="margin-top:0">Подтвердите выставление</h3>
        <div style="margin-top:8px">Вы уверены, что хотите выставить предмет <strong id="listing-confirm-title"></strong> за указанную сумму?</div>
        <div style="margin-top:8px">Цена (TON): <input id="listing-confirm-price" type="number" min="1" style="width:120px;padding:6px;border-radius:6px;background:#061018;border:1px solid rgba(255,255,255,0.04);color:#e6eef9" /></div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="listing-confirm-cancel" class="btn">Нет</button>
          <button id="listing-confirm-ok" class="btn btn-primary">Да, выставить</button>
        </div>
      </div>
    `;
    document.body.appendChild(listingConfirmModal);
    listingConfirmModal.querySelector('#listing-confirm-close').addEventListener('click', ()=> listingConfirmModal.classList.add('hidden'));
  }

  // Auction create modal
  function ensureAuctionCreateModal(){
    if (auctionCreateModal) return;
    auctionCreateModal = document.createElement('div');
    auctionCreateModal.className = 'modal auction-create hidden';
    auctionCreateModal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" id="auction-create-close">✕</button>
        <h3 class="highlight-text" style="margin-top:0">Создать аукцион</h3>
        <div style="margin-top:8px">Выберите подарок: <select id="auction-item-select" style="margin-left:8px;padding:6px;border-radius:6px;background:#061018;color:#e6eef9"></select></div>
        <div style="margin-top:8px">Стартовая ставка (TON): <input id="auction-start-price" type="number" min="1" style="width:120px;padding:6px;border-radius:6px;background:#061018;border:1px solid rgba(255,255,255,0.04);color:#e6eef9" /></div>
        <div style="margin-top:8px">Длительность: 
          <label style="margin-left:8px"><input type="radio" name="auction-dur" value="15"> 15м</label>
          <label style="margin-left:8px"><input type="radio" name="auction-dur" value="30"> 30м</label>
          <label style="margin-left:8px"><input type="radio" name="auction-dur" value="60" checked> 1ч</label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="auction-create-cancel" class="btn">Отмена</button>
          <button id="auction-create-ok" class="btn btn-primary">Подтвердить</button>
        </div>
      </div>
    `;
    document.body.appendChild(auctionCreateModal);
    auctionCreateModal.querySelector('#auction-create-close').addEventListener('click', ()=> auctionCreateModal.classList.add('hidden'));
    auctionCreateModal.querySelector('#auction-create-cancel').addEventListener('click', ()=> auctionCreateModal.classList.add('hidden'));
  }

  // Auctions page / item page creation
  function ensureAuctionsPage(){
    if (auctionsPage) return;
    const app = document.getElementById('app');
    if (!app) return;
    const page = document.createElement('main');
    page.className = 'page hidden';
    page.id = 'page-auctions';
    page.innerHTML = `
      <section class="auctions card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="margin:0" class="highlight-text">Аукционы</h3>
          <div style="font-size:13px;color:#cfe8ff">Баланс: <strong id="auctions-balance-display"></strong></div>
        </div>
        <div style="color:#a8b7c9;margin-bottom:12px">Активные аукционы — обновляется каждую секунду.</div>
        <div id="auctions-list" class="auctions-grid"></div>
      </section>
    `;
    app.appendChild(page);
    auctionsPage = page;
  }

  function ensureAuctionItemPage(){
    if (auctionItemPage) return;
    const app = document.getElementById('app');
    if (!app) return;
    const page = document.createElement('main');
    page.className = 'page hidden';
    page.id = 'page-auction-item';
    page.innerHTML = `
      <section class="auction-item card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <button id="auction-item-back" class="btn">← Назад</button>
          <h3 id="auction-item-title" style="margin:0" class="highlight-text"></h3>
        </div>
        <div id="auction-item-body" style="display:flex;flex-direction:column;gap:12px"></div>
      </section>
    `;
    app.appendChild(page);
    auctionItemPage = page;
    page.querySelector('#auction-item-back').addEventListener('click', () => showPage('auctions'));
  }

  // Offers modal (global)
  function ensureOffersGlobalModal(){
    if (offersGlobalModal) return;
    offersGlobalModal = document.createElement('div');
    offersGlobalModal.className = 'modal offers-global hidden';
    offersGlobalModal.innerHTML = `
      <div class="modal-content" style="max-width:640px">
        <button class="modal-close" id="offers-global-close">✕</button>
        <h3 class="highlight-text" style="margin-top:0">Оферы</h3>
        <div id="offers-global-body" style="max-height:420px;overflow:auto;margin-top:8px;display:flex;flex-direction:column;gap:8px"></div>
      </div>
    `;
    document.body.appendChild(offersGlobalModal);
    offersGlobalModal.querySelector('#offers-global-close').addEventListener('click', ()=> offersGlobalModal.classList.add('hidden'));
  }

  // Send gift: simply open chat (no selection)
  function ensureSendGiftModal(){
    if (sendGiftModal) return;
    sendGiftModal = document.createElement('div');
    sendGiftModal.className = 'modal send-gift-modal hidden';
    sendGiftModal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" id="sendgift-close">✕</button>
        <h3 class="highlight-text" style="margin-top:0">Открыть чат</h3>
        <div style="margin-top:8px">Будет открыт чат с <strong>@Xionzq</strong>.</div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
          <button id="sendgift-ok" class="btn btn-primary">Открыть чат</button>
        </div>
      </div>
    `;
    document.body.appendChild(sendGiftModal);
    sendGiftModal.querySelector('#sendgift-close').addEventListener('click', ()=> sendGiftModal.classList.add('hidden'));
  }

  // My Listings modal (fix)
  function ensureMyListingsModal(){
    if (myListingsModal) return;
    myListingsModal = document.createElement('div');
    myListingsModal.className = 'modal mylist-modal hidden';
    myListingsModal.innerHTML = `
      <div class="modal-content" style="max-width:640px">
        <button class="modal-close" id="mylist-close">✕</button>
        <h3 class="highlight-text" style="margin-top:0">Мои выставленные подарки</h3>
        <div id="mylist-body" style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;margin-top:12px"></div>
      </div>
    `;
    document.body.appendChild(myListingsModal);
    myListingsModal.querySelector('#mylist-close').addEventListener('click', ()=> myListingsModal.classList.add('hidden'));
  }

  function openMyListingsModal(){
    ensureMyListingsModal();
    refreshMyListingsModalContent();
    myListingsModal.classList.remove('hidden');
  }

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
      const imgSrc = getImageForItem(l.item);
      const preview = imgSrc ? `<img src="${imgSrc}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;margin-right:8px" alt="${escapeHtml(l.item.title)}" data-item-id="${escapeHtml(l.item._id||'')}" />` : `<div style="width:48px;height:48px;border-radius:8px;background:#071827;display:flex;align-items:center;justify-content:center">${l.item.emoji||'🎁'}</div>`;
      const offersFor = (state.offers || []).filter(o => o.listingId === l.id && o.status === 'pending');
      const offersHtml = offersFor.map(o => `<div style="font-size:13px;color:#9fb0c8;margin-top:6px">Офер ${o.amount} TON от ${escapeHtml(o.fromBuyerId || 'user')} <button class="btn accept-offer" data-id="${o.id}" style="margin-left:8px">Принять</button> <button class="btn reject-offer" data-id="${o.id}" style="margin-left:6px">Отклонить</button></div>`).join('');
      row.innerHTML = `<div style="display:flex;align-items:center;gap:10px">${preview}
        <div><div style="font-weight:700;color:#fff">${escapeHtml(l.item.title)}</div><div style="font-size:12px;color:#9fb0c8">${l.price} TON</div>${offersHtml}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn listing-action delist-btn" data-id="${l.id}">Снять с продажи</button>
        </div>`;
      body.appendChild(row);
    });

    // delist handlers and accept/reject handlers exist; unchanged from previous logic
    body.querySelectorAll('.delist-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await showConfirm('Вы уверены, что хотите снять этот лот с продажи и вернуть его в инвентарь?');
        if (!ok) return;
        const idx = (state.market || []).findIndex(x => x.id === id);
        if (idx >= 0) {
          const listing = state.market.splice(idx,1)[0];
          const item = { _id: listing.item._id || listing.item.title, title: listing.item.title, image: getImageForItem(listing.item) };
          state.inventory = state.inventory || [];
          state.inventory.push(item);
          saveState();
          refreshMyListingsModalContent();
          renderInventory();
          renderMarket();
          alert('Лот снят с продажи и возвращён в инвентарь.');
        }
      });
    });

    body.querySelectorAll('.accept-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const offerId = btn.dataset.id;
        const offer = (state.offers || []).find(o => o.id === offerId);
        if (!offer) return alert('Офер не найден.');
        const listing = (state.market || []).find(m => m.id === offer.listingId);
        if (!listing) return alert('Лот не найден.');
        if (String(listing.sellerId) !== String(state.profile.id)) return alert('Только владелец лота может принимать оферы.');
        const ok = await showConfirm(`Принять офер ${offer.amount} TON от ${escapeHtml(offer.fromBuyerId)} на "${listing.item.title}"?`);
        if (!ok) return;

        if (String(listing.sellerId) === String(state.profile.id)) {
          state.balance = Number(state.balance) + Number(offer.amount || 0);
          addHistory('sale', offer.amount, `Продажа ${listing.item.title}`);
        }

        if (String(offer.fromBuyerId) === String(state.profile.id)) {
          const bought = { _id: listing.item._id || listing.item.title, title: listing.item.title, image: getImageForItem(listing.item) };
          state.inventory = state.inventory || [];
          state.inventory.push(bought);
          addHistory('purchase', -offer.amount, `Покупка ${listing.item.title}`);
        }

        state.market = (state.market || []).filter(m => m.id !== listing.id);
        (state.offers || []).forEach(o => {
          if (o.listingId === listing.id) {
            if (o.id === offer.id) o.status = 'accepted';
            else {
              if (o.status === 'pending' && String(o.fromBuyerId) === String(state.profile.id) && o.reserved) {
                state.balance = Number(state.balance) + Number(o.amount || 0);
              }
              o.status = 'rejected';
            }
          }
        });

        saveState();
        refreshMyListingsModalContent();
        renderInventory();
        renderMarket();
        alert('Офер принят (симуляция).');
      });
    });

    body.querySelectorAll('.reject-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const offerId = btn.dataset.id;
        const offer = (state.offers || []).find(o => o.id === offerId);
        if (!offer) return alert('Офер не найден.');
        const ok = await showConfirm('Отклонить офер?');
        if (!ok) return;
        if (String(offer.fromBuyerId) === String(state.profile.id) && offer.reserved) {
          state.balance = Number(state.balance) + Number(offer.amount || 0);
        }
        offer.status = 'rejected';
        saveState();
        refreshMyListingsModalContent();
        renderInventory();
        renderMarket();
        alert('Офер отклонён.');
      });
    });
  }

  // RENDERERS
  const profileNameEl = document.getElementById('profile-name');
  const profileTgEl = document.getElementById('profile-tgnick');
  const profileIdEl = document.getElementById('profile-id');

  function renderProfile(){
    if (profileNameEl) profileNameEl.textContent = state.profile && state.profile.name ? state.profile.name : 'Пользователь';
    if (profileTgEl) profileTgEl.textContent = state.profile && state.profile.tgnick ? state.profile.tgnick : '@yourtg';
    if (profileIdEl) profileIdEl.textContent = `ID: ${state.profile && state.profile.id ? state.profile.id : '000000'}`;
    if (balTonEl) balTonEl.textContent = String(state.balance || 0);
    if (balUsdtEl) balUsdtEl.textContent = '0';

    renderInventory();
    renderHistory();

    const profileMarketBtn = document.getElementById('profile-market-btn');
    if (profileMarketBtn) {
      profileMarketBtn.onclick = null;
      profileMarketBtn.addEventListener('click', () => openMyListingsModal());
    }
  }

  // Inventory renderer: now uses consistent grid with 2 columns on mobile and equal frames
  function renderInventory(){
    const grid = invGrid;
    if (!grid) return;
    // ensure grid container
    grid.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'inventory-grid';
    grid.appendChild(wrapper);

    const inv = state.inventory || [];
    if (!inv || inv.length === 0) {
      wrapper.innerHTML = `<div class="muted">— пусто —</div>`;
      renderInventoryFooter(grid);
      return;
    }

    inv.forEach(item => {
      const card = document.createElement('div');
      card.className = 'inventory-card';
      const imgSrc = getImageForItem(item);
      const imageHtml = imgSrc ? `<div class="img-wrap"><img class="sticker-img" src="${imgSrc}" alt="${escapeHtml(item.title)}" data-item-id="${escapeHtml(item._id||'')}" /></div>` : `<div class="img-wrap">${item.emoji || '🎁'}</div>`;
      const titleHtml = `<div class="card-body"><div style="font-weight:800;color:#fff" class="text-ellipsis">${escapeHtml(item.title)}</div></div>`;
      card.innerHTML = `
        <div class="card-top">
          ${imageHtml}
          ${titleHtml}
        </div>
        <div class="card-actions">
          <button class="btn sell-btn" data-id="${item._id}" style="flex:1">Выставить</button>
          <button class="btn auction-btn" data-id="${item._id}" style="flex:1">Аукционы</button>
        </div>
      `;
      wrapper.appendChild(card);

      // Sell handler
      card.querySelector('.sell-btn').addEventListener('click', async () => {
        const id = card.querySelector('.sell-btn').dataset.id;
        const idx = (state.inventory || []).findIndex(i => i._id === id);
        if (idx < 0) return alert('Предмет не найден в инвентаре.');
        const itemToSell = state.inventory[idx];
        ensureListingConfirmModal();
        listingConfirmModal.querySelector('#listing-confirm-title').textContent = itemToSell.title;
        const priceInput = listingConfirmModal.querySelector('#listing-confirm-price');
        priceInput.value = String(suggestPriceForItem(itemToSell));
        listingConfirmModal.classList.remove('hidden');

        const okBtn = listingConfirmModal.querySelector('#listing-confirm-ok');
        const cancelBtn = listingConfirmModal.querySelector('#listing-confirm-cancel');
        const okClone = okBtn.cloneNode(true);
        const cancelClone = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(okClone, okBtn);
        cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);

        cancelClone.addEventListener('click', () => listingConfirmModal.classList.add('hidden'));
        okClone.addEventListener('click', () => {
          const price = Number(priceInput.value);
          if (!isFinite(price) || price <= 0) return alert('Некорректная цена.');
          const removed = state.inventory.splice(idx,1)[0];
          const listing = {
            id: `L-${Date.now()}`,
            item: Object.assign({}, removed, { _id: removed._id }),
            price,
            seller: state.profile && state.profile.tgnick ? state.profile.tgnick : 'seller',
            sellerId: state.profile && state.profile.id ? state.profile.id : 'seller_0',
            createdAt: Date.now(),
            nftLink: removed.nftLink || ''
          };
          state.market = state.market || [];
          state.market.push(listing);
          saveState();
          listingConfirmModal.classList.add('hidden');
          renderInventory();
          renderMarket();
          alert('Подарок выставлен на маркет.');
        });
      });

      // Auction create handler
      card.querySelector('.auction-btn').addEventListener('click', () => openAuctionCreateFlow(item._id));
    });

    renderInventoryFooter(grid);
  }

  function renderInventoryFooter(grid){
    const existing = grid.querySelector('.inventory-footer');
    if (existing) existing.remove();
    const footer = document.createElement('div');
    footer.className = 'inventory-footer';
    footer.innerHTML = `
      <button class="btn" id="inventory-offers-btn">Оферы</button>
      <button class="btn" id="inventory-auctions-btn">Аукционы</button>
      <button class="btn btn-primary" id="inventory-sendgift-btn">Отправить подарок</button>
    `;
    grid.appendChild(footer);

    document.getElementById('inventory-offers-btn').addEventListener('click', () => openOffersGlobal());
    document.getElementById('inventory-auctions-btn').addEventListener('click', () => openAuctionsPage());
    document.getElementById('inventory-sendgift-btn').addEventListener('click', () => {
      const tgUser = '@Xionzq';
      const url = `https://t.me/${tgUser.replace(/^@/,'')}`;
      window.open(url, '_blank');
    });
  }

  function renderHistory(){
    const el = historyList;
    if (!el) return;
    el.innerHTML = '';
    const h = state.history || [];
    if (!h || h.length === 0) {
      el.innerHTML = `<div class="muted">Транзакции появятся здесь.</div>`;
      return;
    }
    h.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.style.padding = '8px';
      row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      row.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${escapeHtml(entry.type || '')}</strong><div class="muted" style="font-size:12px">${escapeHtml(entry.desc || '')}</div></div><div style="text-align:right"><div style="font-weight:800">${entry.amount>0? '+'+entry.amount: entry.amount}</div><div class="muted" style="font-size:12px">${new Date(entry.ts).toLocaleString()}</div></div></div>`;
      el.appendChild(row);
    });
  }

  // The rest of market / auction / offers logic remains unchanged — kept as previously implemented.
  // For brevity, reuse previously defined functions for market UI, filtering, offers, auctions, etc.
  // (All those functions are included earlier in this file and remain intact.)

  // Populate filter dropdown options based on current market data and optional cdnIndex
  function populateMarketFilters(){
    const giftSel = document.getElementById('filter-gift');
    const modelSel = document.getElementById('filter-model');
    const bgSel = document.getElementById('filter-background');
    const symbolSel = document.getElementById('filter-symbol');

    if (!giftSel || !modelSel || !bgSel || !symbolSel) return;

    const gifts = new Set();
    const models = new Set();
    const bgs = new Set();
    const syms = new Set();

    // include items from state.market
    (state.market || []).forEach(l => {
      const it = l.item || {};
      if (it.title) gifts.add(it.title);
      if (it.model) models.add(it.model);
      if (it.background) bgs.add(it.background);
      if (it.symbol) syms.add(it.symbol);
      if (Array.isArray(it.aliases)) it.aliases.forEach(a => gifts.add(a));
    });

    // also include items from cdnIndex if available
    if (Array.isArray(state.cdnIndex)) {
      state.cdnIndex.forEach(entry => {
        const it = entry || {};
        if (it.title) gifts.add(it.title);
        if (it.model) models.add(it.model);
        if (it.background) bgs.add(it.background);
        if (it.symbol) syms.add(it.symbol);
        if (Array.isArray(it.aliases)) it.aliases.forEach(a => gifts.add(a));
      });
    }

    function refill(sel, values){
      const cur = sel.value || '';
      sel.innerHTML = `<option value="">${sel === giftSel ? 'Gifts: All' : sel === modelSel ? 'Model: All' : sel === bgSel ? 'Background: All' : 'Symbol: All'}</option>`;
      Array.from(values).filter(Boolean).sort().forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
      if (cur) sel.value = cur;
    }

    refill(giftSel, gifts);
    refill(modelSel, models);
    refill(bgSel, bgs);
    refill(symbolSel, syms);
  }

  // MARKET UI & logic with filters (unchanged logic)
  function createMarketUI(){
    // ensure bottom nav exists
    if (navBottom) {
      if (!document.querySelector('[data-page="market"]')) {
        const marketBtn = document.createElement('button');
        marketBtn.className = 'nav-btn';
        marketBtn.dataset.page = 'market';
        marketBtn.textContent = 'Маркет';
        navBottom.appendChild(marketBtn);
        marketBtn.addEventListener('click', ()=> showPage('market'));
      }
      if (!document.querySelector('[data-page="auctions"]')) {
        const aucBtn = document.createElement('button');
        aucBtn.className = 'nav-btn';
        aucBtn.dataset.page = 'auctions';
        aucBtn.textContent = 'Аукционы';
        navBottom.appendChild(aucBtn);
        aucBtn.addEventListener('click', ()=> openAuctionsPage());
      }
    }

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

          <!-- FILTERS ROW -->
          <div class="filters-row">
            <select id="filter-gift" title="Gifts">
              <option value="">Gifts: All</option>
            </select>
            <select id="filter-model" title="Model">
              <option value="">Model: All</option>
            </select>
            <select id="filter-background" title="Background">
              <option value="">Background: All</option>
            </select>
            <select id="filter-symbol" title="Symbol">
              <option value="">Symbol: All</option>
            </select>
            <select id="filter-sort" title="Sort">
              <option value="latest">Latest</option>
              <option value="mint_time">Mint Time</option>
              <option value="rarity_score">Rarity Score</option>
              <option value="price_low_high">Price: Low to High</option>
              <option value="price_high_low">Price: High to Low</option>
              <option value="giftid_asc">Gift ID: Ascending</option>
              <option value="giftid_desc">Gift ID: Descending</option>
              <option value="model_rarity_asc">Model Rarity: Ascending</option>
              <option value="bg_rarity_asc">Background Rarity: Ascending</option>
              <option value="symbol_rarity_asc">Symbol Rarity: Ascending</option>
            </select>
            <input id="filter-giftid" placeholder="Gift ID #" style="width:120px" />
            <input id="market-search" placeholder="Поиск..." style="flex:1;padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
            <input id="market-min" type="number" placeholder="min TON" style="width:90px" />
            <input id="market-max" type="number" placeholder="max TON" style="width:90px" />
            <button id="market-refresh" class="btn">Обновить</button>
          </div>

          <div id="market-list" class="market-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:8px;max-height:420px;overflow:auto"></div>
        </section>
      `;
      app.appendChild(marketPage);
    }

    if (!document.getElementById('page-market-item')) {
      const app = document.getElementById('app');
      if (!app) return;
      const page = document.createElement('main');
      page.className = 'page hidden';
      page.id = 'page-market-item';
      page.innerHTML = `
        <section class="market-item card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <button id="market-item-back" class="btn">← Назад</button>
            <h3 id="market-item-title" style="margin:0" class="highlight-text"></h3>
          </div>
          <div id="market-item-body" style="display:flex;flex-direction:column;gap:12px"></div>
        </section>
      `;
      app.appendChild(page);
      page.querySelector('#market-item-back').addEventListener('click', () => {
        showPage('market');
      });
    }
  }

  function renderMarket(){
    const marketList = document.getElementById('market-list');
    const balDisp = document.getElementById('market-balance-display');
    if (balDisp) balDisp.textContent = `${state.balance} TON`;
    if (!marketList) return;

    populateMarketFilters();

    const qEl = document.getElementById('market-search');
    const minEl = document.getElementById('market-min');
    const maxEl = document.getElementById('market-max');
    const giftFilterEl = document.getElementById('filter-gift');
    const modelFilterEl = document.getElementById('filter-model');
    const bgFilterEl = document.getElementById('filter-background');
    const symbolFilterEl = document.getElementById('filter-symbol');
    const sortEl = document.getElementById('filter-sort');
    const giftIdEl = document.getElementById('filter-giftid');

    const query = qEl ? qEl.value.trim().toLowerCase() : '';
    const minV = minEl && Number(minEl.value) ? Number(minEl.value) : 0;
    const maxV = maxEl && Number(maxEl.value) ? Number(maxEl.value) : Number.MAX_SAFE_INTEGER;
    const giftFilter = giftFilterEl ? giftFilterEl.value.trim().toLowerCase() : '';
    const modelFilter = modelFilterEl ? modelFilterEl.value.trim().toLowerCase() : '';
    const bgFilter = bgFilterEl ? bgFilterEl.value.trim().toLowerCase() : '';
    const symbolFilter = symbolFilterEl ? symbolFilterEl.value.trim().toLowerCase() : '';
    const sortBy = sortEl ? sortEl.value : 'latest';
    const giftIdFilter = giftIdEl ? giftIdEl.value.trim() : '';

    const listings = (state.market || []).filter(listing => {
      const it = listing.item || {};
      const title = ((isNFTItem(it) ? getDisplayTitle(it) : it.title) || '').toLowerCase();
      const aliases = (Array.isArray(it.aliases) ? it.aliases.join(' ').toLowerCase() : '');
      const searchable = `${title} ${aliases}`;
      const matchesQuery = !query || searchable.includes(query);
      const price = Number(listing.price || 0);
      const inRange = price >= minV && price <= maxV;

      const matchesGift = !giftFilter || (title && title.includes(giftFilter)) || (aliases && aliases.includes(giftFilter));

      const modelVal = (it.model || '').toLowerCase();
      const bgVal = (it.background || '').toLowerCase();
      const symVal = (it.symbol || '').toLowerCase();
      const matchesModel = !modelFilter || (modelVal && modelVal.includes(modelFilter));
      const matchesBg = !bgFilter || (bgVal && bgVal.includes(bgFilter));
      const matchesSym = !symbolFilter || (symVal && symVal.includes(symbolFilter));

      let matchesGiftId = true;
      if (giftIdFilter) {
        const normalized = giftIdFilter.replace(/[^0-9]/g,'');
        if (!normalized) {
          matchesGiftId = listing.id && listing.id.toLowerCase().includes(giftIdFilter.toLowerCase());
        } else {
          matchesGiftId = String(listing.id || '').includes(normalized) || (it._id && String(it._id).includes(normalized));
        }
      }

      return matchesQuery && inRange && matchesGift && matchesModel && matchesBg && matchesSym && matchesGiftId;
    });

    const sorted = listings.slice();
    sorted.sort((a,b) => {
      if (sortBy === 'latest') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'mint_time') {
        return (b.item && b.item.mintTime ? b.item.mintTime : 0) - (a.item && a.item.mintTime ? a.item.mintTime : 0);
      }
      if (sortBy === 'rarity_score') {
        const ra = Number((a.item && a.item.rarityScore) || 0);
        const rb = Number((b.item && b.item.rarityScore) || 0);
        return ra - rb;
      }
      if (sortBy === 'price_low_high') return Number(a.price||0) - Number(b.price||0);
      if (sortBy === 'price_high_low') return Number(b.price||0) - Number(a.price||0);
      if (sortBy === 'giftid_asc') return String(a.id).localeCompare(String(b.id), undefined, {numeric:true});
      if (sortBy === 'giftid_desc') return String(b.id).localeCompare(String(a.id), undefined, {numeric:true});
      if (sortBy === 'model_rarity_asc') return (Number(a.item && a.item.modelRarity || 0) - Number(b.item && b.item.modelRarity || 0));
      if (sortBy === 'bg_rarity_asc') return (Number(a.item && a.item.backgroundRarity || 0) - Number(b.item && b.item.backgroundRarity || 0));
      if (sortBy === 'symbol_rarity_asc') return (Number(a.item && a.item.symbolRarity || 0) - Number(b.item && b.item.symbolRarity || 0));
      return 0;
    });

    marketList.innerHTML = '';
    if (!sorted || sorted.length === 0) {
      marketList.innerHTML = `<div class="muted">В маркетплейсе пока нет подходящих подарков.</div>`;
      return;
    }
    sorted.forEach(listing => {
      const el = document.createElement('div');
      el.className = 'market-card';
      el.style.background = 'linear-gradient(180deg,#061018,#041018)';
      el.style.border = '1px solid rgba(255,255,255,0.04)';
      el.style.borderRadius = '12px';
      el.style.padding = '12px';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';
      el.dataset.listingId = listing.id;

      const imgSrc = getImageForItem(listing.item);
      const previewHtml = imgSrc ? `<img class="preview" src="${imgSrc}" alt="${escapeHtml(listing.item.title)}" data-item-id="${escapeHtml(listing.item._id||'')}" />` : `<div style="width:64px;height:64px;border-radius:10px;background:#071827;display:flex;align-items:center;justify-content:center;font-size:28px">${listing.item.emoji || '🎁'}</div>`;
      const title = isNFTItem(listing.item) ? getDisplayTitle(listing.item) : (listing.item.title || '');
      const approx = suggestPriceForItem(listing.item, listing.id);

      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px">
          ${previewHtml}
          <div style="flex:1">
            <div style="font-weight:800;color:#fff">${escapeHtml(title)}</div>
            <div class="approx" style="color:#9fb0c8;font-size:13px">Approx: ${approx} TON</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
            <div style="display:flex;gap:8px;align-items:center">
              <div class="market-offer-sticker" title="Оферы" data-id="${listing.id}">✉️</div>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
          <div class="price-badge">${listing.price} TON</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn market-buy" data-id="${listing.id}">Купить</button>
          </div>
        </div>
      `;
      marketList.appendChild(el);
    });

    marketList.querySelectorAll('.market-buy').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.id;
        const listing = (state.market || []).find(m => m.id === id);
        if (!listing) return alert('Лот не найден.');
        if (String(listing.sellerId) === String(state.profile.id)) return alert('Нельзя покупать собственный лот.');
        if ((state.balance || 0) < listing.price) {
          const ok = await showConfirm(`У вас ${state.balance} TON — недостаточно для покупки (${listing.price} TON). Открыть пополнение?`);
          if (ok) openTopupModal();
          return;
        }
        const ok = await showConfirm(`Купить "${listing.item.title}" за ${listing.price} TON? Это окончательное подтверждение.`);
        if (!ok) return;
        state.balance = Number(state.balance) - listing.price;
        const bought = { _id: listing.item._id || listing.item.title, title: listing.item.title, image: getImageForItem(listing.item) };
        state.inventory = state.inventory || [];
        state.inventory.push(bought);
        state.market = (state.market || []).filter(m => m.id !== id);
        addHistory('purchase', -listing.price, `Purchased ${listing.item.title} from market`);
        if (String(listing.sellerId) === String(state.profile.id)) {
          addHistory('sale', listing.price, `Продажа ${listing.item.title}`);
          state.balance = Number(state.balance) + Number(listing.price);
        }
        (state.offers || []).forEach(o => { if (o.listingId === id && o.status === 'pending' && String(o.fromBuyerId) === String(state.profile.id) && o.reserved) { state.balance = Number(state.balance) + Number(o.amount || 0); } if (o.listingId === id && o.status === 'pending') o.status = 'rejected'; });
        saveState();
        renderProfile();
        renderMarket();
        alert('Покупка прошла успешно — подарок добавлен в инвентарь.');
      });
    });

    marketList.querySelectorAll('.market-offer-sticker').forEach(st => {
      st.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = st.dataset.id;
        const listing = (state.market || []).find(m => m.id === id);
        if (!listing) return alert('Лот не найден.');
        openListingOffersModal(listing);
      });
    });

    marketList.querySelectorAll('.market-card').forEach(card => {
      card.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button, .market-offer-sticker, .market-buy');
        if (btn) return;
        const listingId = card.dataset.listingId;
        const listing = (state.market || []).find(m => m.id === listingId);
        if (!listing) return;
        openMarketItemPage(listing);
      });
    });
  }

  function openMarketItemPage(listing){
    createMarketUI();
    const page = document.getElementById('page-market-item');
    if (!page) return;
    const titleEl = page.querySelector('#market-item-title');
    const body = page.querySelector('#market-item-body');
    const img = getImageForItem(listing.item);
    titleEl.textContent = getDisplayTitle(listing.item) || listing.item.title || 'Item';
    body.innerHTML = `
      <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:0 0 340px">
          ${img ? `<img src="${img}" style="width:100%;border-radius:12px;object-fit:cover" alt="${escapeHtml(listing.item.title)}" data-item-id="${escapeHtml(listing.item._id||'')}" />` : `<div style="width:100%;height:240px;border-radius:12px;background:#071827;display:flex;align-items:center;justify-content:center;font-size:48px">${listing.item.emoji||'🎁'}</div>`}
        </div>
        <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:800;color:#fff;font-size:18px">${escapeHtml(getDisplayTitle(listing.item) || listing.item.title)}</div>
          <div style="color:#9fb0c8">ID: <span style="font-family:monospace">${escapeHtml(listing.id)}</span></div>
          <div style="color:#9fb0c8">Seller: <strong>${escapeHtml(listing.seller || '—')}</strong></div>
          <div style="margin-top:8px">
            <div style="font-size:13px;color:#9fb0c8">Approx price (market average for similar): <strong>${suggestPriceForItem(listing.item, listing.id)} TON</strong></div>
            <div style="margin-top:8px;font-size:22px;font-weight:900;color:#bfe8ff">${listing.price} TON</div>
          </div>
          <div style="margin-top:auto;display:flex;flex-wrap:wrap;gap:10px">
            <button id="market-item-buy" class="btn market-buy">Купить</button>
            <button id="market-item-offer" class="btn" style="background:transparent;border:0;padding:0"><div class="market-offer-sticker" id="market-item-offer-sticker">✉️</div></button>
            <a id="market-item-photo-link" class="btn" style="display:inline-flex;align-items:center" href="${listing.item.nftLink || (getImageForItem(listing.item) || '#')}" target="_blank">Фото / NFT</a>
          </div>
        </div>
      </div>
      <div style="margin-top:12px;color:#9fb0c8">Описание: ${escapeHtml(listing.item.description || '')}</div>
    `;
    const buy = page.querySelector('#market-item-buy');
    buy.addEventListener('click', async () => {
      if (String(listing.sellerId) === String(state.profile.id)) return alert('Нельзя покупать собственный лот.');
      if ((state.balance || 0) < listing.price) {
        const ok = await showConfirm(`У вас ${state.balance} TON — недостаточно для покупки (${listing.price} TON). Открыть пополнение?`);
        if (ok) openTopupModal();
        return;
      }
      const ok = await showConfirm(`Купить "${listing.item.title}" за ${listing.price} TON? Это окончательное подтверждение.`);
      if (!ok) return;
      state.balance = Number(state.balance) - listing.price;
      const bought = { _id: listing.item._id || listing.item.title, title: listing.item.title, image: getImageForItem(listing.item) };
      state.inventory = state.inventory || [];
      state.inventory.push(bought);
      state.market = (state.market || []).filter(m => m.id !== listing.id);
      addHistory('purchase', -listing.price, `Purchased ${listing.item.title} from market`);
      if (String(listing.sellerId) === String(state.profile.id)) {
        addHistory('sale', listing.price, `Продажа ${listing.item.title}`);
        state.balance = Number(state.balance) + Number(listing.price);
      }
      (state.offers || []).forEach(o => { if (o.listingId === listing.id && o.status === 'pending' && String(o.fromBuyerId) === String(state.profile.id) && o.reserved) { state.balance = Number(state.balance) + Number(o.amount || 0); } if (o.listingId === listing.id && o.status === 'pending') o.status = 'rejected'; });
      saveState();
      renderProfile();
      renderMarket();
      alert('Покупка прошла успешно — подарок добавлен в инвентарь.');
      showPage('market');
    });
    const offerSticker = page.querySelector('#market-item-offer-sticker');
    offerSticker && offerSticker.addEventListener('click', () => openListingOffersModal(listing));
    const photoLink = page.querySelector('#market-item-photo-link');
    if (photoLink && listing.item.nftLink) photoLink.href = listing.item.nftLink;
    showPage('market-item');
  }

  // Listing offers modal: unchanged behavior
  function ensureListingOffersModal(){
    if (listingOffersModal) return;
    listingOffersModal = document.createElement('div');
    listingOffersModal.className = 'modal listing-offers-modal hidden';
    listingOffersModal.style.zIndex = 11000;
    listingOffersModal.innerHTML = `
      <div class="modal-content" style="max-width:520px">
        <button class="modal-close" id="listing-offers-close" aria-label="Закрыть">✕</button>
        <h3 style="margin-top:0" class="highlight-text">Оферы по лоту</h3>
        <div id="listing-offers-body" style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow:auto;margin-top:10px"></div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
          <input id="listing-offer-amount" placeholder="Сумма в TON" style="flex:1;padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
          <button id="listing-offer-send" class="btn btn-primary">Отправить офер</button>
        </div>
      </div>
    `;
    document.body.appendChild(listingOffersModal);
    listingOffersModal.querySelector('#listing-offers-close').addEventListener('click', ()=> listingOffersModal.classList.add('hidden'));
  }

  function openListingOffersModal(listing){
    ensureListingOffersModal();
    const body = listingOffersModal.querySelector('#listing-offers-body');
    body.innerHTML = '';
    const img = getImageForItem(listing.item);
    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px">${img?`<img src="${img}" style="width:56px;height:56px;border-radius:10px;object-fit:cover" alt="${escapeHtml(listing.item.title)}" data-item-id="${escapeHtml(listing.item._id||'')}" />`:''}<div><div style="font-weight:800;color:#fff">${escapeHtml(getDisplayTitle(listing.item) || listing.item.title)}</div><div style="font-size:13px;color:#9fb0c8">ID: ${escapeHtml(listing.id)}</div></div></div>`;
    const offersFor = (state.offers || []).filter(o => o.listingId === listing.id && o.status === 'pending').sort((a,b)=>b.createdAt - a.createdAt);
    if (!offersFor || offersFor.length === 0) {
      body.innerHTML += `<div class="muted" style="margin-top:12px">Пока нет активных оферов на этот лот.</div>`;
    } else {
      offersFor.forEach(o => {
        const row = document.createElement('div');
        row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
        row.style.padding='8px'; row.style.borderBottom='1px solid rgba(255,255,255,0.03)';
        row.innerHTML = `<div><div style="font-weight:800;color:#fff">${escapeHtml(o.amount)} TON</div><div style="font-size:12px;color:#9fb0c8">От: ${escapeHtml(o.fromBuyerId || 'user')}</div></div>
          <div style="display:flex;gap:8px">
            ${String(o.fromBuyerId) === String(state.profile.id) ? `<button class="btn cancel-offer" data-id="${o.id}">Отменить</button>` : ''}
            ${String(o.toSellerId) === String(state.profile.id) ? `<button class="btn accept-offer-local" data-id="${o.id}">Принять</button> <button class="btn reject-offer-local" data-id="${o.id}">Отклонить</button>` : ''}
          </div>`;
        body.appendChild(row);
      });
    }

    const amountInput = listingOffersModal.querySelector('#listing-offer-amount');
    const sendBtn = listingOffersModal.querySelector('#listing-offer-send');
    amountInput.value = String(Math.max(1, Math.round(listing.price * 0.8)));
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    newSendBtn.addEventListener('click', () => {
      if (String(listing.sellerId) === String(state.profile.id)) return alert('Нельзя отправлять офер на собственный лот.');
      const raw = amountInput.value;
      const amount = Number(raw);
      if (!isFinite(amount) || amount <= 0) return alert('Некорректная сумма.');
      const existing = (state.offers || []).find(o => o.listingId === listing.id && String(o.fromBuyerId) === String(state.profile.id) && o.status === 'pending');
      if (existing) return alert('Вы уже отправляли офер на этот лот — дождитесь ответа или отмените предыдущий офер.');
      if ((state.balance || 0) < amount) return alert('Недостаточно TON для резерва офера.');
      state.balance = Number(state.balance) - amount;
      const offer = {
        id: `O-${Date.now()}`,
        listingId: listing.id,
        itemId: listing.item && (listing.item._id || listing.item.title),
        fromBuyerId: state.profile && state.profile.id,
        toSellerId: listing.sellerId || null,
        amount,
        status: 'pending',
        reserved: true,
        createdAt: Date.now()
      };
      state.offers = state.offers || [];
      state.offers.push(offer);
      saveState();
      alert(`Офер отправлен: ${amount} TON (средства зарезервированы).`);
      openListingOffersModal(listing);
      renderInventory();
      renderMarket();
    });

    setTimeout(()=> {
      listingOffersModal.querySelectorAll('.cancel-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const offer = (state.offers || []).find(o => o.id === id);
          if (!offer) return alert('Офер не найден.');
          const ok = await showConfirm('Отменить офер?');
          if (!ok) return;
          if (String(offer.fromBuyerId) === String(state.profile.id) && offer.reserved) {
            state.balance = Number(state.balance) + Number(offer.amount || 0);
          }
          offer.status = 'rejected';
          saveState();
          openListingOffersModal(listing);
          renderInventory();
        });
      });
      listingOffersModal.querySelectorAll('.accept-offer-local').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const offer = (state.offers || []).find(o => o.id === id);
          if (!offer) return alert('Офер не найден.');
          const listingObj = (state.market || []).find(m => m.id === offer.listingId);
          if (!listingObj) return alert('Лот не найден.');
          if (String(listingObj.sellerId) !== String(state.profile.id)) return alert('Только владелец лота может принимать оферы.');
          const ok = await showConfirm(`Принять офер ${offer.amount} TON?`);
          if (!ok) return;

          if (String(listingObj.sellerId) === String(state.profile.id)) {
            state.balance = Number(state.balance) + Number(offer.amount || 0);
            addHistory('sale', offer.amount, `Продажа ${listingObj.item.title}`);
          }

          if (String(offer.fromBuyerId) === String(state.profile.id)) {
            const bought = { _id: listingObj.item._id || listingObj.item.title, title: listingObj.item.title, image: getImageForItem(listingObj.item) };
            state.inventory = state.inventory || [];
            state.inventory.push(bought);
            addHistory('purchase', -offer.amount, `Покупка ${listingObj.item.title}`);
          }

          offer.status = 'accepted';
          (state.offers || []).forEach(o => { if (o.listingId === listingObj.id && o.id !== offer.id && o.status === 'pending') { if (String(o.fromBuyerId) === String(state.profile.id) && o.reserved) state.balance = Number(state.balance) + Number(o.amount || 0); o.status = 'rejected'; } });
          state.market = (state.market || []).filter(m => m.id !== listingObj.id);
          saveState();
          openListingOffersModal(listingObj || { id: offer.listingId, item: { title: '—' } });
          renderInventory();
          renderMarket();
          alert('Офер принят. (симуляция)');
        });
      });
      listingOffersModal.querySelectorAll('.reject-offer-local').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const offer = (state.offers || []).find(o => o.id === id);
          if (!offer) return alert('Офер не найден.');
          const ok = await showConfirm('Отклонить офер?');
          if (!ok) return;
          if (String(offer.fromBuyerId) === String(state.profile.id) && offer.reserved) {
            state.balance = Number(state.balance) + Number(offer.amount || 0);
          }
          offer.status = 'rejected';
          saveState();
          openListingOffersModal(listing);
          renderInventory();
          renderMarket();
        });
      });
    }, 50);

    listingOffersModal.classList.remove('hidden');
  }

  // Confirm helper
  function showConfirm(message){
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'confirm-modal-backdrop';
      const box = document.createElement('div');
      box.className = 'confirm-modal';
      box.innerHTML = `<div class="msg">${escapeHtml(message)}</div><div class="buttons" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-primary yes">Да</button><button class="btn no">Нет</button></div>`;
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      box.querySelector('.yes').addEventListener('click', () => { cleanup(); resolve(true); });
      box.querySelector('.no').addEventListener('click', () => { cleanup(); resolve(false); });
      function cleanup(){ backdrop.remove(); }
    });
  }

  // Topup / withdraw wiring
  function openTopupModal(){
    if (!paymentModal) return;
    const payInstructions = document.getElementById('pay-instructions');
    const payAmount = document.getElementById('pay-amount');
    const checkPayBtn = document.getElementById('check-pay');
    if (payInstructions) payInstructions.style.display = 'none';
    if (payAmount) payAmount.value = '';
    if (checkPayBtn) checkPayBtn.style.display = 'none';
    paymentModal.classList.remove('hidden');
  }
  if (topupBtn) topupBtn.addEventListener('click', () => openTopupModal());
  if (paymentClose) paymentClose.addEventListener('click', () => paymentModal && paymentModal.classList.add('hidden'));

  if (openWithdraw) openWithdraw.addEventListener('click', () => openWithdrawModal());
  if (withdrawClose) withdrawClose.addEventListener('click', () => withdrawModal && withdrawModal.classList.add('hidden'));
  if (withdrawCancel) withdrawCancel.addEventListener('click', () => withdrawModal && withdrawModal.classList.add('hidden'));
  if (withdrawConfirm) {
    withdrawConfirm.addEventListener('click', async () => {
      const checks = Array.from((withdrawList || document).querySelectorAll('.withdraw-check')).filter(c => c.checked);
      if (checks.length === 0) return alert('Выберите подарки для вывода.');
      const totalFee = WITHDRAW_FEE * checks.length;
      if ((state.balance || 0) < totalFee) {
        const ok = await showConfirm(`На вашем балансе ${state.balance} TON. Для вывода ${checks.length} предметов потребуется ${totalFee.toFixed(2)} TON (комиссия). Открыть пополнение?`);
        if (ok) openTopupModal();
        return;
      }
      const ok = await showConfirm(`Подтвердите вывод ${checks.length} предметов. С вас спишется ${totalFee.toFixed(2)} TON (комиссия). Продолжить?`);
      if (!ok) return;
      const ids = checks.map(c => c.dataset.id);
      state.inventory = (state.inventory || []).filter(i => !ids.includes(i._id));
      state.balance = Number(state.balance) - Number(totalFee);
      saveState();
      withdrawModal.classList.add('hidden');
      renderProfile();
      alert(`Выведено ${checks.length} предмет(ов). С вашего баланса снято ${totalFee.toFixed(2)} TON (комиссия).`);
    });
  }

  function openWithdrawModal(){
    if (!withdrawModal) return;
    withdrawList.innerHTML = '';
    const inv = state.inventory || [];
    if (!inv || inv.length === 0) {
      withdrawList.innerHTML = `<div class="muted">У вас нет подарков для вывода.</div>`;
    } else {
      inv.forEach(item => {
        const row = document.createElement('div');
        row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
        row.style.padding='8px'; row.style.borderBottom='1px solid rgba(255,255,255,0.03)';
        const img = getImageForItem(item);
        row.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div style="width:44px;height:44px">${img?`<img src="${img}" style="width:44px;height:44px;border-radius:8px;object-fit:cover" alt="${escapeHtml(item.title)}" data-item-id="${escapeHtml(item._id||'')}" />`:`<div style="width:44px;height:44px;border-radius:8px;background:#071827;display:flex;align-items:center;justify-content:center">${item.emoji||'🎁'}</div>`}</div><div><div style="font-weight:700">${escapeHtml(item.title)}</div></div></div><div><input type="checkbox" class="withdraw-check" data-id="${item._id}" /></div>`;
        withdrawList.appendChild(row);
      });
    }
    withdrawMsg.innerHTML = `<div class="muted">Стоимость вывода: <strong>${WITHDRAW_FEE.toFixed(2)} TON</strong> за один предмет.</div>`;
    withdrawModal.classList.remove('hidden');
  }

  // ensure nav auction button in bottom nav
  function ensureAuctionsNavButton(){
    if (!navBottom) return;
    if (!document.querySelector('[data-page="auctions"]')) {
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.dataset.page = 'auctions';
      btn.textContent = 'Аукционы';
      navBottom.appendChild(btn);
      btn.addEventListener('click', () => openAuctionsPage());
    }
  }

  // show page helper
  function showPage(name){
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${name}`) || (name === 'market-item' ? document.getElementById('page-market-item') : null) || (name === 'auction-item' ? document.getElementById('page-auction-item') : null);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  }

  // Auto-open auctions page helper
  function openAuctionsPage(){
    ensureAuctionsPage();
    renderAuctions();
    showPage('auctions');
  }

  // Update auction timers every second and refresh pages; also auto-finalize ended auctions
  function updateAuctionTimers(){
    const els = document.querySelectorAll('.auction-time');
    const now = Date.now();
    els.forEach(el => {
      const ends = Number(el.dataset.ends);
      if (!ends) return;
      const rem = Math.max(0, ends - now);
      el.textContent = rem > 0 ? formatTimeDelta(rem) : 'Завершён';
    });

    const finished = (state.auctions || []).filter(a => a.endsAt <= now);
    if (finished && finished.length > 0) {
      finished.forEach(a => {
        finalizeAuction(a.id, true).catch(()=>{});
      });
    }

    const auctionsPageEl = document.getElementById('page-auctions');
    if (auctionsPageEl && !auctionsPageEl.classList.contains('hidden')) {
      renderAuctions();
    }

    const page = document.getElementById('page-auction-item');
    if (page && !page.classList.contains('hidden')) {
      const title = page.querySelector('#auction-item-title');
      if (title) {
        const auction = (state.auctions || []).find(a => a.item && a.item.title === title.textContent);
        if (auction) {
          const curEl = page.querySelector('#auction-current-amount');
          if (curEl) {
            const current = auction.currentBid ? `${auction.currentBid} TON (от ${escapeHtml(auction.bids[auction.bids.length-1].bidderNick||'—')})` : `Старт ${auction.startPrice} TON`;
            curEl.textContent = current;
          }
          const times = page.querySelectorAll(`[data-ends="${auction.endsAt}"]`);
          times.forEach(t => {
            const rem = Math.max(0, auction.endsAt - Date.now());
            t.textContent = rem > 0 ? formatTimeDelta(rem) : 'Завершён';
          });
          const adminPanel = page.querySelector('#auction-admin-panel');
          if (adminPanel && String(auction.sellerId) === String(state.profile.id)) {
            adminPanel.innerHTML = '';
            if (Date.now() >= auction.endsAt) {
              const finalizeBtn = document.createElement('button');
              finalizeBtn.className = 'btn btn-primary';
              finalizeBtn.textContent = 'Завершить аукцион';
              finalizeBtn.addEventListener('click', async () => {
                await finalizeAuction(auction.id, false);
                openAuctionsPage();
                alert('Аукцион завершён.');
              });
              adminPanel.appendChild(finalizeBtn);
            } else {
              if (!auction.bids || auction.bids.length === 0) {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn';
                cancelBtn.textContent = 'Отменить аукцион';
                cancelBtn.addEventListener('click', async () => {
                  const ok = await showConfirm('Отменить аукцион и вернуть предмет в инвентарь?');
                  if (!ok) return;
                  state.auctions = (state.auctions || []).filter(a => a.id !== auction.id);
                  state.inventory = state.inventory || [];
                  state.inventory.push({ _id: auction.item._id || auction.item.title, title: auction.item.title, image: getImageForItem(auction.item) });
                  saveState();
                  renderInventory();
                  renderAuctions();
                  showPage('auctions');
                  alert('Аукцион отменён, предмет возвращён.');
                });
                adminPanel.appendChild(cancelBtn);
              } else {
                adminPanel.innerHTML = `<div class="muted">Вы владелец. Аукцион завершится: ${new Date(auction.endsAt).toLocaleString()}</div>`;
              }
            }
          }
        }
      }
    }
  }

  function formatTimeDelta(ms){
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
  }

  // Add random NFTs to inventory once
  function addRandomNFTsToProfile(count = 4) {
    state.inventory = state.inventory || [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * RANDOM_NFT_MODELS.length);
      const model = RANDOM_NFT_MODELS[idx];
      const newItem = {
        _id: `${model._id}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        title: model.title,
        image: model.image,
        aliases: model.aliases || [],
        model: model.title
      };
      state.inventory.push(newItem);
    }
    state._nftsSeeded = true;
    saveState();
  }

  // Expose state for debugging
  window.appState = state;

  // Boot sequence
  async function boot(){
    loadState();
    populateSampleGiftsIfEmpty();

    // Try to fetch CDN index (non-blocking): if present, it will populate filters
    try {
      fetchCDNIndex(); // fire and forget
    } catch(e){ /* ignore */ }

    if (!state._nftsSeeded) {
      try {
        addRandomNFTsToProfile(4);
      } catch(e){
        console.warn('seed NFTs failed', e);
      }
    }
    renderProfile();
    createMarketUI();
    renderMarket();
    ensureAuctionsNavButton();

    // market controls wiring
    const marketRefresh = document.getElementById('market-refresh');
    if (marketRefresh) marketRefresh.addEventListener('click', () => renderMarket());
    const marketSearch = document.getElementById('market-search');
    if (marketSearch) marketSearch.addEventListener('input', () => renderMarket());
    const marketMin = document.getElementById('market-min');
    const marketMax = document.getElementById('market-max');
    if (marketMin) marketMin.addEventListener('input', () => renderMarket());
    if (marketMax) marketMax.addEventListener('input', () => renderMarket());

    // filter dropdowns
    const giftSel = document.getElementById('filter-gift');
    const modelSel = document.getElementById('filter-model');
    const bgSel = document.getElementById('filter-background');
    const symbolSel = document.getElementById('filter-symbol');
    const sortSel = document.getElementById('filter-sort');
    const giftIdEl = document.getElementById('filter-giftid');
    if (giftSel) giftSel.addEventListener('change', () => renderMarket());
    if (modelSel) modelSel.addEventListener('change', () => renderMarket());
    if (bgSel) bgSel.addEventListener('change', () => renderMarket());
    if (symbolSel) symbolSel.addEventListener('change', () => renderMarket());
    if (sortSel) sortSel.addEventListener('change', () => renderMarket());
    if (giftIdEl) giftIdEl.addEventListener('input', () => renderMarket());

    const profileMarketBtn = document.getElementById('profile-market-btn');
    if (profileMarketBtn) {
      profileMarketBtn.onclick = null;
      profileMarketBtn.addEventListener('click', () => openMyListingsModal());
    }

    const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
    navBtns.forEach(btn => {
      btn.addEventListener('click', ()=> showPage(btn.dataset.page));
    });

    showPage('profile');
  }

  boot();
  setInterval(updateAuctionTimers, 1000);
  setInterval(saveState, 3000);

})();
