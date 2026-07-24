const balanceValue = document.getElementById("balance-value");
const tanksViewport = document.getElementById("tanks-viewport");
const tanksTrack = document.getElementById("tanks-track");
const tankNavPrev = document.getElementById("tank-nav-prev");
const tankNavNext = document.getElementById("tank-nav-next");

// --- マスタデータ(F08/F11。data/master.json から読み込む。9章) ---
// 経済バランスの調整は data/master.json の編集のみで行える。

let itemMaster = []; // 商品マスタ(魚・装飾)
let tankMaster = []; // 水槽マスタ
let gameConfig = {
  offlineCapHours: 8,
  feedBuffMultiplier: 1.5,
  feedBuffDurationSec: 600,
  feedCooldownSec: 1800,
  maxFishLevel: 5,
  levelIntervalStepPct: 0.12,
  minFishIntervalSec: 2,
  levelUpCostMultipliers: [0.4, 0.7, 1.1, 1.6],
}; // バランス設定(master.jsonで上書き)

function findItem(itemId) {
  return itemMaster.find((i) => i.id === itemId);
}

// --- 魚のレベル(1〜maxFishLevel)。レベルアップで生成間隔が短縮する(生成量は不変)。 ---

function effectiveIntervalSec(item, level) {
  const multiplier = 1 - gameConfig.levelIntervalStepPct * (level - 1);
  return Math.max(gameConfig.minFishIntervalSec, Math.floor(item.intervalSec * multiplier));
}

// レベルアップ費用。currentLevel が最大レベルの場合は null(これ以上上げられない)
function levelUpCost(item, currentLevel) {
  const multipliers = gameConfig.levelUpCostMultipliers;
  const idx = currentLevel - 1;
  if (currentLevel >= gameConfig.maxFishLevel || idx >= multipliers.length) return null;
  return Math.round(item.price * multipliers[idx]);
}

function findTank(tankId) {
  return tankMaster.find((t) => t.id === tankId);
}

const DEFAULT_TANK_ID = "tank_basic";

// --- 水槽の状態(F11)。所持している水槽はすべて常時稼働し、
//     コイン生成・演出は表示の有無に関わらず継続する。 ---

let ownedTankIds = [DEFAULT_TANK_ID];
const tankRuntime = {}; // { [tankId]: { cardEl, tankEl, bubbleLayerEl, coinFish: [], placedDecorations: [] } }

function createTankCard(tankDef) {
  const card = document.createElement("div");
  card.className = "tank-card";
  card.dataset.tankId = tankDef.id;

  const label = document.createElement("div");
  label.className = "tank-card-label";
  label.textContent = tankDef.name;
  card.appendChild(label);

  const tankEl = document.createElement("div");
  tankEl.className = `tank ${tankDef.bgClass}`;

  const bubbleLayerEl = document.createElement("div");
  bubbleLayerEl.className = "bubble-layer";
  tankEl.appendChild(bubbleLayerEl);

  card.appendChild(tankEl);
  tanksTrack.appendChild(card);

  tankRuntime[tankDef.id] = {
    cardEl: card,
    tankEl,
    bubbleLayerEl,
    coinFish: [],
    placedDecorations: [],
  };

  tankEl.addEventListener("click", (event) => onTankClick(tankDef.id, event));

  return tankRuntime[tankDef.id];
}

function setupFishVisual(el, item, topPercentOverride) {
  const swimDuration = 9 + Math.random() * 6; // 9〜15秒
  const swayDuration = 2 + Math.random() * 1.5; // 2〜3.5秒
  const topPercent =
    topPercentOverride !== undefined ? topPercentOverride : 10 + Math.random() * 70; // 上下端に寄りすぎないようにする

  el.style.animationDuration = `${swimDuration}s`;
  el.style.top = `${topPercent}%`;

  const shape = el.querySelector(".fish-shape");
  shape.style.animationDuration = `${swayDuration}s`;
  shape.style.backgroundImage = `url(${item.image})`;
}

