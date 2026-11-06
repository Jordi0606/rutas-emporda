// Cache de la app para usarla sin cobertura. Subir VERSION en cada cambio publicado.
const VERSION = "re-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "data.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Google Maps y Routes: siempre en red, nunca en caché.
  if (/googleapis\.com$|gstatic\.com$/.test(u.hostname) && !/fonts\./.test(u.hostname)) return;
  if (u.origin === location.origin) {
    // Red primero (para recibir actualizaciones), caché si no hay conexión.
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); return res; })));
  }
});
