// The retired paths, the roster page, the colophon, and the colophon's search coverage.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { COLOPHON_SECTIONS } from "../../../app/lib/colophon-sections.mjs";
import { colophonFacts } from "../colophon-facts.mjs";
import { check, get, ORIGIN, root, SLUG, strip, unescape } from "./client.mjs";

/* Read, not restated. Not an import attribute: this tsconfig rejects it. */
const stack = JSON.parse(
  readFileSync(join(root, "content", "generated", "stack.json"), "utf8"),
);
const features = JSON.parse(
  readFileSync(join(root, "content", "features.json"), "utf8"),
);

export async function run() {
  {
    // Never a prefix rule: /publications/* and /phage-hunters/* are kept files.
    for (const path of ["/research", "/publications", "/teaching", "/phage-hunters"]) {
      const { status } = await get(path);
      check(`retired: ${path} is a bare 404`, status === 404, `got ${status}`);
    }
  }

  {
    const { status, text } = await get("/phage-discovery");
    check("roster: /phage-discovery returns 200", status === 200, `got ${status}`);

    const page = strip(text);

    /* Delimited: the nav renders `Roster` on every page. */
    check(
      "roster: the page's own heading says Roster",
      />Roster<\/h1>/.test(page),
      "the <h1> is missing or renamed; the nav link alone must not satisfy this",
    );

    const years = Array.from({ length: 9 }, (_, i) => 2017 + i);
    const missing = years.filter((y) => !page.includes(`id="year-${y}"`));
    check(
      `roster: all nine ids year-2017 through year-2025 are present`,
      missing.length === 0,
      missing.length > 0 ? `missing ${missing.map((y) => `year-${y}`).join(", ")}` : "",
    );
    // Count what was found, so "0 missing" cannot mean "0 examined".
    const found = years.length - missing.length;
    check(
      "roster: nine year ids were actually examined",
      found === 9 && page.length > 500,
      `found ${found} of ${years.length} year ids, page ${page.length} bytes`,
    );

    const home = await get("/");
    check(
      "roster: the homepage links to /phage-discovery",
      strip(home.text).includes('href="/phage-discovery"'),
      `home ${home.status}`,
    );
  }

  {
    const { status, text } = await get("/colophon");
    check("colophon: /colophon returns 200", status === 200, `got ${status}`);

    const page = unescape(strip(text));

    // Title and path deliberately differ.
    check(
      "colophon: the h1 reads How this site is built",
      /<h1[^>]*>How this site is built<\/h1>/.test(page),
      `h1 not found in ${page.length} bytes`,
    );

    const bindingsShown = stack.bindings.filter((/** @type {any} */ b) =>
      page.includes(`>${b.name}<`),
    ).length;
    check(
      "colophon: every binding in the artifact is on the page",
      bindingsShown === stack.bindings.length && bindingsShown > 0,
      `${bindingsShown} of ${stack.bindings.length} binding names found`,
    );

    /* Delimited: many feature names are ordinary sentences. */
    const featuresShown = features.features.filter((/** @type {any} */ f) =>
      page.includes(`>${f.name}<`),
    ).length;
    check(
      "colophon: every feature in the anchors file is on the page",
      featuresShown === features.features.length && featuresShown > 0,
      `${featuresShown} of ${features.features.length} feature names found`,
    );

    // From another page, so the site-wide footer carries it.
    const home = await get("/");
    check(
      "colophon: the footer links to /colophon",
      strip(home.text).includes('href="/colophon"'),
      `home ${home.status}`,
    );

    const sitemap = await get("/sitemap.xml");
    check(
      "colophon: /colophon is in the sitemap",
      sitemap.text.includes(`${ORIGIN}/colophon<`),
      `sitemap ${sitemap.status}, ${sitemap.text.length} bytes`,
    );

    // Served from D1, so this catches a sync that never ran.
    const llms = await get("/llms.txt");
    check(
      "colophon: the live llms.txt mentions /colophon",
      llms.text.includes("/colophon"),
      `llms.txt ${llms.status}, ${llms.text.length} bytes. ` +
        `If this fails, sync:content -- --remote has not run since the file changed.`,
    );

    const post = await get(`/blog/${SLUG}`);
    check(
      "colophon: a post links to /colophon in its footer line",
      strip(post.text).includes('href="/colophon"'),
      `post ${post.status}`,
    );
  }

  {
    /**
     * A section's slice, heading to heading; unscoped tokens match `<head>`.
     *
     * @param {string} html @param {string} id
     */
    const sectionRegion = (html, id) => {
      const start = html.indexOf(`<h2 id="${id}"`);
      if (start === -1) return "";
      const next = html.indexOf('<h2 id="', start + 1);
      return html.slice(start, next === -1 ? html.length : next);
    };

    /**
     * Authored apart from `colophonPageInput`; that module's header says why.
     *
     * @param {string} id
     * @returns {string[]}
     */
    const factsFor = (id) => colophonFacts(stack, features, id);

    /** Unique to the colophon after porter stemming (`Vectorize` becomes `vector`). */
    const UNIQUE = "1042";

    const json = await get(`/search?q=${UNIQUE}`, { accept: "application/json" });
    /** @type {any} */
    let payload = null;
    try {
      payload = JSON.parse(json.text);
    } catch {
      payload = null;
    }
    check(`colophon search: "${UNIQUE}" returns parseable JSON`, payload !== null, `status ${json.status}`);

    /** @type {any[]} */
    const results = payload?.results ?? [];
    check(
      `colophon search: "${UNIQUE}" retrieves the page`,
      results.length > 0,
      `total ${payload?.total ?? "(none)"}`,
    );
    // A POSITIVE count on both sides, so "no foreign hits" cannot mean "no hits".
    const foreign = results.filter((r) => !new URL(r.url).pathname.startsWith("/colophon"));
    check(
      `colophon search: all ${results.length} hit(s) for "${UNIQUE}" are the colophon`,
      results.length > 0 && foreign.length === 0,
      foreign.map((r) => r.url).join(", "),
    );

    const { text: colophonHtml, status: colophonStatus } = await get("/colophon");
    const colophon = unescape(strip(colophonHtml));
    check("colophon search: the page fetches for comparison", colophonStatus === 200 && colophon.length > 1000);

    /** A section hit's fragment exists; a dead one fails silently. */
    const deep = results.filter((r) => r.anchor);
    check(
      `colophon search: at least one "${UNIQUE}" hit is section-grained`,
      deep.length > 0,
      `${deep.length} of ${results.length} carry an anchor`,
    );
    for (const r of deep) {
      check(
        `colophon search: anchor #${r.anchor} exists as an id on the page`,
        colophon.includes(`id="${r.anchor}"`),
        `${r.url} points at a fragment the page does not render`,
      );
      check(
        `colophon search: the URL for #${r.anchor} carries its fragment`,
        r.url.endsWith(`#${r.anchor}`),
        `got ${r.url}`,
      );
    }

    /** Only `post` in the facet means the page sync never ran. */
    const spread = await get("/search?q=cloudflare", { accept: "application/json" });
    /** @type {any[]} */
    let types = [];
    try {
      types = JSON.parse(spread.text).facets?.types ?? [];
    } catch {
      types = [];
    }
    check(
      "colophon search: the type facet reports both post and page, not one value",
      types.length === 2 &&
        types.some((t) => t.value === "post" && t.count > 0) &&
        types.some((t) => t.value === "page" && t.count > 0),
      `facet types: ${JSON.stringify(types)}`,
    );

    let sweptFacts = 0;
    for (const section of COLOPHON_SECTIONS) {
      const region = sectionRegion(colophon, section.id);
      check(
        `colophon ${section.id}: the section renders`,
        region.length > 0,
        `no <h2 id="${section.id}"> in ${colophon.length} bytes`,
      );
      check(
        `colophon ${section.id}: the descriptor lead is on the page verbatim`,
        region.includes(section.lead),
        `lead absent from the ${region.length}-byte region`,
      );

      const facts = factsFor(section.id);
      const missing = facts.filter((v) => !region.includes(v));
      sweptFacts += facts.length;
      check(
        `colophon ${section.id}: all ${facts.length} indexed facts are on the page`,
        facts.length > 0 && missing.length === 0,
        missing.length > 0
          ? `${missing.length} missing, first: ${JSON.stringify(missing[0].slice(0, 120))}`
          : "",
      );
    }
    console.log(`  colophon: ${sweptFacts} indexed facts swept across ${COLOPHON_SECTIONS.length} sections`);
  }
}
