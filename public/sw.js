// Offline at the bench or in the kitchen (docs/KNOWLEDGE-BASE.md, A3). This worker is registered only when a reader
// presses "Keep on this device" on a procedure page (app/enhance/offline.ts), and it caches nothing on its own: the page
// stores itself and the files it uses in the "kept" cache. The worker answers from that cache only when the network
// fails, so online the site behaves exactly as it does without it, and a page nobody kept is never stored.
//
// A plain script, not a module, at the site's root so its scope covers every procedure page. The policy allows it by
// 'self' (worker-src falls back to script-src). test/offline-worker.test.mjs runs this file in a sandbox.

const KEPT = "kept-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // A later version of this file names a new cache; the old one goes with the worker that wrote it.
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("kept-") && name !== KEPT).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

/** A page, or a file a page uses: what a kept page needs offline. Everything else passes the worker by. */
const SUBRESOURCES = new Set(["style", "script", "font", "image"]);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const page = request.mode === "navigate";
  if (!page && !SUBRESOURCES.has(request.destination)) return;
  event.respondWith(networkFirst(request, page));
});

/**
 * The network's answer when there is one, else the kept copy. A kept page fetched online is stored again, so the copy
 * on the device follows the page; a page that was never kept is left alone.
 *
 * @param {Request} request
 * @param {boolean} page
 */
async function networkFirst(request, page) {
  const cache = await caches.open(KEPT);
  // A page is kept by its address alone: the same recipe at another serving size is still the kept page.
  const options = page ? { ignoreSearch: true } : undefined;
  try {
    const response = await fetch(request);
    if (page && response.ok && !new URL(request.url).search && (await cache.match(request, options))) {
      await cache.put(new URL(request.url).pathname, response.clone());
    }
    return response;
  } catch (error) {
    const kept = await cache.match(request, options);
    if (kept) return kept;
    throw error;
  }
}
