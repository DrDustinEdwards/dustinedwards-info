/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// A script-carrying object served from /media does not run: the sandboxed media policy
// (MEDIA_CSP in workers/csp.mjs) stops it, observed in a real browser rather than read off a header.

import { MEDIA_CSP } from "../../../../workers/csp.mjs";
import { BASE, DRIVES_PREVIEW, FETCH_TIMEOUT_MS, ok, skip } from "../harness.mjs";
import { MEDIA_SCRIPT_MARKER, MEDIA_SCRIPT_SENTINEL, MEDIA_SEEDS } from "../seed.mjs";

/**
 * Opens `key` in its own page and reports whether the stored script ran. `strip` names the response
 * headers removed on the way in, through a CDP interception that keeps every other header: the
 * content-disposition, because a stored SVG is an attachment and Chrome would download it instead
 * of rendering it, and for the control run the policy itself.
 *
 * @param {import("puppeteer").Browser} browser
 * @param {string} key
 * @param {string[]} strip lower-case header names
 */
async function visit(browser, key, strip) {
  const tab = await browser.newPage();
  const seen = { dialogs: 0, sentinel: 0, marker: false, rendered: "", policy: "", nosniff: "" };
  try {
    tab.on("dialog", (dialog) => {
      seen.dialogs += 1;
      void dialog.dismiss();
    });
    tab.on("request", (request) => {
      if (request.url().includes(MEDIA_SCRIPT_SENTINEL)) seen.sentinel += 1;
    });

    const cdp = await tab.createCDPSession();
    await cdp.send("Fetch.enable", {
      patterns: [{ urlPattern: `*/media/${key}*`, requestStage: "Response" }],
    });
    cdp.on("Fetch.requestPaused", (event) => {
      void (async () => {
        const headers = event.responseHeaders ?? [];
        seen.policy = headers.find((h) => h.name.toLowerCase() === "content-security-policy")?.value ?? "";
        seen.nosniff = headers.find((h) => h.name.toLowerCase() === "x-content-type-options")?.value ?? "";
        const { body, base64Encoded } = await cdp.send("Fetch.getResponseBody", { requestId: event.requestId });
        await cdp.send("Fetch.fulfillRequest", {
          requestId: event.requestId,
          responseCode: event.responseStatusCode ?? 200,
          responseHeaders: headers.filter((h) => !strip.includes(h.name.toLowerCase())),
          body: base64Encoded ? body : Buffer.from(body).toString("base64"),
        });
      })().catch((error) => {
        console.error(`  media-svg: interception of ${key} failed: ${error}`);
      });
    });

    // `load`, not `networkidle0`: an intercepted response never reads as finished to puppeteer's
    // idle tracker, so that wait times out. The settle gives a script that did run time to fetch.
    await tab.goto(`${BASE}/media/${key}`, { waitUntil: "load", timeout: FETCH_TIMEOUT_MS });
    await new Promise((r) => setTimeout(r, 500));
    const state = await tab.evaluate(
      (marker) => ({
        marker: document.documentElement.hasAttribute(marker),
        rendered: document.documentElement.namespaceURI === "http://www.w3.org/2000/svg"
          ? "svg"
          : document.documentElement.localName,
      }),
      MEDIA_SCRIPT_MARKER,
    );
    seen.marker = state.marker;
    seen.rendered = state.rendered;
  } finally {
    await tab.close();
  }
  return seen;
}

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  if (!DRIVES_PREVIEW) {
    skip(
      "a script-carrying object from /media does not run",
      "the objects are seeded into the LOCAL bucket, and a deployed origin's MEDIA bucket is " +
        "irreplaceable and is not written by a gate. The policy on a deployed origin is still " +
        "asserted by check:headers and test/worker/media-csp.test.ts.",
    );
    return;
  }

  const { svg, html, png } = MEDIA_SEEDS;

  /* THE CONTROL: with the policy stripped too, the same bytes DO run, so a pass below is not a
     detector that sees nothing. */
  const control = await visit(browser, svg.key, ["content-disposition", "content-security-policy"]);
  ok(
    "media: with the policy stripped, the seeded SVG's script runs (the detector works)",
    control.rendered === "svg" && control.marker && control.sentinel > 0,
    `rendered ${JSON.stringify(control.rendered)}, marker ${control.marker}, sentinel ` +
      `request(s) ${control.sentinel}. The control did not observe the script, so the ` +
      `sandbox assertions below would pass on a detector that sees nothing.`,
  );

  for (const [label, seed, strip] of /** @type {const} */ ([
    ["an SVG opened directly", svg, ["content-disposition"]],
    ["stored HTML opened directly", html, []],
  ])) {
    const seen = await visit(browser, seed.key, [...strip]);
    ok(
      `media: ${label} carries the media policy and nosniff`,
      seen.policy === MEDIA_CSP && seen.nosniff === "nosniff",
      `content-security-policy ${JSON.stringify(seen.policy)}, x-content-type-options ` +
        `${JSON.stringify(seen.nosniff)}`,
    );
    ok(
      `media: ${label} renders and its script does not run`,
      seen.rendered !== "" && !seen.marker && seen.sentinel === 0 && seen.dialogs === 0,
      `rendered ${JSON.stringify(seen.rendered)}, marker ${seen.marker}, sentinel request(s) ` +
        `${seen.sentinel}, dialog(s) ${seen.dialogs}. A stored object ran script as this site.`,
    );
  }

  /* The policy must not break images: opened directly (the browser's image viewer) and embedded. */
  const viewer = await browser.newPage();
  let direct = { width: 0, policy: "" };
  let embedded = 0;
  try {
    const response = await viewer.goto(`${BASE}/media/${png.key}`, {
      waitUntil: "networkidle0",
      timeout: FETCH_TIMEOUT_MS,
    });
    direct = {
      policy: response?.headers()["content-security-policy"] ?? "",
      width: await viewer.evaluate(() => {
        const img = document.querySelector("img");
        return img instanceof HTMLImageElement && img.complete ? img.naturalWidth : 0;
      }),
    };

    await viewer.goto(`${BASE}/writing`, { waitUntil: "networkidle0", timeout: FETCH_TIMEOUT_MS });
    embedded = await viewer.evaluate(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth);
          img.onerror = () => resolve(0);
          img.src = src;
        }),
      `/media/${png.key}`,
    );
  } finally {
    await viewer.close();
  }
  ok(
    "media: a raster opened directly renders in the image viewer under the media policy",
    direct.policy === MEDIA_CSP && direct.width === 1,
    `policy ${JSON.stringify(direct.policy)}, the viewer's image naturalWidth ${direct.width}. ` +
      `The sandbox or default-src 'none' broke the browser's own image viewer.`,
  );
  ok(
    "media: a raster embedded in a page still loads",
    embedded === 1,
    `an <img> of /media/${png.key} on /writing loaded with naturalWidth ${embedded}`,
  );
}