function addFishToTank(tankId, item, topPercentOverride, levelOverride = 1) {
  const rt = tankRuntime[tankId];
  const el = document.createElement("div");
  el.className = "fish tank-item";
  el.dataset.itemId = item.id;

  const shape = document.createElement("div");
  shape.className = "fish-shape";
  el.appendChild(shape);

  rt.tankEl.appendChild(el);
  setupFishVisual(el, item, topPercentOverride);

  rt.coinFish.push({
    element: el,
    itemId: item.id,
    level: levelOverride,
    lastCoinTime: performance.now(),
  });
}

function addDecorationToTank(tankId, item, leftPercentOverride, bottomPercentOverride) {
  const rt = tankRuntime[tankId];
  const el = document.createElement("div");
  el.className = "decoration tank-item";
  el.dataset.itemId = item.id;
  el.style.backgroundImage = `url(${item.image})`;

  const leftPercent = leftPercentOverride !== undefined ? leftPercentOverride : 5 + Math.random() * 85;
  const bottomPercent = bottomPercentOverride !== undefined ? bottomPercentOverride : 2 + Math.random() * 5;
  el.style.left = `${leftPercent}%`;
  el.style.bottom = `${bottomPercent}%`;

  if (item.sway) {
    el.classList.add("seaweed-sway");
    el.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    el.style.animationDelay = `-${Math.random() * 3}s`;
  }

  rt.tankEl.appendChild(el);
  rt.placedDecorations.push({ element: el, bubbleSource: Boolean(item.bubbleSource) });
}

let coins = 0;

function addCoins(amount) {
  coins += amount;
  balanceValue.textContent = coins;
  updateShopButtons();
  if (!fishActionPanel.hidden) renderActionPanel();
  saveState();
}

function spawnCoinPopup(tankEl, sourceEl, amount) {
  const tankRect = tankEl.getBoundingClientRect();
  const fishRect = sourceEl.getBoundingClientRect();

  const popup = document.createElement("div");
  popup.className = "coin-popup";
  popup.textContent = `+${amount}`;
  popup.style.left = `${fishRect.left - tankRect.left + fishRect.width / 2}px`;
  popup.style.top = `${fishRect.top - tankRect.top}px`;

  tankEl.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
}

// 全ての所持水槽から、表示の有無に関わらず自動でコインを回収する(F06/F07)
function tick(now) {
  Object.values(tankRuntime).forEach((rt) => {
    rt.coinFish.forEach((f) => {
      const item = findItem(f.itemId);
      const intervalMs = effectiveIntervalSec(item, f.level) * 1000;
      const elapsed = now - f.lastCoinTime;

      if (elapsed >= intervalMs) {
        const times = Math.floor(elapsed / intervalMs);
        const gained = Math.floor(times * item.amount * currentMultiplier());
        addCoins(gained);
        spawnCoinPopup(rt.tankEl, f.element, gained);
        Sound.coin();
        f.lastCoinTime += times * intervalMs;
      }
    });
  });

  requestAnimationFrame(tick);
}

// --- 水槽の表示切替(PC: 同時表示 / スマホ: 矢印+スワイプで1つずつ) ---

let currentTankIndex = 0;

function isMobileLayout() {
  return window.matchMedia("(max-width: 700px)").matches;
}

function updateCarousel() {
  if (!isMobileLayout()) {
    tanksTrack.style.transform = "";
    return;
  }
  currentTankIndex = Math.max(0, Math.min(currentTankIndex, ownedTankIds.length - 1));
  tanksTrack.style.transform = `translateX(-${currentTankIndex * 100}%)`;
}

tankNavPrev.addEventListener("click", () => {
  currentTankIndex = Math.max(0, currentTankIndex - 1);
  updateCarousel();
});

tankNavNext.addEventListener("click", () => {
  currentTankIndex = Math.min(ownedTankIds.length - 1, currentTankIndex + 1);
  updateCarousel();
});

let touchStartX = null;

tanksViewport.addEventListener("touchstart", (event) => {
  touchStartX = event.touches[0].clientX;
});

tanksViewport.addEventListener("touchend", (event) => {
  if (touchStartX === null || !isMobileLayout()) {
    touchStartX = null;
    return;
  }
  const dx = event.changedTouches[0].clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(dx) < 40) return;

  if (dx < 0) currentTankIndex = Math.min(ownedTankIds.length - 1, currentTankIndex + 1);
  else currentTankIndex = Math.max(0, currentTankIndex - 1);
  updateCarousel();
});

