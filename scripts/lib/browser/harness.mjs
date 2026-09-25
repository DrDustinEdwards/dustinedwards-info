/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// What every check:browser case shares: the origin under test, the counter, and the helpers that
// drive a page. The cases share ONE page, so a case that navigates voids the ones after it.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTally } from "../tally.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const PORT = 4173;

export const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "");
export const DRIVES_PREVIEW = !PUBLIC_ORIGIN;
export const BASE = PUBLIC_ORIGIN || `http://localhost:${PORT}`;

/**
 * What the orchestrator hands each case: the one shared page, and the browser for cases that open
 * their own.
 *
 * @typedef {{ page: import("puppeteer").Page, browser: import("puppeteer").Browser }} CaseContext
 */

export const tally = createTally();
export const { ok } = tally;
/** @type {string[]} */
export const skipped = [];

/* The gate's own fetches carry a deadline, like the readiness probes: a hung origin would otherwise
   stall the run until CI's job timeout, with nothing saying which request hung. */
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * Fails one case on a missing selector, where `page.click` would end the run.
 *
 * @param {any} target
 * @param {string} selector
 * @param {string} label
 * @returns {Promise<boolean>} whether the click happened
 */
export async function clickOrFail(target, selector, label) {
  const handle = await target.$(selector);
  if (!handle) {
    ok(
      label,
      false,
      `no element matches ${selector}. The selector has moved or the control is gone. ` +
        `Every later case still ran, which is the point of failing here rather than throwing.`,
    );
    return false;
  }
  await handle.click();
  return true;
}

/** @param {string} label @param {string} why */
export function skip(label, why) {
  skipped.push(label);
  console.log(`  SKIP  ${label}\n        ${why}`);
}

/** @param {string} what */
export function report(what) {
  console.log(`  REPORT  ${what}`);
}

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads until `done` holds or the tries run out, and returns the last reading. `sleepFirst` waits
 * before each read, for a change the gate just caused; otherwise the first read is immediate.
 *
 * @template T
 * @param {() => Promise<T>} read
 * @param {(value: T) => boolean} done
 * @param {{ tries?: number, everyMs?: number, sleepFirst?: boolean }} [options]
 * @returns {Promise<T>}
 */
export async function pollUntil(read, done, { tries = 25, everyMs = 200, sleepFirst = true } = {}) {
  let value = /** @type {T} */ (/** @type {unknown} */ (undefined));
  for (let i = 0; i < tries; i += 1) {
    if (sleepFirst) await sleep(everyMs);
    value = await read();
    if (done(value)) break;
    if (!sleepFirst) await sleep(everyMs);
  }
  return value;
}

/**
 * Visits each path until one carries `selector`, and leaves the page there.
 *
 * @param {import("puppeteer").Page} target
 * @param {Array<string | null>} paths
 * @param {string} selector
 * @returns {Promise<{ found: string | null, last: string | null }>} the first path carrying it, and the last one visited
 */
export async function firstPathWith(target, paths, selector) {
  /** @type {string | null} */
  let last = null;
  for (const path of paths) {
    await target.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    last = path;
    const has = await target.evaluate((sel) => document.querySelectorAll(sel).length > 0, selector);
    if (has) return { found: path, last };
  }
  return { found: null, last };
}

/**
 * Requests for one enhancement bundle, from the resource timeline rather than the DOM, matched past
 * the content hash.
 *
 * @param {import("puppeteer").Page} target
 * @param {string} stem
 */
export const bundleFetches = (target, stem) =>
  target.evaluate(
    (/** @type {string} */ s) =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => new RegExp(`/assets/${s}-[^/]*\\.js$`).test(entry.name)).length,
    stem,
  );

/* Page functions: each runs inside the page through `evaluate`, so each is self-contained. */

/** The reachable CSS rules; a cross-origin sheet throws on `cssRules` and counts zero. */
export function countCssRules() {
  return [...document.styleSheets].reduce((n, s) => {
    try {
      return n + s.cssRules.length;
    } catch {
      return n;
    }
  }, 0);
}

/**
 * The document's widths and the first four elements reaching past its right edge. Anything left of
 * -1000px is off-screen by design: the skip link, and a closed drawer translated out of view.
 */
export function overflowScan() {
  const doc = document.documentElement;
  const over = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.left < -1000) continue;
    if (r.right > doc.clientWidth + 0.5) {
      const cls = typeof el.className === "string" ? el.className : "";
      over.push(`${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""}@${Math.round(r.right)}`);
    }
  }
  return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over: over.slice(0, 4) };
}

/** Whether the skip link exists, where it points, and whether anything carries that id. */
export function readSkipLink() {
  const link = document.querySelector("a.skip-link");
  if (!link) return { link: false, href: "", target: false };
  const href = link.getAttribute("href") ?? "";
  const id = href.startsWith("#") ? href.slice(1) : "";
  return { link: true, href, target: !!(id && document.getElementById(id)) };
}
