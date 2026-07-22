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
