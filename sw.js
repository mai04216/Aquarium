// Service Worker(PWA。10章決定No.3)
// アプリ一式をキャッシュし、オフラインでも起動できるようにする。
// キャッシュ名のバージョンを上げると、古いキャッシュが破棄され更新される。

const CACHE_NAME = "myaquarium-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./sound.js",
  "./manifest.webmanifest",
  "./data/master.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/deco_aerator.png",
  "./assets/deco_rock_brown.png",
  "./assets/deco_rock_gray.png",
  "./assets/deco_seaweed_green.png",
  "./assets/deco_seaweed_red.png",
  "./assets/fish_angelfish.png",
  "./assets/fish_arowana.png",
  "./assets/fish_axolotl.png",
  "./assets/fish_betta.png",
  "./assets/fish_discus.png",
  "./assets/fish_doctorfish.png",
  "./assets/fish_electric_eel.png",
  "./assets/fish_giant_salamander.png",
  "./assets/fish_goldfish.png",
  "./assets/fish_guppy.png",
  "./assets/fish_medaka.png",
  "./assets/fish_neon_tetra.png",
  "./assets/fish_oarfish.png",
  "./assets/fish_pirarucu.png",
  "./assets/fish_platy.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// cache-first(キャッシュ優先。オフライン動作を優先し、無ければネットワーク)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
