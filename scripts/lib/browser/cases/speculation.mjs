/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok } from "../harness.mjs";

/*
 * Chrome refuses to prerender under CDP, so `activationStart` is always 0: never assert
 * it. The candidate list is Chrome's own reading of the rules.
 */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  const PAGES = ["/", "/blog", "/blog/ten-years-on-cloudflare", "/colophon", "/privacy"];
  /** @type {Map<string, {accepted: boolean, errors: string[], candidates: string[], hrefs: string[], actions: string[], eagerness: string[], blocks: number}>} */
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
      if (event.ruleSet?.errorType) {
        errors.push(`${event.ruleSet.errorType}: ${event.ruleSet.errorMessage ?? ""}`);
      }
    });
    client.on("Preload.preloadingAttemptSourcesUpdated", (event) => {
      for (const source of event.preloadingAttemptSources ?? []) {
        if (!source.key?.url) continue;
        const url = new URL(source.key.url);
        candidates.add(url.pathname + url.search);
      }
    });

    await probe.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    /* The candidate list is computed after the rules are parsed, so it needs
       a window; a zero read too early is not a zero. */
    await new Promise((r) => setTimeout(r, 1200));

    const page = await probe.evaluate(() => {
      const blocks = [...document.querySelectorAll('script[type="speculationrules"]')];
      /** @type {string[]} */
      const eagerness = [];
      /* Harvested rather than looked up under one name, so a changed action shows up as one, not as an empty list. */
      /** @type {string[]} */
      const actions = [];
      for (const block of blocks) {
        try {
          const payload = JSON.parse(block.textContent ?? "{}");
          for (const [action, rules] of Object.entries(payload)) {
            actions.push(action);
            for (const rule of rules ?? []) eagerness.push(rule.eagerness);
          }
        } catch {
          actions.push("UNPARSEABLE");
          eagerness.push("UNPARSEABLE");
        }
      }
      return {
        blocks: blocks.length,
        actions,
        eagerness,
        hrefs: [
          ...new Set(
            [...document.querySelectorAll("a[href]")].map((a) => /** @type {HTMLAnchorElement} */ (a).href),
          ),
        ]
          .filter((href) => href.startsWith(location.origin))
          .map((href) => href.slice(location.origin.length)),
      };
    });
    await context.close();

    seen.set(path, {
      accepted: ruleSets > 0 && errors.length === 0,
      errors,
      candidates: [...candidates],
      ...page,
    });
  }

  for (const path of PAGES) {
    const s = /** @type {NonNullable<ReturnType<typeof seen.get>>} */ (seen.get(path));
    ok(
      `${path}: carries exactly one speculationrules block`,
      s.blocks === 1,
      `found ${s.blocks}. Two blocks on one page are two rule sets competing for ` +
        `one budget, which is what having a site block and a blog block cost; ` +
        `zero means the enhancement is absent and nothing else on the page changes.`,
    );
    ok(
      `${path}: CHROME ACCEPTED the rule set`,
      s.accepted,
      s.errors.length
        ? `Chrome reported ${JSON.stringify(s.errors)}. A rejected rule set renders ` +
          `identically to a good one and speculates nothing.`
        : `no Preload.ruleSetUpdated event at all, so the block never reached the ` +
          `speculation machinery. Under the enforced CSP the usual cause is a ` +
          `script-src without 'inline-speculation-rules'.`,
    );
    ok(
      `${path}: THE ACTION IS PREFETCH`,
      s.actions.length === 1 && s.actions[0] === "prefetch",
      `the payload's actions are ${JSON.stringify(s.actions)}, expected exactly ` +
        `["prefetch"]. It was "prerender" until 2026-08-28, and that is the navigation ` +
        `blink: a prerender that has not painted is still activatable, moderate ` +
        `eagerness starts on pointerdown, and a click with no hover dwell swaps in an ` +
        `empty frame host, so paint holding never runs and the reader gets the themed ` +
        `canvas. Measured on production by screen capture with no CDP, fourteen runs ` +
        `over both themes: every run with prerendering on showed blank frames at 100% ` +
        `of the --paper token with a luma standard deviation of zero, and no run with it ` +
        `off did. Prefetch warms the same credentialed response without creating a ` +
        `frame host to activate.`,
    );
    ok(
      `${path}: ONE rule, at moderate eagerness`,
      s.eagerness.length === 1 && s.eagerness[0] === "moderate",
      `eagerness values are ${JSON.stringify(s.eagerness)}, expected exactly ` +
        `["moderate"]. An "immediate" rule for the header's destinations was built ` +
        `and measured on 2026-08-28 and reverted on Dustin's verdict: it cost 4 to 5 ` +
        `extra credentialed document requests on EVERY public page load, taking origin ` +
        `document requests per page view from one to five or six, because a ` +
        `cookie-carrying reader bypasses the platform cache and each speculation ` +
        `therefore reaches this Worker. Its reappearance is that decision being undone.`,
    );
    ok(
      `${path}: is not a candidate for its own speculation`,
      !s.candidates.includes(path),
      `the page speculates itself. That spends an origin request on a navigation ` +
        `that cannot happen, and can evict a useful candidate from the two-slot ` +
        `moderate budget.`,
    );
  }

  const fromBlog = /** @type {NonNullable<ReturnType<typeof seen.get>>} */ (seen.get("/blog"));
  ok(
    "/blog: the candidate list is non-empty, so the assertions below are about something",
    fromBlog.candidates.length > 0,
    "Chrome resolved no candidates at all. Every exclusion assertion below would " +
      "then pass on an empty set, which is the zero-scope class of the vacuity rule.",
  );
  for (const destination of ["/colophon", "/privacy", "/search", "/blog/ten-years-on-cloudflare"]) {
    ok(
      `/blog: ${destination} is a speculation candidate`,
      fromBlog.candidates.includes(destination),
      `it is not, so a click to it is a cold document load. ${destination} is linked ` +
        `from this page and is a public HTML route, which is exactly the set the ` +
        `document rule exists to cover.`,
    );
  }

  const EXCLUSIONS = [
    {
      label: "a query string",
      matches: (/** @type {string} */ href) => href.includes("?"),
      /*
       * Do not spell the glob here: `stripComments` reads a slash-star in a string as a
       * comment opener, hiding the `ok()` calls after it from any comment-stripping reader.
       */
      why:
        "a filtered view is a database read per variant, and /blog renders one chip " +
        "per tag; speculating them is a crawl of the tag index. The exclusion has to " +
        "name the URLPattern `search` component. A pathname pattern that spells the " +
        "query with a literal question mark reads it as part of the path, and planting " +
        "that spelling resolved ZERO candidates on every page rather than merely " +
        "leaking the queries.",
    },
    {
      label: "a non-page extension",
      matches: (/** @type {string} */ href) => /\.(md|xml|json|txt)(\?|$)/.test(href),
      why:
        "feeds, the sitemap, robots, the llms pair and the .md representation twins are " +
        "not documents a reader navigates to. /blog/rss.xml WAS a candidate under the " +
        "old blog-prefix rule, measured 2026-08-28. The rule is not spelled out here " +
        "for the slash-star reason given above.",
    },
    {
      label: "the login door",
      matches: (/** @type {string} */ href) => href === "/login",
      why: "prerendering a door warms nothing, and it is linked from the header on every page.",
    },
  ];
  for (const exclusion of EXCLUSIONS) {
    const links = fromBlog.hrefs.filter(exclusion.matches);
    ok(
      `/blog renders at least one link with ${exclusion.label}, so the exclusion has a subject`,
      links.length > 0,
      `none found among ${fromBlog.hrefs.length} same-origin links. The assertion below ` +
        `would pass because the page changed, not because the rule works.`,
    );
    const leaked = fromBlog.candidates.filter(exclusion.matches);
    ok(
      `NO CANDIDATE ON /blog CARRIES ${exclusion.label.toUpperCase()}`,
      leaked.length === 0,
      `Chrome resolved ${JSON.stringify(leaked)} as speculation candidates. ${exclusion.why}`,
    );
  }
}
