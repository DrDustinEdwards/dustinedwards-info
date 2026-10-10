// "Keep on this device" on a procedure page (docs/KNOWLEDGE-BASE.md, A3): the page, and the files it uses, stored in
// this browser so it opens at the bench or in the kitchen with no signal. Nothing is stored until the reader asks, and
// only the pages they ask for: the worker (public/sw.js) is registered on the first press and serves the kept copy only
// when the network fails. Removing the last kept page clears the store and unregisters the worker, so a reader who
// changes their mind leaves nothing behind. A browser without service workers is offered nothing.

const KEPT = "kept-v1";
const WORKER = "/sw.js";

const root = document.querySelector<HTMLElement>(".procedure");
const links = root?.querySelector<HTMLElement>(".procedure-links");

/** The page's own address, without a scale or units: what the worker matches a kept page by. */
const page = location.pathname;

/**
 * Every same-origin file this page uses: its stylesheets, its scripts and the bundles the loader inserts, its images, and
 * the fonts the stylesheets loaded. Each is stored as fetched, so the kept page draws as it does online.
 */
function filesOfPage(): string[] {
  const urls = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const url = new URL(value, location.href);
    if (url.origin === location.origin) urls.add(url.pathname + url.search);
  };
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"], link[rel="modulepreload"]')) add(link.getAttribute("href"));
  for (const script of document.querySelectorAll<HTMLScriptElement>("script[src]")) add(script.getAttribute("src"));
  for (const marker of document.querySelectorAll<HTMLTemplateElement>("template[data-enhance]")) add(marker.getAttribute("data-enhance"));
  for (const img of document.querySelectorAll<HTMLImageElement>("img[src]")) add(img.getAttribute("src"));
  for (const entry of performance.getEntriesByType("resource")) {
    if ((entry as PerformanceResourceTiming).initiatorType === "css") add(entry.name);
  }
  urls.delete(page);
  return [...urls];
}

// Looked up, never opened: opening a cache creates it, and a reader who only views the page stores nothing.
async function isKept() {
  return Boolean(await caches.match(page, { cacheName: KEPT }));
}

async function keep() {
  // The page first, and it must arrive before anything is registered or stored; a file that fails is left for the next
  // keep, so one missing image costs only itself.
  const response = await fetch(page, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`the page answered ${response.status}`);
  await navigator.serviceWorker.register(WORKER, { scope: "/" });
  const cache = await caches.open(KEPT);
  await cache.put(page, response);
  await Promise.allSettled(filesOfPage().map((url) => cache.add(url)));
}

async function remove() {
  const cache = await caches.open(KEPT);
  await cache.delete(page);
  // The files are shared between kept pages, so they go only with the last page. A page's address has no extension; a
  // stylesheet, bundle, font or image has one.
  const pages = (await cache.keys()).filter((request) => !/\.[a-z0-9]+$/i.test(new URL(request.url).pathname));
  if (pages.length > 0) return;
  await caches.delete(KEPT);
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    if (registration.active?.scriptURL.endsWith(WORKER) || registration.installing?.scriptURL.endsWith(WORKER) || registration.waiting?.scriptURL.endsWith(WORKER)) {
      await registration.unregister();
    }
  }
}

if (root && links && "serviceWorker" in navigator && "caches" in window) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "offline-keep";
  const status = document.createElement("span");
  status.className = "offline-status";
  status.setAttribute("role", "status");

  const paint = (kept: boolean) => {
    button.setAttribute("aria-pressed", String(kept));
    button.textContent = kept ? "Kept on this device" : "Keep on this device";
    button.title = kept ? "Press to remove the copy kept on this device" : "Keep a copy that opens with no connection";
  };

  button.addEventListener("click", async () => {
    const kept = button.getAttribute("aria-pressed") === "true";
    button.disabled = true;
    try {
      if (kept) {
        await remove();
        paint(false);
        status.textContent = "Removed from this device.";
      } else {
        await keep();
        paint(true);
        status.textContent = "Kept on this device: it opens with no connection.";
      }
    } catch (error) {
      status.textContent = kept ? "This copy could not be removed." : "This page could not be kept on this device.";
      // Reported, not swallowed, and not thrown from an event handler's promise, where it would go unhandled.
      reportError(error);
    } finally {
      button.disabled = false;
    }
  });

  paint(false);
  links.appendChild(button);
  links.appendChild(status);
  isKept().then(paint, () => {
    // Storage refused (a private window may): offer nothing that cannot work.
    button.remove();
  });
}
