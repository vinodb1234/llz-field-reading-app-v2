// =============================================
// LLZ Field Reading App - Offline Service Worker
// =============================================

const CACHE_NAME = "llz-cache-v4";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.json",

  // ICONS (all PNG files from your /icon folder)
  "./icon/icon-48.png",
  "./icon/icon-72.png",
  "./icon/icon-96.png",
  "./icon/icon-128.png",
  "./icon/icon-192.png",
  "./icon/icon-256.png",
  "./icon/icon-384.png",
  "./icon/icon-512.png",

  // External libraries used by your LLZ app
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://html2canvas.hertzen.com/dist/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// INSTALL EVENT — caches everything
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching app files...");
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ACTIVATE EVENT — clears old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Service Worker: Removing old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH EVENT — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the new version of this file
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, cloned);
        });
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request);
      })
  );
});
