const tank = document.getElementById("tank");
const fish = document.getElementById("fish-1");
const balanceValue = document.getElementById("balance-value");

const swimDuration = 9 + Math.random() * 6; // 9〜15秒
const swayDuration = 2 + Math.random() * 1.5; // 2〜3.5秒
const topPercent = 20 + Math.random() * 55; // 上下端に寄りすぎないようにする

fish.style.animationDuration = `${swimDuration}s`;
fish.style.top = `${topPercent}%`;
fish.querySelector(".fish-shape").style.animationDuration = `${swayDuration}s`;

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
    intervalSec: Number(fish.dataset.intervalSec),
    amount: Number(fish.dataset.amount),
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

// --- ショップ(F08 S02。今回は魚のみ) ---

const itemMaster = [
  {
    id: "fish_normal",
    name: "ノーマルフィッシュ",
    rarity: "ノーマル",
    price: 100,
    intervalSec: 30,
    amount: 5,
    color: "#ff8c42",
  },
  {
    id: "fish_rare",
    name: "レアフィッシュ",
    rarity: "レア",
    price: 500,
    intervalSec: 30,
    amount: 20,
    color: "#4fd1c5",
  },
  {
    id: "fish_super_rare",
    name: "スーパーレアフィッシュ",
    rarity: "スーパーレア",
    price: 2000,
    intervalSec: 20,
    amount: 50,
    color: "#f6ad55",
  },
];

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
      <div class="shop-item-swatch" style="background:${item.color}"></div>
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