window.addEventListener("resize", updateCarousel);

// --- ショップ(F08 S02) ---

let inventory = []; // [{ itemTypeId, count }]

const getPopup = document.getElementById("get-popup");
const getPopupImage = document.getElementById("get-popup-image");
const getPopupText = document.getElementById("get-popup-text");
let getPopupTimer = null;

// 購入操作の視覚フィードバック(押せているか分かりづらい対策)
function showGetPopup(item) {
  getPopupImage.src = item.image;
  getPopupImage.alt = item.name;
  getPopupText.textContent = `${item.name}GET!`;

  getPopup.hidden = false;
  getPopup.style.animation = "none";
  // 連続購入時にアニメーションを再生し直すためリフロー
  void getPopup.offsetWidth;
  getPopup.style.animation = "";

  clearTimeout(getPopupTimer);
  getPopupTimer = setTimeout(() => {
    getPopup.hidden = true;
  }, 1400);
}

const openShopBtn = document.getElementById("open-shop");
const closeShopBtn = document.getElementById("close-shop");
const shopModal = document.getElementById("shop-modal");
const shopList = document.getElementById("shop-list");

function renderShop() {
  shopList.innerHTML = "";

  itemMaster.forEach((item) => {
    const li = document.createElement("li");
    li.className = "shop-item";
    const desc =
      item.category === "fish"
        ? `${item.intervalSec}秒ごとに${item.amount}コイン生成`
        : "水槽の装飾品(コイン生成なし)";
    li.innerHTML = `
      <img class="shop-item-swatch" src="${item.image}" alt="${item.name}" />
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}(${item.rarity})</div>
        <div class="shop-item-desc">${desc}</div>
      </div>
      <button data-item-id="${item.id}">🪙${item.price}</button>
    `;
    shopList.appendChild(li);
  });

  tankMaster
    .filter((t) => t.price > 0)
    .forEach((t) => {
      const li = document.createElement("li");
      li.className = "shop-item";
      li.innerHTML = `
        <div class="shop-item-swatch ${t.bgClass}"></div>
        <div class="shop-item-info">
          <div class="shop-item-name">${t.name}(水槽)</div>
          <div class="shop-item-desc">魚${t.fishMax}匹・装飾${t.decoMax}個まで配置可</div>
        </div>
        <button data-tank-id="${t.id}">🪙${t.price}</button>
      `;
      shopList.appendChild(li);
    });

  updateShopButtons();
}

function updateShopButtons() {
  shopList.querySelectorAll("button[data-item-id]").forEach((btn) => {
    const item = itemMaster.find((i) => i.id === btn.dataset.itemId);
    btn.disabled = coins < item.price;
  });
  shopList.querySelectorAll("button[data-tank-id]").forEach((btn) => {
    const tankDef = findTank(btn.dataset.tankId);
    const owned = ownedTankIds.includes(tankDef.id);
    btn.disabled = owned || coins < tankDef.price;
    btn.textContent = owned ? "所持済み" : `🪙${tankDef.price}`;
  });
}

function purchaseTank(tankId) {
  const tankDef = findTank(tankId);
  if (!tankDef || ownedTankIds.includes(tankId) || coins < tankDef.price) return;

  coins -= tankDef.price;
  balanceValue.textContent = coins;
  ownedTankIds.push(tankId);
  createTankCard(tankDef);
  updateCarousel();

  updateShopButtons();
  renderInventory();
  saveState();
  Sound.purchase();
}

function purchaseItem(itemId) {
  const item = itemMaster.find((i) => i.id === itemId);
  if (!item || coins < item.price) return;

  coins -= item.price;
  balanceValue.textContent = coins;

  const existing = inventory.find((i) => i.itemTypeId === itemId);
  if (existing) {
    existing.count += 1;
  } else {
    inventory.push({ itemTypeId: itemId, count: 1 });
  }

  updateShopButtons();
  renderInventory();
  saveState();
  Sound.purchase();
  showGetPopup(item);
}

