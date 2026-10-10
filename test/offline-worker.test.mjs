import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

/* The offline worker (public/sw.js, docs/KNOWLEDGE-BASE.md A3), run in a sandbox with an in-memory cache and a network
 * that can be cut: online it changes nothing and stores nothing a reader did not keep; offline it serves the kept page
 * and its files, and nothing else. */

const ORIGIN = "https://example.com";
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

class MemoryCache {
  /** @type {Map<string, Response>} */
  entries = new Map();
  /** @param {Request | string} key */
  static url(key) {
    return new URL(typeof key === "string" ? key : key.url, ORIGIN);
  }
  /** @param {Request | string} key @param {{ ignoreSearch?: boolean }} [options] */
  async match(key, options = {}) {
    const url = MemoryCache.url(key);
    for (const [stored, response] of this.entries) {
      const s = new URL(stored);
      if (s.pathname === url.pathname && (options.ignoreSearch || s.search === url.search)) return response.clone();
    }
    return undefined;
  }
  /** @param {Request | string} key @param {Response} response */
  async put(key, response) {
    this.entries.set(MemoryCache.url(key).href, response);
  }
}

/**
 * The worker, loaded fresh, with `online` deciding whether fetch reaches the network.
 *
 * @param {{ kept?: Record<string, string>, others?: string[] }} [setup]
 */
function load({ kept = {}, others = [] } = {}) {
  /** @type {Map<string, MemoryCache>} */
  const caches = new Map();
  const keptCache = new MemoryCache();
  for (const [path, body] of Object.entries(kept)) keptCache.entries.set(new URL(path, ORIGIN).href, new Response(body));
  caches.set("kept-v1", keptCache);
  for (const name of others) caches.set(name, new MemoryCache());
  /** @type {Record<string, Function>} */
  const listeners = {};
  const state = { online: true, fetched: /** @type {string[]} */ ([]), claimed: false, skipped: false };
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (/** @type {string} */ type, /** @type {Function} */ fn) => (listeners[type] = fn),
    skipWaiting: () => (state.skipped = true),
    clients: { claim: async () => (state.claimed = true) },
  };
  const sandbox = {
    self,
    URL,
    Set,
    Promise,
    caches: {
      open: async (/** @type {string} */ name) => {
        if (!caches.has(name)) caches.set(name, new MemoryCache());
        return caches.get(name);
      },
      keys: async () => [...caches.keys()],
      delete: async (/** @type {string} */ name) => caches.delete(name),
    },
    fetch: async (/** @type {Request} */ request) => {
      state.fetched.push(request.url);
      if (!state.online) throw new TypeError("Failed to fetch");
      // The address with its query, so a scaled page's words differ from the plain page's.
      const url = new URL(request.url);
      return new Response(`fresh ${url.pathname}${url.search}`, { status: 200 });
    },
  };
  vm.runInNewContext(source, sandbox);
  /**
   * Fires a fetch event; the worker's answer, or null when it let the request pass.
   *
   * @param {string} path
   * @param {{ mode?: string, destination?: string, method?: string, origin?: string }} [init]
   */
  const request = async (path, { mode = "navigate", destination = "document", method = "GET", origin = ORIGIN } = {}) => {
    /** @type {Promise<Response> | null} */
    let answer = null;
    const req = { url: new URL(path, origin).href, method, mode, destination };
    listeners.fetch?.({ request: req, respondWith: (/** @type {Promise<Response>} */ p) => (answer = p) });
    if (!answer) return null;
    const response = await answer;
    return response.text();
  };
  return { listeners, state, caches, keptCache, request };
}

test("online, the worker answers from the network and stores nothing nobody kept", async () => {
  const sw = load();
  assert.equal(await sw.request("/recipes/flatbread"), "fresh /recipes/flatbread");
  assert.equal(sw.keptCache.entries.size, 0, "a page nobody kept is never stored");
  assert.equal(await sw.request("/assets/app-1.css", { mode: "no-cors", destination: "style" }), "fresh /assets/app-1.css");
  assert.equal(sw.keptCache.entries.size, 0);
});

test("a kept page fetched online is stored again, so the copy follows the page", async () => {
  const sw = load({ kept: { "/recipes/flatbread": "old copy" } });
  assert.equal(await sw.request("/recipes/flatbread"), "fresh /recipes/flatbread");
  assert.equal(await (await sw.keptCache.match("/recipes/flatbread"))?.text(), "fresh /recipes/flatbread");
  // A scaled address is the same kept page, but its scaled words are not stored over the page's own.
  await sw.request("/recipes/flatbread?servings=8");
  assert.equal(await (await sw.keptCache.match("/recipes/flatbread"))?.text(), "fresh /recipes/flatbread");
});

test("offline, the kept page and its files open from the device, at any scale; anything else fails as it would", async () => {
  const sw = load({ kept: { "/recipes/flatbread": "kept page", "/assets/app-1.css": "kept css" } });
  sw.state.online = false;
  assert.equal(await sw.request("/recipes/flatbread"), "kept page");
  assert.equal(await sw.request("/recipes/flatbread?servings=8&units=metric"), "kept page", "a scaled address opens the kept page");
  assert.equal(await sw.request("/assets/app-1.css", { mode: "no-cors", destination: "style" }), "kept css");
  await assert.rejects(sw.request("/recipes/soup"), /Failed to fetch/, "a page never kept is not served from anywhere");
  await assert.rejects(sw.request("/assets/app-1.css?v=2", { mode: "no-cors", destination: "style" }), /Failed to fetch/, "a file is matched exactly");
});

test("the worker lets everything else pass: other methods, other sites, and data requests", async () => {
  const sw = load({ kept: { "/recipes/flatbread": "kept page" } });
  assert.equal(await sw.request("/recipes/flatbread", { method: "POST" }), null);
  assert.equal(await sw.request("/recipes/flatbread", { origin: "https://elsewhere.example" }), null);
  assert.equal(await sw.request("/api/search?q=x", { mode: "cors", destination: "" }), null);
  assert.deepEqual(sw.state.fetched, [], "it did not even touch the network for them");
});

test("installing takes over at once, and activating drops an older kept store and nothing else", async () => {
  const sw = load({ others: ["kept-v0", "some-other-cache"] });
  sw.listeners.install?.({});
  assert.equal(sw.state.skipped, true);
  /** @type {Promise<unknown> | undefined} */
  let done;
  sw.listeners.activate?.({ waitUntil: (/** @type {Promise<unknown>} */ p) => (done = p) });
  await done;
  assert.deepEqual([...sw.caches.keys()].sort(), ["kept-v1", "some-other-cache"]);
  assert.equal(sw.state.claimed, true);
});
