// Full updated app.js — merged original + requested fixes + random NFT seeding + improved market filter
// Changes summary (kept minimal):
// - Offers: funds reserved on creation, refunded on cancel/reject, transferred to seller on accept.
// - Auction: can be cancelled by seller only if no bids; bids reserve funds; refunds on outbid/lose; auto-finalize on end.
// - History: only 'purchase' and 'sale' entries saved.
// - Added random NFT models and seeding into user's profile (only once).
// - Market search now matches item title and aliases/keywords (so queries like "Nehpot", "Kidsack Frog", "Magic Potion" work).
// - Other code left unchanged (UI, layout, unrelated logic).

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

  // --- NEW: random NFT model list (images under CDN_BASE) ---
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
  // ----------------------------------------------------------------

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
    // internal flag to avoid reseeding random NFTs multiple times
    _nftsSeeded: false
  };

  const roulettes = {
    r1: { id:'r1', prize:25, spinCost:13, sticker:{id:'gift', emoji:'🎁', title:'Подарок', price:400} },
    r2: { id:'r2', prize:50, spinCost:25, sticker:{id:'champ', emoji:'🍾', title:'Шампанское', price:50} },
    r3: { id:'r3', prize:100, spinCost:50, sticker:{id:'ring', emoji:'💍', title:'Кольцо', price:100} },
    rnft: { id:'rnft', prize:'NFT', spinCost:200, sticker:{id:'lollipop', emoji:'🍭', title:'Леденец (NFT)', price:200} }
  };

  // Inject small theme tweaks
  (function injectTheme() {
    const css = `
      body, .app, .page, .card, .modal-content { background: #070708 !important; color: #e6eef9 !important; }
      .btn { background: rgba(255,255,255,0.04); color: #e6eef9; border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 12px; cursor: pointer; transition: transform .08s, box-shadow .12s; font-weight:700; }
      .btn-primary { background: linear-gradient(90deg,#00a3ff,#6a8bff); color: #021022; border: none; }
      .sell-btn { background: linear-gradient(90deg,#ffcf4d,#ff7a7a); color:#021022; border:none; }
      .auction-btn { background: linear-gradient(90deg,#ffd36a,#ff8a5c); color:#021022; border:none; font-weight:900; }
      .market-buy { background: linear-gradient(90deg,#2eb85c,#15a34a); color:#021022; border:none; }
      .inventory-footer { display:flex;gap:8px; margin-top:8px; justify-content:flex-start; align-items:center; }
      .muted { color:#9fb0c8 !important; }
      .auction-time { font-weight:700; color:#ffd36a; }
      .market-card .preview { width:72px;height:72px;border-radius:8px;object-fit:cover; }
      .price-badge { background:linear-gradient(90deg,#0b3b5a,#0d6b8a);color:#fff;padding:6px 10px;border-radius:8px;font-weight:800; }
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

  // seed sample data
  function populateSampleGiftsIfEmpty(){
    if (!state.market || state.market.length > 0) return;
    const samples = [
      {
        id: `L-369710-lolpop`,
        item: { _id: 'LolPop-369710', title: 'LolPop', emoji: '🍭', image: `${CDN_BASE}/${ASSET_MAP.lollipop}`, description: 'Lolipop NFT', aliases: ['lollipop','lolpop','nehpot'] },
        price: 250,
        seller: '@market_owner',
        sellerId: 'owner_1',
        createdAt: Date.now(),
        nftLink: 'https://t.me/nft/LolPop-369710'
      },
      {
        id: `L-369713-giftbox`,
        item: { _id: 'GiftBox-369713', title: 'GiftBox', emoji: '🎁', image: `${CDN_BASE}/${ASSET_MAP.gift}`, description: 'Gift box NFT', aliases: ['giftbox','kidsack frog','magic potion'] },
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
      const preview = imgSrc ? `<img src="${imgSrc}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;margin-right:8px" />` : `<div style="width:48px;height:48px;border-radius:8px;background:#071827;display:flex;align-items:center;justify-content:center">${l.item.emoji||'🎁'}</div>`;
      const offersFor = (state.offers || []).filter(o => o.listingId === l.id && o.status === 'pending');
      const offersHtml = offersFor.map(o => `<div style="font-size:13px;color:#9fb0c8;margin-top:6px">Офер ${o.amount} TON от ${escapeHtml(o.fromBuyerId || 'user')} <button class="btn accept-offer" data-id="${o.id}" style="margin-left:8px">Принять</button> <button class="btn reject-offer" data-id="${o.id}" style="margin-left:6px">Отклонить</button></div>`).join('');
      row.innerHTML = `<div style="display:flex;align-items:center;gap:10px">${preview}
        <div><div style="font-weight:700;color:#fff">${escapeHtml(l.item.title)}</div><div style="font-size:12px;color:#9fb0c8">${l.price} TON</div>${offersHtml}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn listing-action delist-btn" data-id="${l.id}">Снять с продажи</button>
        </div>`;
      body.appendChild(row);
    });

    // delist
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

    // accept/reject offers only for owner (double-check)
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

        // seller receives funds if current user
        if (String(listing.sellerId) === String(state.profile.id)) {
          state.balance = Number(state.balance) + Number(offer.amount || 0);
          addHistory('sale', offer.amount, `Продажа ${listing.item.title}`);
        }

        // buyer gets item if buyer is current user
        if (String(offer.fromBuyerId) === String(state.profile.id)) {
          const bought = { _id: listing.item._id || listing.item.title, title: listing.item.title, image: getImageForItem(listing.item) };
          state.inventory = state.inventory || [];
          state.inventory.push(bought);
          addHistory('purchase', -offer.amount, `Покупка ${listing.item.title}`);
        }

        // remove listing and reject others (refund current user's other offers)
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

    // wire "Выставленные подарки" button if present in original HTML
    const profileMarketBtn = document.getElementById('profile-market-btn');
    if (profileMarketBtn) {
      profileMarketBtn.onclick = null;
      profileMarketBtn.addEventListener('click', () => openMyListingsModal());
    }
  }

  // Inventory renderer: per-item Sell and Auction only
  function renderInventory(){
    const grid = invGrid;
    if (!grid) return;
    grid.innerHTML = '';
    const inv = state.inventory || [];
    if (!inv || inv.length === 0) {
      grid.innerHTML = `<div class="empty">— пусто —</div>`;
      renderInventoryFooter(grid);
      return;
    }
    inv.forEach(item => {
      const row = document.createElement('div');
      row.className = 'inventory-item';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '10px';
      row.style.borderRadius = '10px';
      row.style.marginBottom = '8px';

      const imgSrc = getImageForItem(item);
      const preview = imgSrc ? `<img src="${imgSrc}" class="sticker-img" alt="${escapeHtml(item.title)}" />` : `<div class="sticker-img" style="display:flex;align-items:center;justify-content:center;font-size:28px">${item.emoji || '🎁'}</div>`;

      const linkedListing = (state.market || []).find(l => String(l.sellerId || '') === String(state.profile && state.profile.id || '') && ((l.item && l.item._id && l.item._id === item._id) || (l.item && l.item.title && l.item.title === item.title)));

      row.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center;flex:1">
          ${preview}
          <div style="flex:1">
            <div style="font-weight:800;color:#fff">${escapeHtml(item.title)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn sell-btn" data-id="${item._id}">Выставить</button>
          <button class="btn auction-btn" data-id="${item._id}">Аукционы</button>
          ${ linkedListing ? `<span style="font-size:12px;color:#9fb0c8">Лот: ${escapeHtml(linkedListing.id)}</span>` : '' }
        </div>
      `;
      grid.appendChild(row);

      // Sell flow: explicit confirm
      const sellBtn = row.querySelector('.sell-btn');
      sellBtn.addEventListener('click', async () => {
        const id = sellBtn.dataset.id;
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
          // no history for listing
          saveState();
          listingConfirmModal.classList.add('hidden');
          renderInventory();
          renderMarket();
          alert('Подарок выставлен на маркет.');
        });
      });

      // Auction create prefilled from item button (only shown next to item)
      const aucBtn = row.querySelector('.auction-btn');
      aucBtn.addEventListener('click', () => openAuctionCreateFlow(item._id));
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
      // open chat directly without selecting a gift
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

  // Offers global modal showing only pending offers; accept only if you are owner
  function openOffersGlobal(){
    ensureOffersGlobalModal();
    const body = offersGlobalModal.querySelector('#offers-global-body');
    body.innerHTML = '';
    const offers = (state.offers || []).filter(o => o.status === 'pending').slice().sort((a,b)=>b.createdAt - a.createdAt);
    if (!offers || offers.length === 0) {
      body.innerHTML = `<div class="muted">Активных оферов пока нет.</div>`;
    } else {
      offers.forEach(o => {
        const listing = (state.market || []).find(m => m.id === o.listingId) || { item: { title: '—' } };
        const row = document.createElement('div');
        row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
        row.style.padding='8px'; row.style.borderBottom='1px solid rgba(255,255,255,0.03)';
        row.innerHTML = `<div><div style="font-weight:800;color:#fff">${escapeHtml(o.amount)} TON — ${escapeHtml(listing.item.title || '')}</div><div style="font-size:12px;color:#9fb0c8">Лот: ${escapeHtml(o.listingId)} — От: ${escapeHtml(o.fromBuyerId||'user')}</div></div>
          <div style="display:flex;gap:8px">
            ${String(o.fromBuyerId) === String(state.profile.id) ? `<button class="btn cancel-offer" data-id="${o.id}">Отменить</button>` : ''}
            ${String(o.toSellerId) === String(state.profile.id) ? `<button class="btn accept-offer" data-id="${o.id}">Принять</button> <button class="btn reject-offer" data-id="${o.id}">Отклонить</button>` : ''}
          </div>`;
        body.appendChild(row);
      });
    }

    // handlers (refund current user's reserved offers on cancel/reject)
    body.querySelectorAll('.cancel-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const of = (state.offers || []).find(x => x.id === id);
        if (!of) return alert('Офер не найден.');
        const ok = await showConfirm('Отменить офер?');
        if (!ok) return;
        if (String(of.fromBuyerId) === String(state.profile.id) && of.reserved) {
          state.balance = Number(state.balance) + Number(of.amount || 0);
        }
        of.status = 'rejected';
        saveState();
        openOffersGlobal();
        renderInventory();
      });
    });
    body.querySelectorAll('.accept-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const offer = (state.offers || []).find(x => x.id === id);
        if (!offer) return alert('Офер не найден.');
        const listing = (state.market || []).find(m => m.id === offer.listingId);
        if (!listing) return alert('Лот не найден.');
        if (String(listing.sellerId) !== String(state.profile.id)) return alert('Только владелец лота может принимать оферы.');
        const ok = await showConfirm(`Принять офер ${offer.amount} TON?`);
        if (!ok) return;

        // seller receives funds if seller is current user
        if (String(listing.sellerId) === String(state.profile.id)) {
          state.balance = Number(state.balance) + Number(offer.amount || 0);
          addHistory('sale', offer.amount, `Продажа ${listing.item.title}`);
        }

        // buyer receives item if buyer is current user
        if (String(offer.fromBuyerId) === String(state.profile.id)) {
          const bought = { _id: listing.item._id || listing.item.title, title: listing.item.title, image: getImageForItem(listing.item) };
          state.inventory = state.inventory || [];
          state.inventory.push(bought);
          addHistory('purchase', -offer.amount, `Покупка ${listing.item.title}`);
        }

        // remove listing
        state.market = (state.market || []).filter(m => m.id !== listing.id);
        // reject other offers and refund current user's reservations if necessary
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
        openOffersGlobal();
        renderInventory();
        renderMarket();
        alert('Офер принят (симуляция).');
      });
    });
    body.querySelectorAll('.reject-offer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const of = (state.offers || []).find(x => x.id === id);
        if (!of) return alert('Офер не найден.');
        const ok = await showConfirm('Отклонить офер?');
        if (!ok) return;
        if (String(of.fromBuyerId) === String(state.profile.id) && of.reserved) {
          state.balance = Number(state.balance) + Number(of.amount || 0);
        }
        of.status = 'rejected';
        saveState();
        openOffersGlobal();
      });
    });

    offersGlobalModal.classList.remove('hidden');
  }

  // AUCTION logic with reservation/refund and restrictions
  function openAuctionCreateFlow(prefillItemId = null){
    ensureAuctionCreateModal();
    const select = auctionCreateModal.querySelector('#auction-item-select');
    select.innerHTML = '';
    const inv = state.inventory || [];
    if (!inv || inv.length === 0) {
      alert('В инвентаре нет подарков для создания аукциона.');
      return;
    }
    inv.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i._id;
      opt.textContent = i.title;
      if (prefillItemId && i._id === prefillItemId) opt.selected = true;
      select.appendChild(opt);
    });
    const startPrice = auctionCreateModal.querySelector('#auction-start-price');
    startPrice.value = String(Math.max(1, suggestPriceForItem(inv[0] || { title: '' })));
    auctionCreateModal.classList.remove('hidden');

    const ok = auctionCreateModal.querySelector('#auction-create-ok');
    const okClone = ok.cloneNode(true);
    ok.parentNode.replaceChild(okClone, ok);
    okClone.addEventListener('click', async () => {
      const selectedId = select.value;
      const idx = (state.inventory || []).findIndex(x => x._id === selectedId);
      if (idx < 0) return alert('Выберите корректный предмет.');
      const durationRadio = auctionCreateModal.querySelector('input[name="auction-dur"]:checked');
      if (!durationRadio) return alert('Выберите длительность аукциона.');
      const durMinutes = Number(durationRadio.value);
      const start = Number(startPrice.value);
      if (!isFinite(start) || start <= 0) return alert('Укажите корректную стартовую ставку.');
      const item = state.inventory.splice(idx,1)[0];
      const auction = {
        id: `A-${Date.now()}`,
        item: { _id: item._id, title: item.title, image: getImageForItem(item), description: item.description || '', aliases: item.aliases || [] },
        sellerId: state.profile && state.profile.id ? state.profile.id : 'seller_0',
        sellerNick: state.profile && state.profile.tgnick ? state.profile.tgnick : 'seller',
        startPrice: Number(start),
        currentBid: null,
        currentBidderId: null,
        bids: [],
        reserved: {}, // reserved funds per bidderId
        createdAt: Date.now(),
        endsAt: Date.now() + durMinutes * 60 * 1000
      };
      state.auctions = state.auctions || [];
      state.auctions.push(auction);
      saveState();
      auctionCreateModal.classList.add('hidden');
      renderInventory();
      openAuctionsPage();
      alert('Аукцион создан.');
    });
  }

  function renderAuctions(){
    ensureAuctionsPage();
    const list = document.getElementById('auctions-list');
    const balDisp = document.getElementById('auctions-balance-display');
    if (balDisp) balDisp.textContent = `${state.balance} TON`;
    list.innerHTML = '';
    const now = Date.now();
    const arr = (state.auctions || []).slice().sort((a,b)=>b.createdAt - a.createdAt);
    if (!arr || arr.length === 0) {
      list.innerHTML = `<div class="muted">Нет активных аукционов.</div>`;
      return;
    }
    arr.forEach(auc => {
      const card = document.createElement('div');
      card.className = 'auction-card';
      const img = getImageForItem(auc.item);
      const timeLeftMs = Math.max(0, auc.endsAt - now);
      const timeText = timeLeftMs > 0 ? formatTimeDelta(timeLeftMs) : 'Завершён';
      const current = auc.currentBid ? `${auc.currentBid} TON` : `Старт ${auc.startPrice} TON`;
      card.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          ${img ? `<img src="${img}" style="width:64px;height:64px;border-radius:10px;object-fit:cover" />` : `<div style="width:64px;height:64px;border-radius:10px;background:#071827;display:flex;align-items:center;justify-content:center">${auc.item.emoji||'🎁'}</div>`}
          <div style="flex:1">
            <div style="font-weight:800;color:#fff">${escapeHtml(auc.item.title)}</div>
            <div class="ends">Владелец: ${escapeHtml(auc.sellerNick || '')} • Окончание: <span class="auction-time" data-ends="${auc.endsAt}">${escapeHtml(timeText)}</span></div>
            <div class="current" style="margin-top:6px">${escapeHtml(current)}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn" data-id="${auc.id}" id="view-auction-${auc.id}">Открыть</button>
        </div>
      `;
      list.appendChild(card);
      card.querySelector(`#view-auction-${auc.id}`).addEventListener('click', () => openAuctionItemPage(auc.id));
    });
  }

  function formatTimeDelta(ms){
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
  }

  function openAuctionItemPage(auctionId){
    ensureAuctionItemPage();
    const auction = (state.auctions || []).find(a => a.id === auctionId);
    if (!auction) return alert('Аукцион не найден.');
    const page = document.getElementById('page-auction-item');
    const titleEl = page.querySelector('#auction-item-title');
    const body = page.querySelector('#auction-item-body');
    titleEl.textContent = auction.item.title || 'Аукцион';
    const img = getImageForItem(auction.item);
    const now = Date.now();
    const ended = now >= auction.endsAt;
    const timeLeftMs = Math.max(0, auction.endsAt - now);
    const timeText = ended ? 'Завершён' : formatTimeDelta(timeLeftMs);
    const current = auction.currentBid ? `${auction.currentBid} TON (от ${escapeHtml(auction.bids[auction.bids.length-1].bidderNick||'—')})` : `Старт ${auction.startPrice} TON`;

    body.innerHTML = `
      <div style="display:flex;gap:18px;align-items:flex-start">
        <div style="flex:0 0 340px">
          ${img ? `<img src="${img}" style="width:100%;border-radius:12px;object-fit:cover" />` : `<div style="width:100%;height:240px;border-radius:12px;background:#071827;display:flex;align-items:center;justify-content:center;font-size:48px">${auction.item.emoji||'🎁'}</div>`}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:800;color:#fff;font-size:18px">${escapeHtml(auction.item.title)}</div>
          <div style="color:#9fb0c8">ID: <span style="font-family:monospace">${escapeHtml(auction.id)}</span></div>
          <div style="color:#9fb0c8">Владелец: <strong>${escapeHtml(auction.sellerNick)}</strong></div>
          <div style="margin-top:8px"><div style="font-size:13px;color:#9fb0c8">Текущее: <strong id="auction-current-amount">${escapeHtml(current)}</strong></div><div class="muted" style="margin-top:6px">Окончание: <span class="auction-time" data-ends="${auction.endsAt}">${timeText}</span></div></div>
          <div style="margin-top:auto;display:flex;gap:10px;align-items:center">
            ${ ended ? '' : `<input id="auction-bid-amount" type="number" min="1" placeholder="Сумма в TON" style="padding:8px;border-radius:8px;background:#061018;color:#e6eef9;border:1px solid rgba(255,255,255,0.04)" /> <button id="auction-bid-btn" class="btn btn-primary">Сделать ставку</button>`}
            <button id="auction-view-bids" class="btn">Смотреть ставки</button>
          </div>
        </div>
      </div>
      <div style="margin-top:12px;color:#9fb0c8">Описание: ${escapeHtml(auction.item.description || '')}</div>
      <div id="auction-bids-list" style="margin-top:12px;max-height:180px;overflow:auto"></div>
      <div id="auction-admin-panel" style="margin-top:12px"></div>
    `;

    function renderBidsList(){
      const bidsBody = body.querySelector('#auction-bids-list');
      bidsBody.innerHTML = '';
      const bids = auction.bids || [];
      if (!bids || bids.length === 0) {
        bidsBody.innerHTML = `<div class="muted">Ставок пока нет.</div>`;
      } else {
        bids.slice().reverse().forEach(b => {
          const r = document.createElement('div');
          r.style.padding='8px'; r.style.borderBottom='1px solid rgba(255,255,255,0.03)';
          r.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${escapeHtml(b.bidderNick||b.bidderId)}</strong><div class="muted" style="font-size:12px">${new Date(b.ts).toLocaleString()}</div></div><div style="font-weight:800">${b.amount} TON</div></div>`;
          bidsBody.appendChild(r);
        });
      }
    }
    renderBidsList();

    // Bid logic: cannot bid on your own auction; one active bid; reserve funds; refund previous if you were previous highest
    const bidBtn = body.querySelector('#auction-bid-btn');
    if (bidBtn) {
      bidBtn.addEventListener('click', async () => {
        const input = body.querySelector('#auction-bid-amount');
        const raw = Number(input.value);
        if (!isFinite(raw) || raw <= 0) return alert('Укажите корректную сумму.');
        if (String(auction.sellerId) === String(state.profile.id)) return alert('Нельзя делать ставку на свой аукцион.');
        const minAllowed = auction.currentBid ? auction.currentBid + 1 : auction.startPrice;
        if (raw < minAllowed) return alert(`Ставка должна быть не меньше ${minAllowed} TON.`);
        if (String(auction.currentBidderId) === String(state.profile.id)) {
          return alert('Вы уже являетесь текущим лидером — дождитесь перебивания, чтобы сделать новую ставку.');
        }
        if ((state.balance || 0) < raw) {
          const ok = await showConfirm(`У вас ${state.balance} TON — недостаточно для ставки ${raw} TON. Открыть пополнение?`);
          if (ok) openTopupModal();
          return;
        }
        // Deduct funds (reserve) for new bidder
        state.balance = Number(state.balance) - raw;
        const prevId = auction.currentBidderId;
        if (prevId && auction.reserved && auction.reserved[prevId]) {
          if (String(prevId) === String(state.profile.id)) {
            state.balance = Number(state.balance) + Number(auction.reserved[prevId] || 0);
          }
          delete auction.reserved[prevId];
        }
        auction.reserved = auction.reserved || {};
        auction.reserved[state.profile.id] = raw;
        auction.currentBid = raw;
        auction.currentBidderId = state.profile.id;
        const bidEntry = { id: `B-${Date.now()}`, bidderId: state.profile.id, bidderNick: state.profile.tgnick, amount: raw, ts: Date.now() };
        auction.bids = auction.bids || [];
        auction.bids.push(bidEntry);
        saveState();
        renderBidsList();
        renderAuctions();
        const curEl = body.querySelector('#auction-current-amount');
        if (curEl) curEl.textContent = `${auction.currentBid} TON (от ${escapeHtml(bidEntry.bidderNick)})`;
        alert('Ставка принята — средства зарезервированы (симуляция).');
      });
    }

    body.querySelector('#auction-view-bids').addEventListener('click', () => {
      const bidsEl = body.querySelector('#auction-bids-list');
      bidsEl.scrollIntoView({ behavior: 'smooth' });
    });

    // admin panel: only seller can finalize when ended, or cancel if no bids
    const adminPanel = body.querySelector('#auction-admin-panel');
    adminPanel.innerHTML = '';
    if (String(auction.sellerId) === String(state.profile.id)) {
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

    showPage('auction-item');
  }

  // Finalize auction: winner gets item, seller gets funds; reserved funds handled
  async function finalizeAuction(auctionId, silent = true){
    const idx = (state.auctions || []).findIndex(a => a.id === auctionId);
    if (idx < 0) return;
    const auc = state.auctions[idx];
    if ((Date.now()) < auc.endsAt) {
      if (!silent) alert('Аукцион ещё идёт.');
      return;
    }
    if (auc.bids && auc.bids.length > 0) {
      const highest = auc.bids.reduce((p,c)=> c.amount > p.amount ? c : p, auc.bids[0]);
      // Credit seller if current user
      if (String(auc.sellerId) === String(state.profile.id)) {
        state.balance = Number(state.balance || 0) + Number(highest.amount || 0);
        addHistory('sale', highest.amount, `Продажа ${auc.item.title}`);
      }
      // Winner gets item if current user
      if (String(highest.bidderId) === String(state.profile.id)) {
        const bought = { _id: auc.item._id || auc.item.title, title: auc.item.title, image: getImageForItem(auc.item) };
        state.inventory = state.inventory || [];
        state.inventory.push(bought);
        addHistory('purchase', -highest.amount, `Покупка ${auc.item.title}`);
        if (auc.reserved && auc.reserved[state.profile.id]) delete auc.reserved[state.profile.id];
      } else {
        // refund reserved for current user if present and they didn't win
        if (auc.reserved && auc.reserved[state.profile.id]) {
          state.balance = Number(state.balance) + Number(auc.reserved[state.profile.id] || 0);
          delete auc.reserved[state.profile.id];
        }
      }
    } else {
      // no bids -> return to seller (if current user)
      if (String(auc.sellerId) === String(state.profile.id)) {
        const returned = { _id: auc.item._id || auc.item.title, title: auc.item.title, image: getImageForItem(auc.item) };
        state.inventory = state.inventory || [];
        state.inventory.push(returned);
      }
      // refund reserved for current user if any
      if (auc.reserved && auc.reserved[state.profile.id]) {
        state.balance = Number(state.balance) + Number(auc.reserved[state.profile.id] || 0);
        delete auc.reserved[state.profile.id];
      }
    }
    state.auctions.splice(idx,1);
    saveState();
    renderInventory();
    renderAuctions();
  }

  // MARKET UI & logic
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
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
            <input id="market-search" placeholder="Поиск..." style="flex:1;padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
            <div class="price-range">
              <input id="market-min" type="number" placeholder="min TON" style="padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
              <input id="market-max" type="number" placeholder="max TON" style="padding:8px;border-radius:8px;border:none;background:#061018;color:#e6eef9" />
            </div>
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
    const qEl = document.getElementById('market-search');
    const minEl = document.getElementById('market-min');
    const maxEl = document.getElementById('market-max');
    const query = qEl ? qEl.value.trim().toLowerCase() : '';
    const minV = minEl && Number(minEl.value) ? Number(minEl.value) : 0;
    const maxV = maxEl && Number(maxEl.value) ? Number(maxEl.value) : Number.MAX_SAFE_INTEGER;

    const listings = (state.market || []).filter(listing => {
      const title = (listing.item && (isNFTItem(listing.item) ? getDisplayTitle(listing.item) : listing.item.title) || '').toLowerCase();
      const aliases = (listing.item && Array.isArray(listing.item.aliases) ? listing.item.aliases.join(' ') : '');
      const searchable = `${title} ${aliases}`.toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
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
      el.style.padding = '12px';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';
      el.dataset.listingId = listing.id;

      const imgSrc = getImageForItem(listing.item);
      const previewHtml = imgSrc ? `<img class="preview" src="${imgSrc}" alt="${escapeHtml(listing.item.title)}" />` : `<div style="width:64px;height:64px;border-radius:10px;background:#071827;display:flex;align-items:center;justify-content:center;font-size:28px">${listing.item.emoji || '🎁'}</div>`;
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
        // prevent buying your own listing
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
        // record purchase
        addHistory('purchase', -listing.price, `Purchased ${listing.item.title} from market`);
        // if seller is current user, register sale and credit
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
      <div style="display:flex;gap:18px;align-items:flex-start">
        <div style="flex:0 0 340px">
          ${img ? `<img src="${img}" style="width:100%;border-radius:12px;object-fit:cover" />` : `<div style="width:100%;height:240px;border-radius:12px;background:#071827;display:flex;align-items:center;justify-content:center;font-size:48px">${listing.item.emoji||'🎁'}</div>`}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:800;color:#fff;font-size:18px">${escapeHtml(getDisplayTitle(listing.item) || listing.item.title)}</div>
          <div style="color:#9fb0c8">ID: <span style="font-family:monospace">${escapeHtml(listing.id)}</span></div>
          <div style="color:#9fb0c8">Seller: <strong>${escapeHtml(listing.seller || '—')}</strong></div>
          <div style="margin-top:8px">
            <div style="font-size:13px;color:#9fb0c8">Approx price (market average for similar): <strong>${suggestPriceForItem(listing.item, listing.id)} TON</strong></div>
            <div style="margin-top:8px;font-size:22px;font-weight:900;color:#bfe8ff">${listing.price} TON</div>
          </div>
          <div style="margin-top:auto;display:flex;gap:10px">
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
      const okc = await showConfirm(`Купить "${listing.item.title}" за ${listing.price} TON? Это окончательное подтверждение.`);
      if (!okc) return;
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

  // Listing offers modal: pending only; cannot send offer on your own listing
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
    body.innerHTML = `<div style="display:flex;align-items:center;gap:10px">${img?`<img src="${img}" style="width:56px;height:56px;border-radius:10px;object-fit:cover" />`:''}<div><div style="font-weight:800;color:#fff">${escapeHtml(getDisplayTitle(listing.item) || listing.item.title)}</div><div style="font-size:13px;color:#9fb0c8">ID: ${escapeHtml(listing.id)}</div></div></div>`;
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
      // prevent offering on your own listing
      if (String(listing.sellerId) === String(state.profile.id)) return alert('Нельзя отправлять офер на собственный лот.');
      const raw = amountInput.value;
      const amount = Number(raw);
      if (!isFinite(amount) || amount <= 0) return alert('Некорректная сумма.');
      const existing = (state.offers || []).find(o => o.listingId === listing.id && String(o.fromBuyerId) === String(state.profile.id) && o.status === 'pending');
      if (existing) return alert('Вы уже отправляли офер на этот лот — дождитесь ответа или отмените предыдущий офер.');
      if ((state.balance || 0) < amount) return alert('Недостаточно TON для резерва офера.');
      // Deduct and reserve funds for current user
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
        row.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div style="width:44px;height:44px">${img?`<img src="${img}" style="width:44px;height:44px;border-radius:8px;object-fit:cover" />`:`<div style="width:44px;height:44px;border-radius:8px;background:#071827;display:flex;align-items:center;justify-content:center">${item.emoji||'🎁'}</div>`}</div><div><div style="font-weight:700">${escapeHtml(item.title)}</div></div></div><div><input type="checkbox" class="withdraw-check" data-id="${item._id}" /></div>`;
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
    // keep nav buttons at bottom only
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
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

    // auto-finalize auctions that ended (silent)
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

    // refresh auction-item page dynamic parts
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

  // --- NEW: add random NFTs to user's profile (only once) ---
  function addRandomNFTsToProfile(count = 4) {
    state.inventory = state.inventory || [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * RANDOM_NFT_MODELS.length);
      const model = RANDOM_NFT_MODELS[idx];
      // ensure unique id
      const newItem = {
        _id: `${model._id}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        title: model.title,
        image: model.image,
        aliases: model.aliases || []
      };
      state.inventory.push(newItem);
    }
    state._nftsSeeded = true;
    saveState();
  }
  // --------------------------------------------------------

  // Boot sequence
  function boot(){
    loadState();
    populateSampleGiftsIfEmpty();

    // NEW: seed random NFTs into profile only once (user requested)
    if (!state._nftsSeeded) {
      try {
        addRandomNFTsToProfile(4); // add 4 random NFTs
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

    // wire "Выставленные подарки" if present
    const profileMarketBtn = document.getElementById('profile-market-btn');
    if (profileMarketBtn) {
      profileMarketBtn.onclick = null;
      profileMarketBtn.addEventListener('click', () => openMyListingsModal());
    }

    // nav handlers remain on bottom nav items
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