shopList.addEventListener("click", (event) => {
  const itemBtn = event.target.closest("button[data-item-id]");
  if (itemBtn) {
    purchaseItem(itemBtn.dataset.itemId);
    return;
  }
  const tankBtn = event.target.closest("button[data-tank-id]");
  if (tankBtn) purchaseTank(tankBtn.dataset.tankId);
});

openShopBtn.addEventListener("click", () => {
  shopModal.hidden = false;
  updateShopButtons();
});

closeShopBtn.addEventListener("click", () => {
  shopModal.hidden = true;
});

// --- インベントリ+配置(F09 S03、F02) ---
// 水槽をクリックするとその水槽を配置先にしてインベントリが開く。
// 下部ナビから開いた場合はプルダウンで配置先の水槽を選べる。

const openInventoryBtn = document.getElementById("open-inventory");
const closeInventoryBtn = document.getElementById("close-inventory");
const inventoryModal = document.getElementById("inventory-modal");
const inventoryList = document.getElementById("inventory-list");
const inventoryTankSelect = document.getElementById("inventory-tank-select");
const fishCountInfo = document.getElementById("fish-count-info");

let inventoryTargetTankId = null;

function populateInventoryTankSelect() {
  inventoryTankSelect.innerHTML = "";
  ownedTankIds.forEach((tankId) => {
    const opt = document.createElement("option");
    opt.value = tankId;
    opt.textContent = findTank(tankId).name;
    inventoryTankSelect.appendChild(opt);
  });
  inventoryTankSelect.value = inventoryTargetTankId;
}

function openInventoryFor(tankId) {
  inventoryTargetTankId = ownedTankIds.includes(tankId) ? tankId : ownedTankIds[0];
  populateInventoryTankSelect();
  inventoryModal.hidden = false;
  renderInventory();
}

inventoryTankSelect.addEventListener("change", () => {
  inventoryTargetTankId = inventoryTankSelect.value;
  renderInventory();
});

function renderInventory() {
  const targetId = inventoryTargetTankId || ownedTankIds[0];
  const rt = tankRuntime[targetId];
  const tankDef = findTank(targetId);

  fishCountInfo.textContent = `[${tankDef.name}] 配置中の魚: ${rt.coinFish.length} / ${tankDef.fishMax}　配置中の装飾: ${rt.placedDecorations.length} / ${tankDef.decoMax}`;
  inventoryList.innerHTML = "";

  if (inventory.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = "所持しているアイテムはありません。ショップで購入してください。";
    inventoryList.appendChild(li);
    return;
  }

  inventory.forEach(({ itemTypeId, count }) => {
    const item = findItem(itemTypeId);
    const isFull =
      item.category === "fish"
        ? rt.coinFish.length >= tankDef.fishMax
        : rt.placedDecorations.length >= tankDef.decoMax;
    const desc =
      item.category === "fish"
        ? `${item.intervalSec}秒ごとに${item.amount}コイン生成`
        : "水槽の装飾品(コイン生成なし)";
    const li = document.createElement("li");
    li.className = "shop-item";
    li.innerHTML = `
      <img class="shop-item-swatch" src="${item.image}" alt="${item.name}" />
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name} × ${count}</div>
        <div class="shop-item-desc">${desc}</div>
      </div>
      <button data-item-id="${item.id}" ${isFull ? "disabled" : ""}>配置する</button>
    `;
    inventoryList.appendChild(li);
  });
}

function placeFish(itemId) {
  const targetId = inventoryTargetTankId || ownedTankIds[0];
  const rt = tankRuntime[targetId];
  const tankDef = findTank(targetId);
  if (rt.coinFish.length >= tankDef.fishMax) return;

  const entry = inventory.find((i) => i.itemTypeId === itemId);
  if (!entry || entry.count <= 0) return;

  entry.count -= 1;
  if (entry.count === 0) {
    inventory = inventory.filter((i) => i.itemTypeId !== itemId);
  }

  addFishToTank(targetId, findItem(itemId));
  renderInventory();
  saveState();
  Sound.place();
}

