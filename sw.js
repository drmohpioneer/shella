// Shella offline shell. The page itself is network-first (so updates arrive at once) with the cached copy
// as the fallback; pinned CDN files (Firebase, DiceBear, MediaPipe, fonts) are cache-first.
// Firestore traffic is never touched: its own offline cache handles the data.
const V = "shella-v1";
const SHELL = ["./", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdn\.jsdelivr\.net\/npm\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|storage\.googleapis\.com\/mediapipe-models\/)/;

self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (r.mode === "navigate" || u.origin === location.origin) e.respondWith(networkFirst(r));
  else if (CDN.test(r.url)) e.respondWith(cacheFirst(r));
});

async function networkFirst(r) {
  const c = await caches.open(V);
  try {
    const res = await Promise.race([fetch(r), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4000))]);
    if (res.ok) c.put(r.mode === "navigate" ? "./" : r, res.clone());
    return res;
  } catch {
    return (await c.match(r.mode === "navigate" ? "./" : r, { ignoreSearch: true })) || Response.error();
  }
}
async function cacheFirst(r) {
  const c = await caches.open(V);
  const hit = await c.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok || res.type === "opaque") c.put(r, res.clone());
  return res;
}
