(() => {
  const STORAGE_KEY = 'miniapp_v4_4_state';
  // default state (added lastFreeSpin and profile.subscribed)
  let state = {
    balance: 999999,
    inventory: [],
    history: [],
    spins: [],
    profile: { name: 'Пользователь', tgnick: '@yourtg', id: '000000', subscribed: false },
    lastFreeSpin: 0
  };

  const roulettes = {
    r1: { id:'r1', prize:25, spinCost:13, sticker:{id:'gift', emoji:'🎁', title:'Подарок', price:400} },
    r2: { id:'r2', prize:50, spinCost:25, sticker:{id:'champ', emoji:'🍾', title:'Шампанское', price:50} },
    r3: { id:'r3', prize:100, spinCost:50, sticker:{id:'ring', emoji:'💍', title:'Кольцо', price:100} },
    rnft: { id:'rnft', prize:'NFT', spinCost:200, sticker:{id:'lollipop', emoji:'🍭', title:'Леденец (NFT)', price:200} }
  };

  // DOM
  const pages = {
    main: document.getElementById('page-main'),
    roulette: document.getElementById('page-roulette'),
    profile: document.getElementById('page-profile'),
    history: document.getElementById('page-history')
  };
  const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
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
  // buttons inside win popup exist in markup: #win-keep and #win-spin

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

  // init
  loadState();
  renderProfile();
  renderHistory();
  // стартовая страница: рулетка (удалена секция "Задания" из HTML)
  showPage('roulette');
  if (modal) modal.classList.add('hidden');
  if (canvas) canvas.style.transform = 'rotate(0deg)';

  navBtns.forEach(b => b.addEventListener('click', ()=> showPage(b.dataset.page)));
  if (goRoulette) goRoulette.addEventListener('click', ()=> showPage('roulette'));

  // speed
  speedButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      spinMode = btn.dataset.speed;
    });
  });

  // Top-up handlers (unchanged)
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
        topupMsg.textContent = `Выбрано: ${selectedTopup} ⭐`;
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

  // send single 15⭐ quick action
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

  // Subscribe toggle (simulation)
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
        row.style.borderBottom = '1px solid #f0f6ff';
        row.innerHTML = `<input type="checkbox" data-id="${it._id}"> <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center">${it.emoji}</div>
          <div style="flex:1"><div style="font-weight:700">${it.title}</div><div style="font-size:12px;color:#6f8fa0">Цена: ${it.price} ⭐</div></div>`;
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
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.page === name));
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
        const emoji = document.createElement('div'); emoji.className = 'sticker-emoji'; emoji.textContent = item.emoji || '🎁';
        card.appendChild(emoji);
        const label = document.createElement('div'); label.className = 'label'; label.textContent = item.title || '';
        const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = `Цена: ${item.price} ⭐`;
        const sell = document.createElement('button'); sell.className = 'sell-btn'; sell.textContent = `Продать за ${item.price} ⭐`;
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
        card.appendChild(label);
        card.appendChild(sub);
        card.appendChild(sell);
        invGrid.appendChild(card);
      });
    }
    saveState();
    // update subscribe/free spin UI after render
    updateSubscribeUI();
    updateFreeSpinStatus();
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
      // add selected class visually
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

  // speed config to mapping: duration & easing
  const speedConfig = {
    fast: { duration: 1200, easing: easeOutCubic },
    medium: { duration: 2400, easing: easeOutQuart },
    slow: { duration: 3800, easing: easeOutQuint }
  };

  // new smooth spin using animateRotation (original)
  async function spinToHalfAnimation(forceWin = null){
    const cfg = speedConfig[spinMode] || speedConfig.medium;
    const r = roulettes[currentType];
    // record spend
    addHistory('spend', -r.spinCost, `Spin ${currentType}`);
    const winWhite = (typeof forceWin === 'boolean') ? forceWin : (Math.random() < 0.5);
    const turns = 6 + Math.floor(Math.random()*6); // more turns for spectacle
    const base = turns * 360;
    const target = winWhite ? 0 : 180;
    const jitter = (Math.random()*18)-9;
    const finalAngle = base + target + jitter;

    // save spin record
    addSpinRecord({ rouletteId: currentType, speed: spinMode, cost: r.spinCost, outcome: winWhite ? 'white' : 'black', prize: r.prize });

    // cancel any CSS transition, use our animator
    if (canvas) canvas.style.transition = 'none';
    animCancel = false;
    const ok = await animateRotation(finalAngle, cfg.duration, cfg.easing);

    // small bounce: animate a tiny back-and-forth for realism
    if (ok) {
      await animateRotation(finalAngle - (Math.random()*8 + 4), 180, easeOutCubic);
      await animateRotation(finalAngle, 160, easeOutCubic);
    } else {
      if (canvas) canvas.style.transform = `rotate(${finalAngle}deg)`;
    }
    return winWhite ? 'white' : 'black';
  }

  // spin free with defined odds (does NOT charge)
  async function spinFreeWithOdds(type){
    // animate similarly but do not charge
    const cfg = speedConfig[spinMode] || speedConfig.medium;
    const turns = 5 + Math.floor(Math.random()*6);
    const base = turns * 360;
    // determine prize using odds
    const prize = sampleFreePrize(); // 'nothing'|'stars'|'nft'
    const target = (prize === 'nothing') ? 180 : 0; // win -> white, nothing -> black
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

  // click to spin: canvas click triggers same as button
  if (canvas) {
    canvas.addEventListener('click', ()=> {
      const type = spinAction && spinAction.dataset.type;
      if (type && spinAction) spinAction.click();
    });
  }

  // original paid spin handler
  if (spinAction) {
    spinAction.addEventListener('click', async () => {
      const type = spinAction.dataset.type;
      const r = roulettes[type];
      if (!r) return;
      spinAction.disabled = true;
      if (modalResult) modalResult.textContent = '';
      hideWinPopup();

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
      if (userChoice === 'open_inventory') {
        hideWinPopup();
        showPage('profile');
      } else {
        hideWinPopup();
        await delay(220);
        await resetToZero();
      }
    } else {
      if (modalResult) {
        modalResult.textContent = 'Увы — ничего не выиграли.';
        modalResult.className = 'modal-result fail';
      }
      await delay(900);
      await resetToZero();
    }
  }

  // handler for free spin result (odds: nothing/stars/nft)
  async function handleFreeSpinResult(type, outcome){
    if (outcome === 'nft') {
      // award NFT lollipop
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
      if (userChoice === 'open_inventory') {
        hideWinPopup();
        showPage('profile');
      } else {
        hideWinPopup();
        await delay(220);
        await resetToZero();
      }
    } else if (outcome === 'stars') {
      const amount = 25;
      state.balance = (state.balance || 0) + amount;
      addHistory('win', amount, `Free spin win ${amount} ⭐`);
      saveState();
      renderProfile();
      if (modalResult) { modalResult.textContent = `Поздравляем! Вы выиграли ${amount} ⭐`; modalResult.className = 'modal-result success'; }
      spawnConfetti();
      await delay(900);
      await resetToZero();
    } else {
      if (modalResult) { modalResult.textContent = 'Увы — ничего не выиграли.'; modalResult.className = 'modal-result fail'; }
      await delay(900);
      await resetToZero();
    }
  }

  // free spin button logic
  if (freeSpinBtn) {
    freeSpinBtn.addEventListener('click', async () => {
      // must be subscribed
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
        // not ready
        updateFreeSpinStatus();
        return;
      }
      // use free spin
      state.lastFreeSpin = Date.now();
      saveState();
      updateFreeSpinStatus();
      // pick roulette to spin: current selected or default r1
      const type = currentType || 'r1';
      openModal(type);
      if (modalResult) modalResult.textContent = '';
      hideWinPopup();
      drawStaticWheel(roulettes[type]);
      // animate free spin with odds
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
      freeSpinStatus.textContent = `Доступно через ${hrs}ч ${mins}м ${secs}с`;
      freeSpinBtn.disabled = true;
    }
  }

  // show/hide win popup, and wait for clicks (fixed handlers)
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
    // smooth reset using animator
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
    const colors = ['#ff6b6b','#ffd93d','#6be4ff','#8affc1','#a38bff','#ff9ec0','#9be6ff','#60b7ff'];
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
      // backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'confirm-modal-backdrop';
      // modal
      const box = document.createElement('div');
      box.className = 'confirm-modal';
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.textContent = message;
      const buttons = document.createElement('div');
      buttons.className = 'buttons';
      const yes = document.createElement('button');
      yes.className = 'btn btn-primary';
      yes.textContent = 'Да';
      const no = document.createElement('button');
      no.className = 'btn';
      no.textContent = 'Нет';
      buttons.appendChild(yes);
      buttons.appendChild(no);
      box.appendChild(msg);
      box.appendChild(buttons);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      // focus
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

  // ensure modal hidden on load
  window.addEventListener('load', () => { if (modal) modal.classList.add('hidden'); updateFreeSpinStatus(); });

  // persist
  setInterval(saveState, 2500);

})();
