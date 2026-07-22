const fish = document.getElementById("fish-1");

const swimDuration = 9 + Math.random() * 6; // 9〜15秒
const swayDuration = 2 + Math.random() * 1.5; // 2〜3.5秒
const topPercent = 20 + Math.random() * 55; // 上下端に寄りすぎないようにする

fish.style.animationDuration = `${swimDuration}s`;
fish.style.top = `${topPercent}%`;
fish.querySelector(".fish-shape").style.animationDuration = `${swayDuration}s`;
