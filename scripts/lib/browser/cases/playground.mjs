/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BASE, ok, root } from "../harness.mjs";

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ page }) {
  /* check:features cannot see the transport, such as the Worker's WASM instantiator. */
  await page.setViewport({ width: 1280, height: 900 });
  {
    const manifest = JSON.parse(
      readFileSync(join(root, "content", "playground.json"), "utf8"),
    );

    const visibleText = async () =>
      (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");

    await page.goto(`${BASE}/playground`, { waitUntil: "networkidle0" });
    const sections = await page.evaluate(() =>
      [...document.querySelectorAll("section.playground-demo")].map((s) => s.id),
    );
    const declared = manifest.demos.map((/** @type {any} */ d) => `demo-${d.slug}`);
    /* Each list below is looped over; an emptied one would pass every loop by running none. */
    for (const [name, list] of [
      ["demos", manifest.demos],
      ["cookiePresets", manifest.cookiePresets],
      ["markdownSnippets", manifest.markdownSnippets],
    ]) {
      ok(
        `content/playground.json lists ${name} to drive`,
        Array.isArray(list) && list.length > 0,
        `${name} is ${JSON.stringify(list)}, so the cases that loop over it would assert nothing`,
      );
    }
    ok(
      "/playground renders a section for every demo in the manifest",
      declared.every((/** @type {string} */ id) => sections.includes(id)),
      `manifest: ${declared.join(", ")}; rendered: ${sections.join(", ") || "none"}`,
    );

    const keyPreset = manifest.keyPresets.find(
      (/** @type {any} */ p) => p.expect?.dimensions !== null && p.expect?.contentKey === true,
    );
    ok(
      "the key demo has a dimension-bearing preset to drive",
      Boolean(keyPreset),
      "without one this case would assert nothing and still pass",
    );
    if (keyPreset) {
      await page.goto(`${BASE}/playground?key=${encodeURIComponent(keyPreset.key)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();
      ok(
        "the key demo answers with the digest the grammar carries",
        text.includes(keyPreset.expect.digest),
        `expected ${keyPreset.expect.digest} in the rendered page`,
      );
      const [w, h] = String(keyPreset.expect.dimensions).split("x");
      ok(
        "the key demo answers with the intrinsic dimensions",
        text.includes(`${w} by ${h}`),
        `expected "${w} by ${h}" in the rendered page`,
      );
      ok(
        "the key demo answers with the storage tier",
        text.includes(keyPreset.expect.storage),
        `expected ${keyPreset.expect.storage} in the rendered page`,
      );
    }

    /* A caught throw that renders nothing looks like a working page. */
    const refusedPreset = manifest.keyPresets.find(
      (/** @type {any} */ p) => p.expect?.kind === "refused",
    );
    ok("the key demo has a refusal preset to drive", Boolean(refusedPreset));
    if (refusedPreset) {
      await page.goto(`${BASE}/playground?key=${encodeURIComponent(refusedPreset.key)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();
      ok(
        "the key demo renders the classifier's refusal rather than a blank",
        text.includes("unclassified asset"),
        "the throw was caught and nothing was shown, which is the one failure " +
          "mode a source-reading gate cannot see",
      );
    }

    for (const preset of manifest.cookiePresets) {
      await page.goto(`${BASE}/playground?cookie=${encodeURIComponent(preset.cookie)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();
      /* "system" appears in prose; "omitted" appears only in this row. */
      const expected = preset.expect.attribute ?? "omitted";
      ok(
        `the theme demo answers ${JSON.stringify(preset.cookie)} with ${expected}`,
        text.includes(`data-theme ${expected}`),
        `expected the data-theme row to read ${expected}`,
      );
    }

    /* workerd refuses `WebAssembly.instantiate()` on raw bytes; only a Worker sees this. */
    let tocAnchorsChecked = 0;
    for (const snippet of manifest.markdownSnippets) {
      await page.goto(`${BASE}/playground?md=${encodeURIComponent(snippet.slug)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();

      if (snippet.expect.throws) {
        ok(
          `the markdown demo refuses "${snippet.slug}" by name`,
          text.includes("unknown directive"),
          "the pipeline's named refusal is the branch a published article can " +
            "never show, so this is the only place it is observable",
        );
        continue;
      }

      for (const anchor of snippet.expect.toc) {
        tocAnchorsChecked += 1;
        ok(
          `the markdown demo reports the "${anchor}" anchor it collected`,
          text.includes(anchor),
          `expected ${anchor} among the collected heading anchors`,
        );
      }

      /* Shiki's token spans are absent when the WASM module failed. */
      if (snippet.source.includes("```")) {
        const highlighted = await page.evaluate(
          () => document.querySelectorAll(".playground-rendered pre.shiki span[style]").length,
        );
        ok(
          `the markdown demo highlights "${snippet.slug}" in the Worker`,
          highlighted > 0,
          "no shiki token spans in the rendered pane. The Worker could not " +
            "instantiate the oniguruma module, which the Node-side gate cannot see.",
        );
      }

      if (snippet.expect.blockedCount > 0) {
        const liveHrefs = await page.evaluate(() =>
          [...document.querySelectorAll(".playground-rendered a")].map((a) =>
            a.getAttribute("href"),
          ),
        );
        /* A pane that rendered nothing has no refused link either; the allowed ones must be there. */
        const allowed = (snippet.source.match(/\]\(/g) ?? []).length - snippet.expect.blockedCount;
        ok(
          `the markdown demo renders the ${allowed} link(s) it allows`,
          liveHrefs.length >= allowed,
          `rendered ${liveHrefs.length} anchor(s): ${liveHrefs.join(", ") || "none"}`,
        );
        ok(
          `the markdown demo emits no refused protocol as a live link`,
          liveHrefs.every((/** @type {string | null} */ href) => !/^javascript:/i.test(href ?? "")),
          `rendered hrefs: ${liveHrefs.join(", ")}`,
        );
      }
    }
    ok(
      "the markdown demo checked at least one collected heading anchor",
      tocAnchorsChecked > 0,
      "no snippet in content/playground.json expects a toc, so the anchor case asserted nothing",
    );
  }
}
