const tank = document.getElementById("tank");
const fish = document.getElementById("fish-1");
const balanceValue = document.getElementById("balance-value");

// --- 商品マスタ(F08。ノーマル/レア/スーパーレア各5種) ---

const itemMaster = [
  { id: "fish_medaka", name: "メダカ", rarity: "ノーマル", price: 80, intervalSec: 30, amount: 4, image: "assets/fish_medaka.png" },
  { id: "fish_goldfish", name: "金魚", rarity: "ノーマル", price: 100, intervalSec: 30, amount: 5, image: "assets/fish_goldfish.png" },
  { id: "fish_neon_tetra", name: "ネオンテトラ", rarity: "ノーマル", price: 120, intervalSec: 25, amount: 5, image: "assets/fish_neon_tetra.png" },
  { id: "fish_platy", name: "プラティ", rarity: "ノーマル", price: 130, intervalSec: 28, amount: 5, image: "assets/fish_platy.png" },
  { id: "fish_guppy", name: "グッピー", rarity: "ノーマル", price: 150, intervalSec: 30, amount: 6, image: "assets/fish_guppy.png" },
  { id: "fish_doctorfish", name: "ドクターフィッシュ", rarity: "レア", price: 400, intervalSec: 30, amount: 15, image: "assets/fish_doctorfish.png" },
  { id: "fish_betta", name: "ベタ", rarity: "レア", price: 600, intervalSec: 28, amount: 22, image: "assets/fish_betta.png" },
  { id: "fish_discus", name: "ディスカス", rarity: "レア", price: 700, intervalSec: 25, amount: 25, image: "assets/fish_discus.png" },
  { id: "fish_angelfish", name: "エンゼルフィッシュ", rarity: "レア", price: 850, intervalSec: 24, amount: 28, image: "assets/fish_angelfish.png" },
  { id: "fish_axolotl", name: "ウーパールーパー", rarity: "レア", price: 1000, intervalSec: 20, amount: 30, image: "assets/fish_axolotl.png" },
  { id: "fish_arowana", name: "アロワナ", rarity: "スーパーレア", price: 1800, intervalSec: 20, amount: 45, image: "assets/fish_arowana.png" },
  { id: "fish_pirarucu", name: "ピラルクー", rarity: "スーパーレア", price: 2500, intervalSec: 18, amount: 60, image: "assets/fish_pirarucu.png" },
  { id: "fish_electric_eel", name: "デンキウナギ", rarity: "スーパーレア", price: 3000, intervalSec: 16, amount: 65, image: "assets/fish_electric_eel.png" },
  { id: "fish_giant_salamander", name: "オオサンショウウオ", rarity: "スーパーレア", price: 3500, intervalSec: 15, amount: 70, image: "assets/fish_giant_salamander.png" },
  { id: "fish_oarfish", name: "リュウグウノツカイ", rarity: "スーパーレア", price: 5000, intervalSec: 12, amount: 100, image: "assets/fish_oarfish.png" },
];

function findItem(itemId) {
  return itemMaster.find((i) => i.id === itemId);
}

const MAX_FISH = 10; // 配置上限(2.5節の例に準拠)

function setupFishVisual(el, item) {
  const swimDuration = 9 + Math.random() * 6; // 9〜15秒
  const swayDuration = 2 + Math.random() * 1.5; // 2〜3.5秒
  const topPercent = 10 + Math.random() * 70; // 上下端に寄りすぎないようにする

  el.style.animationDuration = `${swimDuration}s`;
  el.style.top = `${topPercent}%`;

  const shape = el.querySelector(".fish-shape");
  shape.style.animationDuration = `${swayDuration}s`;
  shape.style.backgroundImage = `url(${item.image})`;
}

function addFishToTank(item) {
  const el = document.createElement("div");
  el.className = "fish";

  const shape = document.createElement("div");
  shape.className = "fish-shape";
  el.appendChild(shape);

  tank.appendChild(el);
  setupFishVisual(el, item);

  coinFish.push({
    element: el,
    intervalSec: item.intervalSec,
    amount: item.amount,
    lastCoinTime: performance.now(),
  });
}

const startingItem = findItem(fish.dataset.itemId);
setupFishVisual(fish, startingItem);

let coins = 0;

function addCoins(amount) {
  coins += amount;
  balanceValue.textContent = coins;
  updateShopButtons();
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

const coinFish = [
  {
    element: fish,
    intervalSec: startingItem.intervalSec,
    amount: startingItem.amount,
    lastCoinTime: performance.now(),
  },
];

function tick(now) {
  for (const f of coinFish) {
    const intervalMs = f.intervalSec * 1000;
    const elapsed = now - f.lastCoinTime;

    if (elapsed >= intervalMs) {
      const times = Math.floor(elapsed / intervalMs);
      addCoins(times * f.amount);
      spawnCoinPopup(f.element, times * f.amount);
      f.lastCoinTime += times * intervalMs;
    }
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

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
    li.innerHTML = `
      <img class="shop-item-swatch" src="${item.image}" alt="${item.name}" />
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name}(${item.rarity})</div>
        <div class="shop-item-desc">${item.intervalSec}秒ごとに${item.amount}コイン生成</div>
      </div>
      <button data-item-id="${item.id}">🪙${item.price}</button>
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
}

shopList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-item-id]");
  if (btn) purchaseItem(btn.dataset.itemId);
});

openShopBtn.addEventListener("click", () => {
  shopModal.hidden = false;
  updateShopButtons();
});

closeShopBtn.addEventListener("click", () => {
  shopModal.hidden = true;
});

renderShop();

// --- インベントリ+配置(F09 S03、F02) ---

const openInventoryBtn = document.getElementById("open-inventory");
const closeInventoryBtn = document.getElementById("close-inventory");
const inventoryModal = document.getElementById("inventory-modal");
const inventoryList = document.getElementById("inventory-list");
const fishCountInfo = document.getElementById("fish-count-info");

function renderInventory() {
  fishCountInfo.textContent = `配置中の魚: ${coinFish.length} / ${MAX_FISH}`;
  inventoryList.innerHTML = "";

  if (inventory.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = "所持しているアイテムはありません。ショップで購入してください。";
    inventoryList.appendChild(li);
    return;
  }

  const isFull = coinFish.length >= MAX_FISH;

  inventory.forEach(({ itemTypeId, count }) => {
    const item = findItem(itemTypeId);
    const li = document.createElement("li");
    li.className = "shop-item";
    li.innerHTML = `
      <img class="shop-item-swatch" src="${item.image}" alt="${item.name}" />
      <div class="shop-item-info">
        <div class="shop-item-name">${item.name} × ${count}</div>
        <div class="shop-item-desc">${item.intervalSec}秒ごとに${item.amount}コイン生成</div>
      </div>
      <button data-item-id="${item.id}" ${isFull ? "disabled" : ""}>配置する</button>
    `;
    inventoryList.appendChild(li);
  });
}

function placeFish(itemId) {
  if (coinFish.length >= MAX_FISH) return;

  const entry = inventory.find((i) => i.itemTypeId === itemId);
  if (!entry || entry.count <= 0) return;

  entry.count -= 1;
  if (entry.count === 0) {
    inventory = inventory.filter((i) => i.itemTypeId !== itemId);
  }

  addFishToTank(findItem(itemId));
  renderInventory();
}

inventoryList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-item-id]");
  if (btn) placeFish(btn.dataset.itemId);
});

openInventoryBtn.addEventListener("click", () => {
  inventoryModal.hidden = false;
  renderInventory();
});

closeInventoryBtn.addEventListener("click", () => {
  inventoryModal.hidden = true;
});
