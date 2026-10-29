/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { SPECULATION_RULES_HEADER } from "@dustinedwards/site-runtime/prefetch";

import { BASE, ok } from "../harness.mjs";

/*
 * Hover prefetch (site-runtime ./prefetch): every public page names one rules file in its response header, and
 * the rules are the package's, tested there. This holds the site to its half: the header is on the page, Chrome
 * accepts the file under the enforced policy, and the site's own exclusions hold. The candidate list is Chrome's
 * own reading of the rules. Chrome refuses to prerender under CDP, so `activationStart` is always 0: never assert it.
 * The rules are one file for every page, so a page's links to itself are candidates too: a hover there costs one
 * cached document request, where the old per-page inline rule excluded the page's own path.
 */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  const PAGES = ["/", "/writing", "/colophon"];
  /** @type {Map<string, {header: string, accepted: boolean, errors: string[], candidates: string[], hrefs: string[]}>} */
  const seen = new Map();

  for (const path of PAGES) {
    const context = await browser.createBrowserContext();
    const probe = await context.newPage();
    await probe.setViewport({ width: 1280, height: 900 });
    const client = await probe.createCDPSession();
    await client.send("Preload.enable");

    /** @type {string[]} */
    const errors = [];
    let ruleSets = 0;
    /** @type {Set<string>} */
    const candidates = new Set();
    client.on("Preload.ruleSetUpdated", (event) => {
      ruleSets += 1;
      if (event.ruleSet?.errorType) errors.push(`${event.ruleSet.errorType}: ${event.ruleSet.errorMessage ?? ""}`);
    });
    client.on("Preload.preloadingAttemptSourcesUpdated", (event) => {
      for (const source of event.preloadingAttemptSources ?? []) {
        if (!source.key?.url) continue;
        const url = new URL(source.key.url);
        candidates.add(url.pathname + url.search);
      }
    });

    const response = await probe.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const header = response?.headers()[SPECULATION_RULES_HEADER.name.toLowerCase()] ?? "";
    /* The candidate list is computed after the rules file arrives, so it needs a window; a zero read too early is not a zero. */
    await new Promise((r) => setTimeout(r, 1200));
    const hrefs = await probe.evaluate(() =>
      [...new Set([...document.querySelectorAll("a[href]")].map((a) => /** @type {HTMLAnchorElement} */ (a).href))]
        .filter((href) => href.startsWith(location.origin))
        .map((href) => href.slice(location.origin.length)),
    );
    await context.close();
    seen.set(path, { header, accepted: ruleSets > 0 && errors.length === 0, errors, candidates: [...candidates], hrefs });
  }

  for (const path of PAGES) {
    const s = /** @type {NonNullable<ReturnType<typeof seen.get>>} */ (seen.get(path));
    ok(
      `${path}: names the prefetch rules in its ${SPECULATION_RULES_HEADER.name} header`,
      s.header === SPECULATION_RULES_HEADER.value,
      `got ${JSON.stringify(s.header)}. Without it the page prefetches nothing and renders exactly the same.`,
    );
    ok(
      `${path}: CHROME ACCEPTED the rule set`,
      s.accepted,
      s.errors.length
        ? `Chrome reported ${JSON.stringify(s.errors)}. A rejected rule set renders identically to a good one and prefetches nothing.`
        : "no Preload.ruleSetUpdated event at all, so the rules file never reached the speculation machinery.",
    );
  }

  const fromBlog = /** @type {NonNullable<ReturnType<typeof seen.get>>} */ (seen.get("/writing"));
  ok(
    "/writing: the candidate list is non-empty, so the assertions below are about something",
    fromBlog.candidates.length > 0,
    "Chrome resolved no candidates at all, and every exclusion below would pass on an empty set.",
  );
  for (const destination of ["/colophon", "/privacy"]) {
    ok(
      `/writing: ${destination} is a prefetch candidate`,
      fromBlog.candidates.includes(destination),
      `it is not, so a click to it is a cold document load. ${destination} is linked from this page and is a public page.`,
    );
  }

  const EXCLUSIONS = [
    {
      label: "a query string",
      matches: (/** @type {string} */ href) => href.includes("?"),
      why: "a filtered view is a database read per variant, and /writing renders one chip per tag.",
    },
    {
      label: "a file extension",
      matches: (/** @type {string} */ href) => /\.(md|xml|json|txt)(\?|$)/.test(href),
      why: "feeds, the sitemap, robots, the llms pair and the .md twins are files, not pages a reader navigates to.",
    },
    {
      label: "the admin door",
      matches: (/** @type {string} */ href) => href === "/admin",
      why: "prefetching a door warms nothing, and it is linked from the footer on every page.",
    },
  ];
  for (const exclusion of EXCLUSIONS) {
    const links = fromBlog.hrefs.filter(exclusion.matches);
    ok(
      `/writing renders at least one link with ${exclusion.label}, so the exclusion has a subject`,
      links.length > 0,
      `none found among ${fromBlog.hrefs.length} same-origin links; the assertion below would pass because the page changed.`,
    );
    const leaked = fromBlog.candidates.filter(exclusion.matches);
    ok(
      `NO CANDIDATE ON /writing CARRIES ${exclusion.label.toUpperCase()}`,
      leaked.length === 0,
      `Chrome resolved ${JSON.stringify(leaked)} as prefetch candidates. ${exclusion.why}`,
    );
  }
}