function placeDecoration(itemId) {
  const targetId = inventoryTargetTankId || ownedTankIds[0];
  const rt = tankRuntime[targetId];
  const tankDef = findTank(targetId);
  if (rt.placedDecorations.length >= tankDef.decoMax) return;

  const entry = inventory.find((i) => i.itemTypeId === itemId);
  if (!entry || entry.count <= 0) return;

  entry.count -= 1;
  if (entry.count === 0) {
    inventory = inventory.filter((i) => i.itemTypeId !== itemId);
  }

  addDecorationToTank(targetId, findItem(itemId));
  renderInventory();
  saveState();
  Sound.place();
}

inventoryList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-item-id]");
  if (!btn) return;

  const item = findItem(btn.dataset.itemId);
  if (item.category === "fish") {
    placeFish(item.id);
  } else {
    placeDecoration(item.id);
  }
});

openInventoryBtn.addEventListener("click", () => {
  openInventoryFor(inventoryTargetTankId || ownedTankIds[0]);
});

closeInventoryBtn.addEventListener("click", () => {
  inventoryModal.hidden = true;
});

// --- 配置済みアイテムの選択・移動・撤去(F03) ---

const fishActionPanel = document.getElementById("fish-action-panel");
const fishActionName = document.getElementById("fish-action-name");
const fishActionLevel = document.getElementById("fish-action-level");
const fishActionHint = document.getElementById("fish-action-hint");
const fishActionLevelupBtn = document.getElementById("fish-action-levelup");
const fishActionRemoveBtn = document.getElementById("fish-action-remove");
const fishActionCancelBtn = document.getElementById("fish-action-cancel");

let selectedItemEl = null;
let selectedItemTankId = null;

function findCoinFishEntry(tankId, el) {
  return tankRuntime[tankId].coinFish.find((f) => f.element === el);
}

// 選択中アイテムの情報(レベル・レベルアップ費用など)をパネルに反映する
function renderActionPanel() {
  if (!selectedItemEl) return;

  const item = findItem(selectedItemEl.dataset.itemId);
  fishActionName.textContent = `選択中: ${item.name}`;

  if (item.category === "fish") {
    const entry = findCoinFishEntry(selectedItemTankId, selectedItemEl);
    const interval = effectiveIntervalSec(item, entry.level);
    fishActionLevel.hidden = false;
    fishActionLevel.textContent = `Lv.${entry.level} / ${gameConfig.maxFishLevel}(${interval}秒ごとに${item.amount}コイン)`;

    const cost = levelUpCost(item, entry.level);
    if (cost === null) {
      fishActionLevelupBtn.hidden = true;
    } else {
      fishActionLevelupBtn.hidden = false;
      fishActionLevelupBtn.innerHTML = `
        <span class="levelup-target">レベル${entry.level + 1}</span>
        <span class="levelup-price">🪙${cost}</span>
      `;
      fishActionLevelupBtn.disabled = coins < cost;
    }
    fishActionHint.textContent = "水槽内をクリックして位置を移動";
  } else {
    fishActionLevel.hidden = true;
    fishActionLevelupBtn.hidden = true;
    fishActionHint.textContent = "海藻・岩は移動できません(撤去のみ)";
  }
}

function selectItem(el, tankId) {
  if (selectedItemEl === el) {
    deselectItem();
    return;
  }
  deselectItem();
  selectedItemEl = el;
  selectedItemTankId = tankId;
  el.classList.add("selected");

  renderActionPanel();
  fishActionPanel.hidden = false;
}

function deselectItem() {
  if (selectedItemEl) selectedItemEl.classList.remove("selected");
  selectedItemEl = null;
  selectedItemTankId = null;
  fishActionPanel.hidden = true;
}

function levelUpSelectedFish() {
  if (!selectedItemEl || !selectedItemTankId) return;

  const entry = findCoinFishEntry(selectedItemTankId, selectedItemEl);
  const item = findItem(entry.itemId);
  const cost = levelUpCost(item, entry.level);
  if (cost === null || coins < cost) return;

  coins -= cost;
  balanceValue.textContent = coins;
  entry.level += 1;

  updateShopButtons();
  renderActionPanel();
  saveState();
  Sound.purchase();
}

