/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok, skip } from "../harness.mjs";

/**
 * Keep on this device (app/enhance/offline.ts, public/sw.js, docs/KNOWLEDGE-BASE.md A3), in a real browser: a protocol
 * page offers it, keeping registers the worker and stores the page, and with the network cut the page opens again from
 * the device, styled; a page nobody kept does not. Removing the copy leaves no store and no worker behind.
 *
 * @param {import("../harness.mjs").CaseContext} ctx
 */
export async function run({ page, browser }) {
  const path = "/research/protocols/phage-isolation";
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  if (!response || response.status() !== 200) {
    skip("keep a procedure on this device", `${path} answered ${response?.status() ?? "nothing"} on this origin`);
    return;
  }
  const button = await page.$(".procedure-links .offline-keep");
  ok("a procedure page offers to keep it on this device", Boolean(button), "no .offline-keep button in the page's links");
  if (!button) return;
  const before = await page.evaluate(async () => ({ registrations: (await navigator.serviceWorker.getRegistrations()).length, stores: await caches.keys() }));
  ok(
    "nothing is registered or stored before the reader asks",
    before.registrations === 0 && !before.stores.includes("kept-v1"),
    `${before.registrations} worker(s), stores ${JSON.stringify(before.stores)}`,
  );

  await button.click();
  await page.waitForFunction(() => document.querySelector(".offline-keep")?.getAttribute("aria-pressed") === "true", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => navigator.serviceWorker.ready);
  const kept = await page.evaluate(async (p) => {
    const cache = await caches.open("kept-v1");
    const keys = (await cache.keys()).map((r) => new URL(r.url).pathname);
    return { page: keys.includes(p), files: keys.filter((k) => k.startsWith("/assets/")).length, pressed: document.querySelector(".offline-keep")?.getAttribute("aria-pressed") };
  }, path);
  ok(
    "keeping stores the page and the files it uses, and says so",
    kept.page && kept.files > 0 && kept.pressed === "true",
    `page stored ${kept.page}, ${kept.files} file(s) under /assets/, aria-pressed=${kept.pressed}`,
  );

  // The worker controls the next load; then the network goes, for the page and for the worker, whose own fetches the
  // page's offline mode does not reach.
  await page.reload({ waitUntil: "networkidle0" });
  const worker = await browser.waitForTarget((t) => t.type() === "service_worker", { timeout: 15_000 }).catch(() => null);
  const session = worker ? await worker.createCDPSession() : null;
  const cut = (/** @type {boolean} */ offline) =>
    session?.send("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await session?.send("Network.enable");
  ok("keeping registers the offline worker", Boolean(session), "no service_worker target appeared");
  await page.setOfflineMode(true);
  await cut(true);
  try {
    const offline = await page.reload({ waitUntil: "load" }).catch(() => null);
    await page.waitForFunction(() => document.querySelector(".offline-keep")?.getAttribute("aria-pressed") === "true", { timeout: 10_000 }).catch(() => {});
    const drawn = await page
      .evaluate(() => ({
        title: document.querySelector("h1")?.textContent ?? "",
        styled: [...document.styleSheets].reduce((n, s) => n + (s.href ? s.cssRules.length : 0), 0),
        pressed: document.querySelector(".offline-keep")?.getAttribute("aria-pressed"),
      }))
      .catch(() => ({ title: "", styled: 0, pressed: null }));
    ok(
      "with no connection the kept page opens from the device, styled, and still says it is kept",
      Boolean(offline?.fromServiceWorker()) && drawn.title.length > 0 && drawn.styled > 0 && drawn.pressed === "true",
      `from the worker ${offline?.fromServiceWorker() ?? false}, title "${drawn.title}", ${drawn.styled} stylesheet rule(s), aria-pressed=${drawn.pressed}`,
    );
    const elsewhere = await page.goto(`${BASE}/research/protocols/phage-dna-extraction`, { waitUntil: "load" }).then(
      (r) => r?.status() ?? 0,
      () => 0,
    );
    ok("a page nobody kept does not open with no connection", elsewhere === 0, `it answered ${elsewhere}`);
  } finally {
    await page.setOfflineMode(false);
    await cut(false);
    await session?.detach();
  }

  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector(".offline-keep")?.getAttribute("aria-pressed") === "true", { timeout: 15_000 }).catch(() => {});
  await page.click(".procedure-links .offline-keep");
  await page.waitForFunction(() => document.querySelector(".offline-keep")?.getAttribute("aria-pressed") === "false", { timeout: 15_000 }).catch(() => {});
  const after = await page.evaluate(async () => ({ registrations: (await navigator.serviceWorker.getRegistrations()).length, stores: await caches.keys() }));
  ok(
    "removing the last kept page leaves no store and no worker",
    after.registrations === 0 && !after.stores.includes("kept-v1"),
    `${after.registrations} worker(s), stores ${JSON.stringify(after.stores)}`,
  );
}
