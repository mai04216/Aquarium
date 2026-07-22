const tank = document.getElementById("tank");
const balanceValue = document.getElementById("balance-value");

// --- マスタデータ(F08/F11。data/master.json から読み込む。9章) ---
// 経済バランスの調整は data/master.json の編集のみで行える。

let itemMaster = []; // 商品マスタ(魚・装飾)
let tankMaster = []; // 水槽マスタ

function findItem(itemId) {
  return itemMaster.find((i) => i.id === itemId);
}

const DEFAULT_TANK_ID = "tank_basic";

// 水槽状態(F11)。coinFish / placedDecorations はアクティブ水槽のライブ表現、
// 非アクティブ水槽は tankData にシリアライズして保持する。
let activeTankId = DEFAULT_TANK_ID;
let ownedTankIds = [DEFAULT_TANK_ID];
let tankData = {}; // { [tankId]: { placements: [...], decorations: [...] } }

function findTank(tankId) {
  return tankMaster.find((t) => t.id === tankId);
}

function getActiveTank() {
  return findTank(activeTankId) || findTank(DEFAULT_TANK_ID);
}

function getFishMax() {
  return getActiveTank().fishMax;
}

function getDecoMax() {
  return getActiveTank().decoMax;
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

function addFishToTank(item, topPercentOverride) {
  const el = document.createElement("div");
  el.className = "fish tank-item";
  el.dataset.itemId = item.id;

  const shape = document.createElement("div");
  shape.className = "fish-shape";
  el.appendChild(shape);

  tank.appendChild(el);
  setupFishVisual(el, item, topPercentOverride);

  coinFish.push({
    element: el,
    intervalSec: item.intervalSec,
    amount: item.amount,
    lastCoinTime: performance.now(),
  });
}

function addDecorationToTank(item, leftPercentOverride, bottomPercentOverride) {
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

  tank.appendChild(el);
  placedDecorations.push({ element: el, bubbleSource: Boolean(item.bubbleSource) });
}

let coins = 0;

function addCoins(amount) {
  coins += amount;
  balanceValue.textContent = coins;
  updateShopButtons();
  saveState();
}

function spawnCoinPopup(sourceEl, amount) {
  const tankRect = tank.getBoundingClientRect();
  const fishRect = sourceEl.getBoundingClientRect();

  const popup = document.createElement("div");
  popup.className = "coin-popup";
  popup.textContent = `+${amount}`;
  popup.style.left = `${fishRect.left - tankRect.left + fishRect.width / 2}px`;
  popup.style.top = `${fishRect.top - tankRect.top}px`;

  tank.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
}

const coinFish = []; // アクティブ水槽の魚 [{ element, intervalSec, amount, lastCoinTime }]
let placedDecorations = []; // アクティブ水槽の装飾 [{ element, bubbleSource }]

function tick(now) {
  for (const f of coinFish) {
    const intervalMs = f.intervalSec * 1000;
    const elapsed = now - f.lastCoinTime;

    if (elapsed >= intervalMs) {
      const times = Math.floor(elapsed / intervalMs);
      addCoins(times * f.amount);
      spawnCoinPopup(f.element, times * f.amount);
      Sound.coin();
      f.lastCoinTime += times * intervalMs;
    }
  }

  requestAnimationFrame(tick);
}

// --- ショップ(F08 S02) ---

let inventory = []; // [{ itemTypeId, count }]

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
  tankData[tankId] = { placements: [], decorations: [] };

  updateShopButtons();
  renderTankList();
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

const openInventoryBtn = document.getElementById("open-inventory");
const closeInventoryBtn = document.getElementById("close-inventory");
const inventoryModal = document.getElementById("inventory-modal");
const inventoryList = document.getElementById("inventory-list");
const fishCountInfo = document.getElementById("fish-count-info");

function renderInventory() {
  fishCountInfo.textContent = `配置中の魚: ${coinFish.length} / ${getFishMax()}　配置中の装飾: ${placedDecorations.length} / ${getDecoMax()}`;
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
        ? coinFish.length >= getFishMax()
        : placedDecorations.length >= getDecoMax();
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
  if (coinFish.length >= getFishMax()) return;

  const entry = inventory.find((i) => i.itemTypeId === itemId);
  if (!entry || entry.count <= 0) return;

  entry.count -= 1;
  if (entry.count === 0) {
    inventory = inventory.filter((i) => i.itemTypeId !== itemId);
  }

  addFishToTank(findItem(itemId));
  renderInventory();
  saveState();
  Sound.place();
}

function placeDecoration(itemId) {
  if (placedDecorations.length >= getDecoMax()) return;

  const entry = inventory.find((i) => i.itemTypeId === itemId);
  if (!entry || entry.count <= 0) return;

  entry.count -= 1;
  if (entry.count === 0) {
    inventory = inventory.filter((i) => i.itemTypeId !== itemId);
  }

  addDecorationToTank(findItem(itemId));
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
  inventoryModal.hidden = false;
  renderInventory();
});

