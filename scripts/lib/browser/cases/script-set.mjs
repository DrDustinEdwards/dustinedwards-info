/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok } from "../harness.mjs";

/**
 * @param {import("../harness.mjs").CaseContext} ctx
 * @param {{ postForShape: string | null, enhanceStems: Set<string>, publicConsoleErrors: string[] }} carried
 */
export async function run({ page }, { postForShape, enhanceStems, publicConsoleErrors }) {
  /* Never clicked: clicking bills. `data-ask-bound` is the bundle's own idempotence marker. */
  await page.goto(`${BASE}/search?q=how+does+search+work`, { waitUntil: "networkidle0" });
  const askState = await page.evaluate(() => {
    const trigger = document.querySelector("[data-ask-trigger]");
    if (!(trigger instanceof HTMLElement)) return { present: false, visible: false, bound: false };
    return { present: true, visible: !trigger.hidden, bound: trigger.dataset.askBound === "true" };
  });
  ok(
    "the Ask trigger is server-rendered, unhidden and bound",
    askState.present && askState.visible && askState.bound,
    `present ${askState.present}, visible ${askState.visible}, bound ${askState.bound}. ` +
      `Absent means search.tsx stopped rendering the mount (or Ask is unbound on this ` +
      `deployment); hidden or unbound means the ask bundle did not run.`,
  );

  for (const path of ["/", postForShape, "/search?q=workers"].filter(Boolean)) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const shape = await page.evaluate(() => ({
      /* Same-origin only: the edge injects the approved analytics beacon from its own host. */
      srcs: [...document.querySelectorAll("script[src]")]
        .map((s) => new URL(s.getAttribute("src") ?? "", location.href))
        .filter((u) => u.origin === location.origin)
        .map((u) => u.pathname),
      /* The page's island markers, read by tag so this case is not a loader of its own (devkit's family check). */
      markers: [...document.getElementsByTagName("template")]
        .filter((t) => t.hasAttribute("data-island"))
        .map((t) => t.getAttribute("data-island") ?? ""),
      /* startIslands marks each island it ran (devkit ./islands). */
      ready: [...document.getElementsByTagName("template")]
        .filter((t) => t.hasAttribute("data-island-ready"))
        .map((t) => t.getAttribute("data-island") ?? ""),
      /* The islands imported, from the resource timeline, past the content hash. */
      loaded: performance
        .getEntriesByType("resource")
        .map((e) => /\/islands\/([a-z][a-z0-9-]*)-[A-Za-z0-9_-]{8}\.js$/.exec(new URL(e.name).pathname)?.[1] ?? "")
        .filter(Boolean),
      /* Executable inline scripts: JSON-LD is data, not script. */
      inline: [...document.querySelectorAll("script:not([src])")]
        .filter((s) => (s.getAttribute("type") ?? "") !== "application/ld+json")
        .map((s) => s.textContent ?? ""),
      /* hasAttribute, because a browser hides a nonce's value from getAttribute. */
      nonced: document.querySelectorAll("[nonce]").length,
    }));
    const named = [...new Set(shape.markers)].filter((name) => enhanceStems.has(name)).sort();
    ok(
      `${path}: /site.js started exactly the islands the markers name`,
      named.length > 0 &&
        JSON.stringify([...new Set(shape.ready)].sort()) === JSON.stringify(named) &&
        JSON.stringify([...new Set(shape.loaded)].sort()) === JSON.stringify(named),
      `markers [${named.join(", ")}], started [${shape.ready.join(", ")}], imported [${shape.loaded.join(", ")}]. ` +
        `No marker means the island tags vanished; a marker never started means /site.js did not run, was ` +
        `refused by the policy, or the island threw.`,
    );
    ok(
      `${path}: the one same-origin script is /site.js, nothing runs inline, and nothing carries a nonce`,
      JSON.stringify(shape.srcs) === JSON.stringify(["/site.js"]) && shape.inline.length === 0 && shape.nonced === 0,
      `scripts [${shape.srcs.join(", ")}], ${shape.inline.length} inline script(s), ${shape.nonced} nonced element(s). ` +
        `The public policy allows same-origin files and nothing inline, and a nonce on a cached page is shared ` +
        `by every reader.`,
    );
  }

  ok(
    "no console errors across the public enhancement cases",
    publicConsoleErrors.length === 0,
    `${publicConsoleErrors.length} error(s):\n        ${publicConsoleErrors
      .slice(0, 5)
      .join("\n        ")}`,
  );
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
}
