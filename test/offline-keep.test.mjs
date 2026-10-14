import assert from "node:assert/strict";
import test from "node:test";

import { parseHTML } from "linkedom";

/* "Keep on this device" (app/enhance/offline.ts, docs/KNOWLEDGE-BASE.md A3), run on a procedure page's markup in a DOM
 * with no browser: nothing is stored until the reader asks; keeping stores the page and the files it uses and registers
 * the worker; removing the last kept page clears the store and unregisters it. */

const ORIGIN = "https://example.com";
const PAGE = "/research/protocols/phage-dna-extraction";

const markup = `<!doctype html><html><head>
  <link rel="stylesheet" href="/assets/root-1.css"><link rel="stylesheet" href="https://fonts.example/x.css">
  <script type="module" src="/assets/entry-1.js"></script>
</head><body><div class="procedure"><p class="procedure-links"><a href="${PAGE}/sheet">Printable sheet</a></p>
  <img src="/media/gel.png" alt="A gel"><template data-enhance="/assets/run-1.js"></template></div></body></html>`;

let run = 0;

/**
 * The page with the module run on it, in a browser that has service workers unless `supported` is false.
 *
 * @param {{ supported?: boolean, kept?: string[], pageStatus?: number }} [opts]
 */
async function load({ supported = true, kept = [], pageStatus = 200 } = {}) {
  const { document, window } = parseHTML(markup);
  /** @type {Map<string, Map<string, string>>} */
  const stores = new Map();
  const state = { registered: /** @type {Array<{ url: string, scope: string }>} */ ([]), unregistered: 0, fetched: /** @type {string[]} */ ([]), reported: /** @type {unknown[]} */ ([]) };
  const abs = (/** @type {string} */ u) => new URL(u, `${ORIGIN}${PAGE}`).href;
  const fetchFake = async (/** @type {string} */ url) => {
    state.fetched.push(new URL(url, ORIGIN).pathname);
    const status = new URL(url, ORIGIN).pathname === PAGE ? pageStatus : url.includes("missing") ? 404 : 200;
    return new Response(`body of ${url}`, { status });
  };
  const open = async (/** @type {string} */ name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = /** @type {Map<string, string>} */ (stores.get(name));
    return {
      match: async (/** @type {string} */ key) => (store.has(abs(key)) ? new Response(store.get(abs(key))) : undefined),
      put: async (/** @type {string} */ key, /** @type {Response} */ res) => void store.set(abs(key), await res.text()),
      add: async (/** @type {string} */ key) => {
        const res = await fetchFake(key);
        if (!res.ok) throw new TypeError("bad status");
        store.set(abs(key), await res.text());
      },
      delete: async (/** @type {string} */ key) => store.delete(abs(key)),
      keys: async () => [...store.keys()].map((url) => ({ url })),
    };
  };
  for (const path of kept) await (await open("kept-v1")).put(path, new Response("kept"));
  const registration = { active: { scriptURL: `${ORIGIN}/sw.js` }, unregister: async () => (state.unregistered += 1) };
  const globals = {
    document,
    window: supported ? Object.assign(window, { caches: {} }) : window,
    location: new URL(`${ORIGIN}${PAGE}?n=3`),
    navigator: supported
      ? {
          serviceWorker: {
            register: async (/** @type {string} */ url, /** @type {{ scope: string }} */ o) => void state.registered.push({ url, scope: o.scope }),
            getRegistrations: async () => (state.registered.length > 0 || kept.length > 0 ? [registration] : []),
          },
        }
      : {},
    caches: {
      open,
      // As the real one: a lookup by name never creates the store.
      match: async (/** @type {string} */ key, /** @type {{ cacheName: string }} */ o) => {
        const store = stores.get(o.cacheName);
        return store?.has(abs(key)) ? new Response(store.get(abs(key))) : undefined;
      },
      delete: async (/** @type {string} */ name) => stores.delete(name),
    },
    fetch: fetchFake,
    reportError: (/** @type {unknown} */ error) => void state.reported.push(error),
    performance: { getEntriesByType: () => [{ name: `${ORIGIN}/fonts/inter.woff2`, initiatorType: "css" }, { name: `${ORIGIN}/api/x`, initiatorType: "fetch" }] },
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  await import(`../app/enhance/offline.ts?run=${(run += 1)}`);
  await new Promise((r) => setTimeout(r, 0));
  const button = () => document.querySelector(".offline-keep");
  const press = async () => {
    button().dispatchEvent(new window.Event("click"));
    for (let i = 0; i < 20 && button().disabled !== false; i += 1) await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };
  const keptPaths = () => [...(stores.get("kept-v1")?.keys() ?? [])].map((u) => new URL(u).pathname).sort();
  return { document, state, stores, button, press, keptPaths };
}

await test("a browser with no service workers is offered nothing", async () => {
  const { button } = await load({ supported: false });
  assert.equal(button(), null);
});

await test("nothing is stored or registered until the reader asks", async () => {
  const { button, state, keptPaths, stores } = await load();
  assert.equal(stores.size, 0, "viewing the page creates no store at all");
  assert.equal(button()?.textContent, "Keep on this device");
  assert.equal(button()?.getAttribute("aria-pressed"), "false");
  assert.deepEqual(state.registered, []);
  assert.deepEqual(keptPaths(), []);
});

await test("keeping stores the page at its own address and every same-origin file it uses, and registers the worker", async () => {
  const { button, press, state, keptPaths, document } = await load();
  await press();
  assert.deepEqual(state.registered, [{ url: "/sw.js", scope: "/" }]);
  assert.deepEqual(keptPaths(), ["/assets/entry-1.js", "/assets/root-1.css", "/assets/run-1.js", "/fonts/inter.woff2", "/media/gel.png", PAGE].sort());
  assert.equal(button()?.getAttribute("aria-pressed"), "true");
  assert.equal(button()?.textContent, "Kept on this device");
  assert.match(document.querySelector(".offline-status")?.textContent ?? "", /opens with no connection/);
});

await test("a page already kept says so when it opens", async () => {
  const { button } = await load({ kept: [PAGE] });
  assert.equal(button()?.getAttribute("aria-pressed"), "true");
});

await test("a page that will not load is not kept, and the reader is told", async () => {
  const { button, press, keptPaths, document, state } = await load({ pageStatus: 503 });
  await press();
  assert.match(String(state.reported[0]), /the page answered 503/, "the failure is reported to the console, not swallowed");
  assert.deepEqual(keptPaths(), []);
  assert.deepEqual(state.registered, [], "nothing is registered for a page that could not be kept");
  assert.equal(button()?.getAttribute("aria-pressed"), "false");
  assert.match(document.querySelector(".offline-status")?.textContent ?? "", /could not be kept/);
});

await test("removing the last kept page clears the store and unregisters the worker; with another kept, the files stay", async () => {
  const last = await load({ kept: [PAGE, "/assets/root-1.css"] });
  await last.press();
  assert.equal(last.stores.has("kept-v1"), false, "the store is gone with the last page");
  assert.equal(last.state.unregistered, 1);
  assert.equal(last.button()?.getAttribute("aria-pressed"), "false");

  const shared = await load({ kept: [PAGE, "/recipes/flatbread", "/assets/root-1.css"] });
  await shared.press();
  assert.deepEqual(shared.keptPaths(), ["/assets/root-1.css", "/recipes/flatbread"]);
  assert.equal(shared.state.unregistered, 0);
});