function removeItemFromTank(el, tankId) {
  const itemId = el.dataset.itemId;
  const item = findItem(itemId);
  const rt = tankRuntime[tankId];

  if (item.category === "fish") {
    const idx = rt.coinFish.findIndex((f) => f.element === el);
    if (idx !== -1) rt.coinFish.splice(idx, 1);
  } else {
    const idx = rt.placedDecorations.findIndex((d) => d.element === el);
    if (idx !== -1) rt.placedDecorations.splice(idx, 1);
  }
  el.remove();

  const existing = inventory.find((i) => i.itemTypeId === itemId);
  if (existing) {
    existing.count += 1;
  } else {
    inventory.push({ itemTypeId: itemId, count: 1 });
  }

  renderInventory();
  saveState();
}

// 水槽クリック時の分岐: アイテムクリック→選択 / 選択中に同じ水槽の背景クリック→移動
// / 別水槽の背景クリック→選択解除 / 未選択で背景クリック→その水槽を配置先にインベントリを開く
function onTankClick(tankId, event) {
  const itemEl = event.target.closest(".tank-item");
  if (itemEl) {
    selectItem(itemEl, tankId);
    return;
  }

  const rt = tankRuntime[tankId];
  const clickedBackground = event.target === rt.tankEl;

  if (selectedItemEl) {
    if (selectedItemTankId === tankId && clickedBackground) {
      const item = findItem(selectedItemEl.dataset.itemId);
      if (item.category === "fish") {
        const rect = rt.tankEl.getBoundingClientRect();
        const relY = (event.clientY - rect.top) / rect.height;
        const topPercent = Math.min(85, Math.max(5, relY * 100));
        selectedItemEl.style.top = `${topPercent}%`;
        saveState();
      }
    }
    deselectItem();
    return;
  }

  if (clickedBackground) openInventoryFor(tankId);
}

fishActionRemoveBtn.addEventListener("click", () => {
  if (!selectedItemEl) return;
  removeItemFromTank(selectedItemEl, selectedItemTankId);
  deselectItem();
});

fishActionCancelBtn.addEventListener("click", deselectItem);
fishActionLevelupBtn.addEventListener("click", levelUpSelectedFish);

// --- 設定(S04。サウンドON/OFF) ---

const openSettingsBtn = document.getElementById("open-settings");
const closeSettingsBtn = document.getElementById("close-settings");
const settingsModal = document.getElementById("settings-modal");
const toggleBgm = document.getElementById("toggle-bgm");
const toggleSfx = document.getElementById("toggle-sfx");

function syncSoundToggles() {
  const s = Sound.getSettings();
  toggleBgm.checked = s.bgm;
  toggleSfx.checked = s.sfx;
}

openSettingsBtn.addEventListener("click", () => {
  syncSoundToggles();
  settingsModal.hidden = false;
});

closeSettingsBtn.addEventListener("click", () => {
  settingsModal.hidden = true;
});

toggleBgm.addEventListener("change", () => Sound.setBgm(toggleBgm.checked));
toggleSfx.addEventListener("change", () => Sound.setSfx(toggleSfx.checked));

Sound.unlockOnFirstGesture();

// --- おかえりダイアログ(F13) ---

const welcomeModal = document.getElementById("welcome-modal");
const welcomeText = document.getElementById("welcome-text");
const welcomeOkBtn = document.getElementById("welcome-ok");

function showWelcomeBack(earned) {
  welcomeText.textContent = `${earned.toLocaleString()} コイン貯まりました!`;
  welcomeModal.hidden = false;
}

welcomeOkBtn.addEventListener("click", () => {
  welcomeModal.hidden = true;
  Sound.ui();
});

// --- モーダル: 背景(オーバーレイ)クリックで閉じる ---

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.hidden = true;
  });
});

// --- 餌やり(F14。2.3。バフ型・ペナルティなし。クールタイム制) ---
// バフ・クールタイムはメモリ保持のみ(リロードでリセット)。オフライン中はバフ非適用。
// バフは全水槽のコイン生成に効くため、餌やりの演出も所持している全水槽に表示する。

const feedBtn = document.getElementById("feed-btn");
const buffIndicator = document.getElementById("buff-indicator");
const buffRemaining = document.getElementById("buff-remaining");

let buffEndTime = 0; // バフ終了時刻(ms)
let lastFeedTime = -Infinity; // 直近の餌やり時刻(ms)