closeInventoryBtn.addEventListener("click", () => {
  inventoryModal.hidden = true;
});

// --- 配置済みアイテムの移動・撤去(F03) ---

const fishActionPanel = document.getElementById("fish-action-panel");
const fishActionName = document.getElementById("fish-action-name");
const fishActionHint = document.getElementById("fish-action-hint");
const fishActionRemoveBtn = document.getElementById("fish-action-remove");
const fishActionCancelBtn = document.getElementById("fish-action-cancel");

let selectedItemEl = null;

function selectItem(el) {
  if (selectedItemEl === el) {
    deselectItem();
    return;
  }
  deselectItem();
  selectedItemEl = el;
  el.classList.add("selected");

  const item = findItem(el.dataset.itemId);
  fishActionName.textContent = `選択中: ${item.name}`;
  fishActionHint.textContent =
    item.category === "fish"
      ? "水槽内をクリックして位置を移動"
      : "海藻・岩は移動できません(撤去のみ)";
  fishActionPanel.hidden = false;
}

function deselectItem() {
  if (selectedItemEl) selectedItemEl.classList.remove("selected");
  selectedItemEl = null;
  fishActionPanel.hidden = true;
}

function removeItemFromTank(el) {
  const itemId = el.dataset.itemId;
  const item = findItem(itemId);

  if (item.category === "fish") {
    const idx = coinFish.findIndex((f) => f.element === el);
    if (idx !== -1) coinFish.splice(idx, 1);
  } else {
    const idx = placedDecorations.findIndex((d) => d.element === el);
    if (idx !== -1) placedDecorations.splice(idx, 1);
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

tank.addEventListener("click", (event) => {
  const itemEl = event.target.closest(".tank-item");
  if (itemEl) {
    selectItem(itemEl);
    return;
  }

  if (selectedItemEl && event.target === tank) {
    const item = findItem(selectedItemEl.dataset.itemId);
    if (item.category === "fish") {
      const rect = tank.getBoundingClientRect();
      const relY = (event.clientY - rect.top) / rect.height;
      const topPercent = Math.min(85, Math.max(5, relY * 100));
      selectedItemEl.style.top = `${topPercent}%`;
      deselectItem();
      saveState();
    }
  }
});

fishActionRemoveBtn.addEventListener("click", () => {
  if (!selectedItemEl) return;
  removeItemFromTank(selectedItemEl);
  deselectItem();
});

fishActionCancelBtn.addEventListener("click", deselectItem);

// --- 水槽切り替え(F11 S02/S01) ---

function serializeActiveTank() {
  return {
    placements: coinFish.map((f) => ({
      itemTypeId: f.element.dataset.itemId,
      topPercent: parseFloat(f.element.style.top) || 50,
    })),
    decorations: placedDecorations.map((d) => ({
      itemTypeId: d.element.dataset.itemId,
      leftPercent: parseFloat(d.element.style.left) || 50,
      bottomPercent: parseFloat(d.element.style.bottom) || 5,
    })),
  };
}

function clearTankDom() {
  coinFish.forEach((f) => f.element.remove());
  coinFish.length = 0;
  placedDecorations.forEach((d) => d.element.remove());
  placedDecorations.length = 0;
}

function buildTankFromData(data) {
  (data.placements || []).forEach(({ itemTypeId, topPercent }) => {
    const item = findItem(itemTypeId);
    if (item) addFishToTank(item, topPercent);
  });
  (data.decorations || []).forEach(({ itemTypeId, leftPercent, bottomPercent }) => {
    const item = findItem(itemTypeId);
    if (item) addDecorationToTank(item, leftPercent, bottomPercent);
  });
}

function applyTankBackground() {
  tankMaster.forEach((t) => tank.classList.remove(t.bgClass));
  tank.classList.add(getActiveTank().bgClass);
}

// アクティブ水槽を tankData に退避し、対象水槽をライブ表示へ切り替える
function switchTank(tankId) {
  if (!ownedTankIds.includes(tankId)) return;

  deselectItem();
  tankData[activeTankId] = serializeActiveTank();
  clearTankDom();

  activeTankId = tankId;
  applyTankBackground();
  buildTankFromData(tankData[tankId] || { placements: [], decorations: [] });

  tankModal.hidden = true;
  renderInventory();
  renderTankList();
  saveState();
  Sound.ui();
}

const openTankBtn = document.getElementById("open-tank");
const closeTankBtn = document.getElementById("close-tank");
const tankModal = document.getElementById("tank-modal");
const tankList = document.getElementById("tank-list");

function renderTankList() {
  tankList.innerHTML = "";
  ownedTankIds.forEach((tankId) => {
    const tankDef = findTank(tankId);
    const isActive = tankId === activeTankId;
    const li = document.createElement("li");
    li.className = "shop-item";
    li.innerHTML = `
      <div class="shop-item-swatch ${tankDef.bgClass}"></div>
      <div class="shop-item-info">
        <div class="shop-item-name">${tankDef.name}</div>
        <div class="shop-item-desc">魚${tankDef.fishMax}匹・装飾${tankDef.decoMax}個まで</div>
      </div>
      <button data-switch-tank="${tankId}" ${isActive ? "disabled" : ""}>${isActive ? "表示中" : "切り替え"}</button>
    `;
    tankList.appendChild(li);
  });
}

tankList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-switch-tank]");
  if (btn) switchTank(btn.dataset.switchTank);
});

