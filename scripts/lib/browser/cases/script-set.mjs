/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { ENHANCE_LOADER } from "../../../../app/lib/enhance-loader.mjs";
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
      srcs: [...document.querySelectorAll("script[src]")].map(
        (s) => s.getAttribute("src") ?? "",
      ),
      /* Resolved as the loader resolves them, since it sets `src` to the absolute URL. */
      markers: [...document.querySelectorAll("template[data-enhance]")].map(
        (t) => new URL(t.getAttribute("data-enhance") ?? "", location.href).href,
      ),
      /* Executable inline scripts: JSON-LD and speculation rules are data, not script. */
      inline: [...document.querySelectorAll("script:not([src])")]
        .filter((s) => !["application/ld+json", "speculationrules"].includes(s.getAttribute("type") ?? ""))
        .map((s) => s.textContent ?? ""),
      /* hasAttribute, because a browser hides a nonce's value from getAttribute. */
      nonced: document.querySelectorAll("[nonce]").length,
    }));
    /* Enhancement bundles only: whatever else a page loads is not the loader's to insert. */
    const bundles = shape.srcs.filter((src) => {
      const name = src.split("/").pop() ?? "";
      const stem = name.replace(/-[A-Za-z0-9_-]{8}\.js$/, "");
      return enhanceStems.has(stem);
    });
    ok(
      `${path}: the loader inserted exactly the bundles the markers name`,
      shape.markers.length > 0 &&
        JSON.stringify([...new Set(shape.markers)].sort()) === JSON.stringify([...bundles].sort()),
      `markers [${shape.markers.join(", ")}], enhancement scripts [${bundles.join(", ")}]. No ` +
        `marker means the enhancement tags vanished; a marker with no script means the loader ` +
        `did not run or was refused by the policy.`,
    );
    ok(
      `${path}: the one executable inline script is the loader, and nothing carries a nonce`,
      shape.inline.length === 1 && shape.inline[0] === ENHANCE_LOADER && shape.nonced === 0,
      `${shape.inline.length} inline script(s), ${shape.nonced} nonced element(s). The public ` +
        `policy allows the loader by hash and nothing else inline, and a nonce on a cached ` +
        `page is shared by every reader.`,
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
