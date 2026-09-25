/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok, overflowScan, skip } from "../harness.mjs";
import { MATHLESS_POST_PATH, MATH_PREVIEW_TOKEN } from "../seed.mjs";

/* Page functions: each runs inside the page through `evaluate`, so each is self-contained. */

/** The computed text color of the prose and of its first expression. */
function readMathColours() {
  const prose = document.querySelector(".prose");
  const katex = document.querySelector(".prose .katex");
  return {
    prose: prose ? getComputedStyle(prose).color : null,
    katex: katex ? getComputedStyle(katex).color : null,
  };
}

/** Every linked stylesheet's href, in document order. */
function stylesheetHrefs() {
  return [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href") ?? "");
}

/**
 * @param {import("../harness.mjs").CaseContext} ctx
 * @param {boolean} mathPreviewSeeded whether the preview run seeded the fixture and its token
 */
export async function run({ page }, mathPreviewSeeded) {
  /* Paired controls: the box must really overflow and the sheet be linked. */
  if (!mathPreviewSeeded) {
    skip(
      "the math page cases",
      `they need a seeded draft row and preview token in local storage, which only the ` +
        `preview-driving mode writes. Under PUBLIC_ORIGIN the fixture is unpublished on ` +
        `the deployed site and nothing here may publish it.`,
    );
  } else {
    const MATH_PATH = `/preview/${MATH_PREVIEW_TOKEN}`;
    const NARROW_MATH = 375;

    await page.setViewport({ width: NARROW_MATH, height: 800 });
    const response = await page.goto(`${BASE}${MATH_PATH}`, { waitUntil: "networkidle0" });

    /* Every refusal is the same 404, so the door is asserted open first. */
    ok(
      `${MATH_PATH}: the preview door opened`,
      response?.status() === 200,
      `the preview answered ${response?.status()}. That route returns one 404 for every ` +
        `refusal, so this is a seed problem: either the KV record is missing, or the row ` +
        `is not a draft, or the slugs disagree.`,
    );

    /* React 19 `precedence` hoists the sheet above the color-scheme meta. */
    const order = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const head = html.slice(0, html.indexOf("</head>"));
      return { meta: head.indexOf("color-scheme"), sheet: head.indexOf('rel="stylesheet"') };
    });
    ok(
      `${MATH_PATH}: the color scheme is declared before the first stylesheet`,
      order.meta >= 0 && order.sheet >= 0 && order.meta < order.sheet,
      `color-scheme at ${order.meta}, first stylesheet at ${order.sheet}. A signal that ` +
        `arrives after the stylesheet has been requested arrived too late to matter. A ` +
        `React "precedence" attribute on the math link puts it above the meta.`,
    );

    const scan = await page.evaluate(overflowScan);
    const colours = await page.evaluate(readMathColours);
    const sheets = await page.evaluate(stylesheetHrefs);
    const rendered = await page.evaluate(() => {
      const displays = [...document.querySelectorAll(".prose .katex-display")];
      const widest = displays
        .map((el) => ({
          scroll: el.scrollWidth,
          client: el.clientWidth,
          overflowX: getComputedStyle(el).overflowX,
        }))
        .sort((a, b) => b.scroll - b.client - (a.scroll - a.client))[0];
      return {
        expressions: document.querySelectorAll(".prose .katex").length,
        mathml: document.querySelectorAll(".prose .katex-mathml math").length,
        errors: document.querySelectorAll(".katex-error").length,
        displays: displays.length,
        widest: widest ?? null,
      };
    });
    const math = {
      ...rendered,
      ...scan,
      sheets,
      proseColour: colours.prose,
      katexColour: colours.katex,
    };

    ok(
      `${MATH_PATH}: the page renders expressions and no error box`,
      math.expressions >= 15 && math.displays >= 4 && math.errors === 0,
      `${math.expressions} .katex element(s), ${math.displays} display block(s), ` +
        `${math.errors} error box(es). The fixture carries 17 expressions in 4 display ` +
        `blocks; fewer means the render changed and every measurement below is about a ` +
        `different page, and an error box means an expression got past remarkMathValidate.`,
    );
    ok(
      `${MATH_PATH}: every expression carries its MathML, not the layout tree alone`,
      math.mathml >= 15,
      `${math.mathml} <math> element(s) against ${math.expressions} expression(s). The ` +
        `output mode has dropped to html-only and a screen reader is getting the ` +
        `positioning spans, which are aria-hidden, and therefore nothing.`,
    );
    ok(
      `${MATH_PATH}: the document links the math stylesheet`,
      math.sheets.some((href) => href.includes("katex")),
      `stylesheets on the page: ${math.sheets.join(", ") || "none"}. root.tsx links it ` +
        `from the loader's hasMath; without it every equation renders in the body font ` +
        `with no positioning, which still does not scroll and would pass the case below.`,
    );

    ok(
      `${MATH_PATH}: a display equation really is wider than its own box`,
      Boolean(math.widest) && math.widest.scroll > math.widest.client,
      `the widest display block measures scrollWidth ${math.widest?.scroll} against ` +
        `clientWidth ${math.widest?.client} at ${NARROW_MATH}px. Nothing overflows, so ` +
        `"the page does not scroll sideways" is true of this page for a reason that has ` +
        `nothing to do with the container.`,
    );
    ok(
      `${MATH_PATH}: the display block is the thing that scrolls`,
      math.widest?.overflowX === "auto" || math.widest?.overflowX === "scroll",
      `.katex-display computes overflow-x: ${math.widest?.overflowX}. The rule is in ` +
        `app/styles/katex-overrides.css and rides in the generated stylesheet.`,
    );
    ok(
      `${MATH_PATH}: no horizontal scroll at ${NARROW_MATH}px`,
      math.scrollW <= math.clientW,
      `scrollWidth ${math.scrollW} exceeds clientWidth ${math.clientW} by ` +
        `${math.scrollW - math.clientW}px. Widest: ${math.over.join(", ") || "(nothing " +
          "measured wider than the viewport, so it is on an element this scan skipped)"}`,
    );

    /* KaTeX declares no color, so it must compute to the `.prose` color. */
    ok(
      `${MATH_PATH}: maths takes the prose color rather than declaring one`,
      math.katexColour !== null && math.katexColour === math.proseColour,
      `.katex computes ${math.katexColour} and .prose computes ${math.proseColour}. A ` +
        `declared color would survive a theme change and break both of them.`,
    );

    /* Through CDP: puppeteer's `emulateMediaFeatures` rejects `forced-colors`. */
    const emulation = await page.createCDPSession();
    for (const mode of [
      { label: "dark", cookie: "dark", features: [] },
      {
        label: "forced-colors",
        cookie: null,
        features: [{ name: "forced-colors", value: "active" }],
      },
    ]) {
      if (mode.cookie) {
        await page.setCookie({ url: BASE, name: "theme", value: mode.cookie, path: "/" });
      }
      if (mode.features.length > 0) {
        await emulation.send("Emulation.setEmulatedMedia", { features: mode.features });
      }
      await page.goto(`${BASE}${MATH_PATH}`, { waitUntil: "networkidle0" });
      const colours = await page.evaluate(readMathColours);
      ok(
        `${MATH_PATH}: maths still takes the prose color under ${mode.label}`,
        colours.katex !== null && colours.katex === colours.prose,
        `.katex computes ${colours.katex} and .prose computes ${colours.prose} under ` +
          `${mode.label}. The two must move together, because that is what makes ` +
          `check:contrast's thresholds cover the maths without restating one.`,
      );
    }
    await emulation.send("Emulation.setEmulatedMedia", { features: [] });
    await emulation.detach();
    await page.deleteCookie({ url: BASE, name: "theme", path: "/" });

    await page.goto(`${BASE}${MATHLESS_POST_PATH}`, { waitUntil: "networkidle0" });
    const mathless = {
      sheets: await page.evaluate(stylesheetHrefs),
      expressions: await page.evaluate(() => document.querySelectorAll(".katex").length),
    };
    ok(
      `${MATHLESS_POST_PATH}: a post with no maths links no math stylesheet`,
      !mathless.sheets.some((href) => href.includes("katex")) && mathless.expressions === 0,
      `stylesheets: ${mathless.sheets.join(", ")}, .katex elements: ` +
        `${mathless.expressions}. Twelve of the thirteen posts have no expression in ` +
        `them and must pay nothing for the one that does.`,
    );
  }
}