openTankBtn.addEventListener("click", () => {
  tankModal.hidden = false;
  renderTankList();
});

closeTankBtn.addEventListener("click", () => {
  tankModal.hidden = true;
});

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

// --- セーブ/ロード(F10。4.2のlocalStorage案に準拠) ---

const SAVE_KEY = "myaquarium_save";
const SAVE_VERSION = 2;

function serializeState() {
  // アクティブ水槽の現在のライブ状態を tankData に反映してから保存する
  tankData[activeTankId] = serializeActiveTank();
  return {
    version: SAVE_VERSION,
    coins,
    inventory,
    activeTankId,
    ownedTankIds,
    tanks: tankData,
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
      activeTankId: DEFAULT_TANK_ID,
      ownedTankIds: [DEFAULT_TANK_ID],
      tanks: {
        [DEFAULT_TANK_ID]: {
          placements: data.placements || [],
          decorations: data.decorations || [],
        },
      },
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
  tankData = data.tanks || {};
  ownedTankIds.forEach((id) => {
    if (!tankData[id]) tankData[id] = { placements: [], decorations: [] };
  });

  activeTankId = ownedTankIds.includes(data.activeTankId)
    ? data.activeTankId
    : ownedTankIds[0];

  clearTankDom();
  applyTankBackground();
  buildTankFromData(tankData[activeTankId]);

  updateShopButtons();
  renderInventory();
}

function initDefaultState() {
  ownedTankIds = [DEFAULT_TANK_ID];
  activeTankId = DEFAULT_TANK_ID;
  tankData = {
    [DEFAULT_TANK_ID]: {
      placements: [{ itemTypeId: "fish_goldfish", topPercent: 45 }],
      decorations: [],
    },
  };
  applyTankBackground();
  buildTankFromData(tankData[DEFAULT_TANK_ID]);
  renderInventory();
  saveState();
}

// マスタデータ読込後にゲームを起動する(データと実装の分離。9章)
function startGame() {
  renderShop();

  const savedState = loadState();
  if (savedState) {
    restoreState(savedState);
    saveState(); // マイグレーション結果(v2)を即座に永続化
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
    startGame();
  })
  .catch(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p style="color:#fff;padding:12px;background:#a33;">マスタデータ(data/master.json)の読み込みに失敗しました。ローカルサーバー経由で開いてください(例: python3 -m http.server)。</p>'
    );
  });

// --- 泡演出(F12。常時の環境泡 + エアレーションからの泡) ---

const bubbleLayer = document.getElementById("bubble-layer");
const MAX_BUBBLES = 40; // 描画負荷保護(9章)

function spawnBubble(leftPercent) {
  if (bubbleLayer.childElementCount >= MAX_BUBBLES) return;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const size = 3 + Math.random() * 6;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${leftPercent}%`;
  bubble.style.setProperty("--drift", `${(Math.random() - 0.5) * 30}px`);
  bubble.style.setProperty("--rise", `${tank.clientHeight}px`);
  bubble.style.animationDuration = `${3 + Math.random() * 3}s`;

  bubbleLayer.appendChild(bubble);
  bubble.addEventListener("animationend", () => bubble.remove());
}

// 常時の控えめな環境泡
setInterval(() => {
  if (Math.random() < 0.6) spawnBubble(5 + Math.random() * 90);
}, 1400);

// エアレーションからの泡(配置位置から多めに立ち上る)
setInterval(() => {
  placedDecorations
    .filter((d) => d.bubbleSource)
    .forEach((d) => {
      const leftPercent = parseFloat(d.element.style.left) || 50;
      spawnBubble(leftPercent + (Math.random() - 0.5) * 4);
    });
}, 500);