function currentMultiplier() {
  return Date.now() < buffEndTime ? gameConfig.feedBuffMultiplier : 1;
}

function formatSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function feed() {
  const now = Date.now();
  if (now - lastFeedTime < gameConfig.feedCooldownSec * 1000) return;

  lastFeedTime = now;
  buffEndTime = now + gameConfig.feedBuffDurationSec * 1000;
  spawnFoodPellets();
  Sound.place();
  updateFeedUi();
}

function spawnFoodPellets() {
  ownedTankIds.forEach((tankId) => {
    const rt = tankRuntime[tankId];
    for (let i = 0; i < 8; i++) {
      const pellet = document.createElement("div");
      pellet.className = "food-pellet";
      pellet.style.left = `${10 + Math.random() * 80}%`;
      pellet.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
      pellet.style.setProperty("--fall", `${rt.tankEl.clientHeight * (0.5 + Math.random() * 0.4)}px`);
      rt.tankEl.appendChild(pellet);
      pellet.addEventListener("animationend", () => pellet.remove());
    }
  });
}

function updateFeedUi() {
  const now = Date.now();

  if (now < buffEndTime) {
    buffIndicator.hidden = false;
    buffRemaining.textContent = formatSec(Math.ceil((buffEndTime - now) / 1000));
  } else {
    buffIndicator.hidden = true;
  }

  const cooldownLeft = gameConfig.feedCooldownSec * 1000 - (now - lastFeedTime);
  if (cooldownLeft > 0) {
    feedBtn.disabled = true;
    feedBtn.textContent = `🍤 ${formatSec(Math.ceil(cooldownLeft / 1000))}`;
  } else {
    feedBtn.disabled = false;
    feedBtn.textContent = "🍤 餌やり";
  }
}

feedBtn.addEventListener("click", feed);
setInterval(updateFeedUi, 1000);

// --- セーブ/ロード(F10。4.2のlocalStorage案に準拠) ---
// 所持している水槽はすべて常時稼働のため、全ての所持水槽の状態をそのまま保存する。

const SAVE_KEY = "myaquarium_save";
const SAVE_VERSION = 2;

function serializeState() {
  const tanksOut = {};
  ownedTankIds.forEach((tankId) => {
    const rt = tankRuntime[tankId];
    tanksOut[tankId] = {
      placements: rt.coinFish.map((f) => ({
        itemTypeId: f.itemId,
        level: f.level,
        topPercent: parseFloat(f.element.style.top) || 50,
      })),
      decorations: rt.placedDecorations.map((d) => ({
        itemTypeId: d.element.dataset.itemId,
        leftPercent: parseFloat(d.element.style.left) || 50,
        bottomPercent: parseFloat(d.element.style.bottom) || 5,
      })),
    };
  });

  return {
    version: SAVE_VERSION,
    coins,
    inventory,
    ownedTankIds,
    tanks: tanksOut,
    lastSavedAt: Date.now(),
  };
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeState()));
}

// v1(単一水槽)を v2(複数水槽)へマイグレーションする
function migrate(data) {
  if (data.version === 2) return data;
  if (data.version === 1) {
    return {
      version: 2,
      coins: data.coins,
      inventory: data.inventory,
      ownedTankIds: [DEFAULT_TANK_ID],
      tanks: {
        [DEFAULT_TANK_ID]: {
          placements: data.placements || [],
          decorations: data.decorations || [],
        },
      },
      lastSavedAt: data.lastSavedAt,
    };
  }
  return null;
}

function loadState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function restoreState(data) {
  coins = data.coins || 0;
  balanceValue.textContent = coins;
  inventory = Array.isArray(data.inventory) ? data.inventory : [];

  ownedTankIds =
    Array.isArray(data.ownedTankIds) && data.ownedTankIds.length
      ? data.ownedTankIds
      : [DEFAULT_TANK_ID];

  ownedTankIds.forEach((tankId) => {
    const tankDef = findTank(tankId);
    createTankCard(tankDef);

    const saved = (data.tanks && data.tanks[tankId]) || { placements: [], decorations: [] };
    (saved.placements || []).forEach(({ itemTypeId, topPercent, level }) => {
      const item = findItem(itemTypeId);
      if (item) addFishToTank(tankId, item, topPercent, level || 1);
    });
    (saved.decorations || []).forEach(({ itemTypeId, leftPercent, bottomPercent }) => {
      const item = findItem(itemTypeId);
      if (item) addDecorationToTank(tankId, item, leftPercent, bottomPercent);
    });
  });

  updateShopButtons();
  renderInventory();
  updateCarousel();
}

