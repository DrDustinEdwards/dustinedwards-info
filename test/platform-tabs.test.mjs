import assert from "node:assert/strict";
import test from "node:test";

import { parseHTML } from "linkedom";

/* Platform tabs on a software how-to (app/enhance/platforms.ts, docs/KNOWLEDGE-BASE.md S4). The page serves every
 * platform's command under a link (test/worker/howto-format.test.ts); the script makes those links tabs, shows the reader's
 * platform in every set, and remembers it. Run here on the markup the component renders, in a DOM with no browser. */

const set = (id) => `
  <div class="procedure-platforms" data-platforms="">
    <p class="procedure-platform-tabs">
      <a href="#${id}-linux" data-platform="linux">Linux</a><a href="#${id}-macos" data-platform="macos">macOS</a><a href="#${id}-windows" data-platform="windows">Windows</a>
    </p>
    <div id="${id}-linux" class="procedure-platform" data-platform="linux"><p class="procedure-platform-label">Linux</p></div>
    <div id="${id}-macos" class="procedure-platform" data-platform="macos"><p class="procedure-platform-label">macOS</p></div>
    <div id="${id}-windows" class="procedure-platform" data-platform="windows"><p class="procedure-platform-label">Windows</p></div>
  </div>`;

let run = 0;

/**
 * A page with two sets, the browser reporting `userAgent` and the device remembering `stored`, with the module run on it.
 *
 * @param {{ userAgent?: string, stored?: string | null, html?: string }} [opts]
 */
async function load({ userAgent = "Mozilla/5.0 (X11; Linux x86_64)", stored = null, html = set("a") + set("b") } = {}) {
  const { document, window } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  /** @type {Map<string, string>} */
  const storage = new Map(stored ? [["dustinedwards.platform", stored]] : []);
  // Defined rather than assigned: Node's own `navigator` is a getter.
  const globals = {
    document,
    window,
    navigator: { userAgent },
    localStorage: { getItem: (/** @type {string} */ k) => storage.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => void storage.set(k, String(v)) },
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  // A fresh query each time, so the module runs again on this page rather than coming from the import cache.
  await import(`../app/enhance/platforms.ts?run=${(run += 1)}`);
  /** @param {string} id */
  const shown = (id) => [...document.querySelectorAll(`#${id}-linux, #${id}-macos, #${id}-windows`)].filter((p) => !p.hidden).map((p) => p.dataset.platform);
  return { document, storage, shown };
}

/** @param {any} target @param {string} type @param {Record<string, unknown>} [props] */
function fire(target, type, props = {}) {
  const event = new target.ownerDocument.defaultView.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  target.dispatchEvent(event);
  return event;
}

test("the links become tabs and only the reader's platform shows, guessed from the browser when nothing is remembered", async () => {
  const { document, shown } = await load({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
  assert.deepEqual([shown("a"), shown("b")], [["windows"], ["windows"]]);
  const list = document.querySelector(".procedure-platform-tabs");
  assert.equal(list.getAttribute("role"), "tablist");
  const tab = document.querySelector('a[data-platform="windows"]');
  assert.equal(tab.getAttribute("role"), "tab");
  assert.equal(tab.getAttribute("aria-selected"), "true");
  assert.equal(tab.getAttribute("aria-controls"), "a-windows");
  assert.equal(document.querySelector("#a-windows").getAttribute("role"), "tabpanel");
  assert.equal(document.querySelector('a[data-platform="linux"]').getAttribute("aria-selected"), "false");
  assert.ok(document.querySelector("[data-platforms]").hasAttribute("data-enhanced"), "the set says it is enhanced, so the CSS drops the labels");
});

test("a remembered platform wins over the guess; a browser that says nothing starts on the first tab", async () => {
  assert.deepEqual((await load({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", stored: "macos" })).shown("a"), ["macos"]);
  assert.deepEqual((await load({ userAgent: "Mozilla/5.0" })).shown("a"), ["linux"]);
});

test("choosing a tab shows that platform in every set and remembers it; the arrow keys move along the tabs", async () => {
  const { document, storage, shown } = await load();
  const click = fire(document.querySelector('a[data-platform="macos"]'), "click");
  assert.equal(click.defaultPrevented, true, "the link does not jump: the tab shows its panel in place");
  assert.deepEqual([shown("a"), shown("b")], [["macos"], ["macos"]]);
  assert.equal(storage.get("dustinedwards.platform"), "macos");
  fire(document.querySelector('a[href="#b-macos"]'), "keydown", { key: "ArrowRight" });
  assert.deepEqual([shown("a"), shown("b")], [["windows"], ["windows"]]);
  fire(document.querySelector('a[href="#a-linux"]'), "click");
  assert.deepEqual(shown("a"), ["linux"]);
  fire(document.querySelector('a[href="#a-linux"]'), "keydown", { key: "ArrowLeft" });
  assert.deepEqual(shown("a"), ["windows"], "left from the first tab wraps to the last");
});

test("a set without the reader's platform shows its own first, and leaves the choice alone", async () => {
  const partial = set("a").replace(/<a href="#a-windows"[^>]*>Windows<\/a>/, "").replace(/<div id="a-windows"[\s\S]*?<\/div>\n/, "");
  const { shown, storage } = await load({ stored: "windows", html: partial + set("b") });
  assert.deepEqual([shown("a"), shown("b")], [["linux"], ["windows"]]);
  assert.equal(storage.get("dustinedwards.platform"), "windows");
});