function initDefaultState() {
  ownedTankIds = [DEFAULT_TANK_ID];
  const tankDef = findTank(DEFAULT_TANK_ID);
  createTankCard(tankDef);
  addFishToTank(DEFAULT_TANK_ID, findItem("fish_goldfish"), 45);
  renderInventory();
  updateCarousel();
  saveState();
}

// 全所持水槽の配置魚から、毎秒のコイン生成レート合計を求める(F13)
function totalCoinsPerSecond() {
  let sum = 0;
  Object.values(tankRuntime).forEach((rt) => {
    rt.coinFish.forEach((f) => {
      const item = findItem(f.itemId);
      sum += item.amount / effectiveIntervalSec(item, f.level);
    });
  });
  return sum;
}

// オフライン収益(F13。2.4)。前回保存からの経過分を上限付きでまとめて付与する
function grantOfflineEarnings(lastSavedAt) {
  if (!lastSavedAt) return;
  const elapsedSec = (Date.now() - lastSavedAt) / 1000;
  if (elapsedSec <= 0) return;

  const capSec = gameConfig.offlineCapHours * 3600;
  const earned = Math.floor(Math.min(elapsedSec, capSec) * totalCoinsPerSecond());
  if (earned <= 0) return;

  addCoins(earned);
  showWelcomeBack(earned);
}

// マスタデータ読込後にゲームを起動する(データと実装の分離。9章)
function startGame() {
  renderShop();

  const savedState = loadState();
  if (savedState) {
    restoreState(savedState);
    grantOfflineEarnings(savedState.lastSavedAt);
    saveState(); // マイグレーション結果(v2)+オフライン収益を即座に永続化
  } else {
    initDefaultState();
  }

  setInterval(saveState, 30000);
  requestAnimationFrame(tick);
}

fetch("data/master.json")
  .then((res) => res.json())
  .then((data) => {
    itemMaster = data.items;
    tankMaster = data.tanks;
    if (data.config) gameConfig = { ...gameConfig, ...data.config };
    startGame();
  })
  .catch(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p style="color:#fff;padding:12px;background:#a33;">マスタデータ(data/master.json)の読み込みに失敗しました。ローカルサーバー経由で開いてください(例: python3 -m http.server)。</p>'
    );
  });

// --- 泡演出(F12。常時の環境泡 + エアレーションからの泡。全ての所持水槽で動作) ---

const MAX_BUBBLES_PER_TANK = 40; // 描画負荷保護(9章)

function spawnBubble(tankId, leftPercent) {
  const rt = tankRuntime[tankId];
  if (!rt || rt.bubbleLayerEl.childElementCount >= MAX_BUBBLES_PER_TANK) return;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const size = 3 + Math.random() * 6;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${leftPercent}%`;
  bubble.style.setProperty("--drift", `${(Math.random() - 0.5) * 30}px`);
  bubble.style.setProperty("--rise", `${rt.tankEl.clientHeight}px`);
  bubble.style.animationDuration = `${3 + Math.random() * 3}s`;

  rt.bubbleLayerEl.appendChild(bubble);
  bubble.addEventListener("animationend", () => bubble.remove());
}

// 常時の控えめな環境泡
setInterval(() => {
  ownedTankIds.forEach((tankId) => {
    if (Math.random() < 0.6) spawnBubble(tankId, 5 + Math.random() * 90);
  });
}, 1400);

// エアレーションからの泡(配置位置から多めに立ち上る)
setInterval(() => {
  ownedTankIds.forEach((tankId) => {
    const rt = tankRuntime[tankId];
    rt.placedDecorations
      .filter((d) => d.bubbleSource)
      .forEach((d) => {
        const leftPercent = parseFloat(d.element.style.left) || 50;
        spawnBubble(tankId, leftPercent + (Math.random() - 0.5) * 4);
      });
  });
}, 500);
