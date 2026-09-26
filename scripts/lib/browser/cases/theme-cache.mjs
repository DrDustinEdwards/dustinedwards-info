/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { sharedCacheHtmlRoutes } from "../../route-source.mjs";
import { SMOKE_TOKEN } from "../credential.mjs";
import { BASE, DRIVES_PREVIEW, FETCH_TIMEOUT_MS, ok, PUBLIC_ORIGIN, skip } from "../harness.mjs";
import { MENTION_POST_PATH } from "../seed.mjs";

/*
 * Keying the public cache on path plus theme is sound only if public bytes depend on
 * the theme alone. Nothing is masked for the CSP: public pages carry no nonce, so one
 * appearing is a difference this case should report.
 */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ page, browser }) {
  const THEME_CACHED = [
    { path: "/", module: "home.tsx" },
    { path: "/blog", module: "blog._index.tsx" },
    { path: "/blog/ten-years-on-cloudflare", module: "blog.$slug.tsx" },
    { path: "/projects", module: "projects.tsx" },
    { path: "/playground", module: "playground.tsx" },
    { path: "/playground/ui", module: "playground.ui.tsx" },
    { path: "/phage-discovery", module: "phage-discovery.tsx" },
    { path: "/colophon", module: "colophon.tsx" },
    { path: "/search?q=cloudflare", module: "search.tsx" },
    { path: "/privacy", module: "privacy.tsx" },
    /* The most-carried tag, so one post being retagged cannot remove the case. */
    { path: "/blog/tags/cloudflare", module: "blog.tags.$tag.tsx" },
    { path: "/about", module: "about.tsx" },
    { path: "/publications", module: "publications.tsx" },
    /* The trailing slash is canonical; the slashless form redirects. */
    { path: "/publications/10-1128-mra-00888-24/", module: "publications.$slug.tsx" },
  ];

  /* Shared-cached HTML with no corpus URL; a 404 would compare two error pages. */
  const THEME_CACHED_PENDING = {
    "blog.series.$series.tsx":
      "no post in the corpus carries a series, so every /blog/series/ URL is a " +
      "404 and a case here would compare two renders of the error page.",
  };

  /* HTML only: the feeds and twins sharing the header have no `<html data-theme>` to reach. */
  const declaring = sharedCacheHtmlRoutes();

  const listed = new Set([
    ...THEME_CACHED.map((r) => r.module),
    ...Object.keys(THEME_CACHED_PENDING),
  ]);
  const missing = declaring.filter((name) => !listed.has(name));
  const extra = [...listed].filter((name) => !declaring.includes(name));
  ok(
    "every pending theme-cached exemption names a route that still declares them",
    Object.keys(THEME_CACHED_PENDING).every((name) => declaring.includes(name)),
    `THEME_CACHED_PENDING names a route that no longer declares the shared ` +
      `headers, so it exempts nothing and hides whatever replaced it`,
  );
  ok(
    "the theme-cached route list matches the routes that declare shared cache headers",
    missing.length === 0 && extra.length === 0,
    `not in this case: ${missing.join(", ") || "none"}; listed but no longer ` +
      `declaring: ${extra.join(", ") || "none"}. A route that gained the shared ` +
      `headers without being byte-checked here is exactly the one that would ` +
      `carry session bytes into a shared cache entry.`,
  );

  /** @param {string} html */
  const mask = (html) =>
    html
      .replace(/csp-endpoint="[^"]*"/g, 'csp-endpoint="E"')
      .replace(/data-health-age="\d+"/g, 'data-health-age="A"')
      /*
       * The age sentence differs between same-cookie renders (KV edge cache plus clock), so
       * it is masked here and not in `maskTheme`. The health-tile case asserts the age.
       */
      .replace(
        /(data-health-age="A"[\s\S]*?<p class="evidence-detail[^"]*">)[^<]*/,
        "$1AGE-SENTENCE",
      );

  /**
   * One cache-buster per run, never per fetch: `/publications` renders the request URL into its
   * search form, so per-fetch values made the three reads of a page differ.
   */
  const RUN_IDENTITY = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  /**
   * Every status fetchDoc saw, by path: two error pages are byte-identical too, so identity and
   * theme-diff mean something only for a path that answered 200 to every variant.
   *
   * @type {Map<string, number[]>}
   */
  const docStatuses = new Map();

  /** @param {string} path @param {Record<string,string>} headers */
  const fetchDoc = async (path, headers) => {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE}${path}${sep}identity=${RUN_IDENTITY}`, {
      headers: { "cache-control": "no-cache", ...headers },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    docStatuses.set(path, [...(docStatuses.get(path) ?? []), res.status]);
    return mask(await res.text());
  };

  const firstDiff = (/** @type {string} */ a, /** @type {string} */ b) => {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a[i] === b[i]) i += 1;
    if (i === n && a.length === b.length) return null;
    return { at: i, a: a.slice(Math.max(0, i - 60), i + 80), b: b.slice(Math.max(0, i - 60), i + 80) };
  };

  /* The mask set only ever shrinks: a wider mask hides a control that has started varying by theme. */
  const maskTheme = (/** @type {string} */ html) =>
    html
      .replace(/<html[^>]*>/, "<html>")
      /* The color-scheme meta carries the theme by design; its own case asserts the value. */
      .replace(/<meta name="color-scheme" content="[^"]*"/, '<meta name="color-scheme" content="S"');

  /**
   * `footerOrderCompared` exists so a THEME_CACHED of one cannot report a clean sweep.
   *
   * @type {string[] | null}
   */
  let footerOrder = null;
  let footerOrderPath = "";
  let footerOrderCompared = 0;

  for (const { path } of THEME_CACHED) {
    const visited = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    ok(
      `${path}: the page answers 200 in the browser`,
      visited?.status() === 200,
      `answered ${visited?.status() ?? "(no response)"}. Every case on this path below would ` +
        `be about an error page.`,
    );

    // 3.2.6 asks for the same relative order on every page, never a fixed index. `/colophon`
    // appears twice in the footer, as a nav link and as prose, and that is the markup.
    const help = await page.evaluate(() => {
      const links = [...document.querySelectorAll(".site-shell-footer a")].map(
        (a) => a.getAttribute("href") ?? "",
      );
      return { links, at: links.indexOf("/privacy") };
    });
    ok(
      `${path}: the footer carries the privacy link`,
      help.at !== -1,
      `footer links are [${help.links.join(", ")}]. 3.2.6 asks for the same help ` +
        `mechanism on every page that has one, and every public page has this footer.`,
    );
    if (footerOrder === null) {
      footerOrder = help.links;
      footerOrderPath = path;
    } else {
      footerOrderCompared += 1;
      const recorded = footerOrder;
      ok(
        `${path}: the footer link order matches ${footerOrderPath}`,
        help.links.length === recorded.length &&
          help.links.every((href, i) => href === recorded[i]),
        `this page lists [${help.links.join(", ")}] and ${footerOrderPath} listed ` +
          `[${recorded.join(", ")}]. 3.2.6 is about the same relative ORDER, so a link ` +
          `that moves between pages satisfies presence and fails the criterion.`,
      );
    }


    const stranger = await fetchDoc(path, {});
    const credentialed = await fetchDoc(path, {
      ...(SMOKE_TOKEN ? { authorization: `Bearer ${SMOKE_TOKEN}` } : {}),
      cookie: "session_probe=1; _ga=GA1.1.99.99",
    });

    const sessionDiff = firstDiff(stranger, credentialed);
    ok(
      `${path}: a credentialed reader gets byte-identical HTML`,
      sessionDiff === null,
      `the document differs at byte ${sessionDiff?.at}. THIS ROUTE CANNOT BE ` +
        `CACHED ON PATH PLUS THEME until the difference is removed, because a ` +
        `key that does not carry the credential would serve one reader's page ` +
        `to another.\n        stranger: ...${sessionDiff?.a}...\n        ` +
        `credentialed: ...${sessionDiff?.b}...`,
    );

    const dark = await fetchDoc(path, { cookie: "theme=dark" });
    const light = await fetchDoc(path, { cookie: "theme=light" });

    const statuses = docStatuses.get(path) ?? [];
    ok(
      `${path}: every variant fetched for the identity and theme checks answered 200`,
      statuses.length > 0 && statuses.every((s) => s === 200),
      `answered [${statuses.join(", ")}]. Two error pages are byte-identical as well, so the ` +
        `checks beside this one would pass on a route that fails for every reader.`,
    );

    /* Without this, both assertions below pass on a site that stopped rendering the theme. */
    ok(
      `${path}: the theme changes the served bytes`,
      firstDiff(light, dark) !== null,
      `light and dark are byte-identical, so either the theme cookie is no ` +
        `longer read at render time or this page has no themed markup. A cache ` +
        `keyed on theme would be keying on nothing.`,
    );

    if (path === MENTION_POST_PATH) {
      if (!DRIVES_PREVIEW) {
        skip(
          `${path}: the seeded mention cases`,
          `this run observes ${PUBLIC_ORIGIN}, where nothing may write a row and no ` +
            `mention has been approved. The section's markup is unexercised here.`,
        );
      } else {
        ok(
          `${path}: the seeded approved mentions render`,
          stranger.includes('class="post-mentions"') &&
            stranger.includes('id="mentions-heading"'),
          `no Mentions section in the served document, so the seed did not reach the ` +
            `render and every assertion below it, INCLUDING the byte-identity pair, is ` +
            `about a page without the feature on it.`,
        );
        ok(
          `${path}: the ordinary mention is an anchor carrying the full rel`,
          /<a href="https:\/\/gate\.example\/about" rel="nofollow ugc noopener noreferrer">A Reader<\/a>/.test(
            stranger,
          ),
          `the anchor is missing or its rel is not the four tokens. A ugc link that ` +
            `passes ranking or leaks a referrer is the whole reason this rel exists.`,
        );

        /*
         * THE HOSTILE ROW, BOTH DIRECTIONS. The escaped form being present
         * does not prove the live form is absent: a page could render both.
         */
        ok(
          `${path}: a script-shaped author name is ESCAPED`,
          stranger.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
          `the escaped literal is not in the document, so either the name was ` +
            `stripped or the row did not render. Escaping is the whole difference ` +
            `between this section and the injected body above it.`,
        );
        ok(
          `${path}: no live script element reaches the document from a mention`,
          !stranger.includes("<script>alert(1)</script>"),
          `the author name reached the markup as a real element. This is the defect ` +
            `the escaped-text ruling exists to prevent, on the one block of this page ` +
            `whose text was written by a stranger.`,
        );
        ok(
          `${path}: a javascript: author_url renders NO anchor`,
          !/javascript:/i.test(stranger),
          `a javascript: URL survived into the document. safeHttpHref refuses it at ` +
            `render time and the name is meant to fall back to plain text; nothing on ` +
            `this page may put a stranger's scheme in an href.`,
        );
        ok(
          `${path}: the refused row still renders its name and excerpt`,
          stranger.includes("An excerpt from a page that cannot be linked to."),
          `the mention whose URLs both failed the check vanished instead of ` +
            `degrading to text. A moderated mention the reader cannot see, while the ` +
            `admin page shows it as published, is two surfaces disagreeing about what ` +
            `is live.`,
        );
      }
    }

    const residue = firstDiff(maskTheme(stranger), maskTheme(dark));
    ok(
      `${path}: the theme changes ONLY data-theme and the color-scheme meta`,
      residue === null,
      `with <html> and the color-scheme meta masked, the dark document still differs ` +
        `from the cookieless one at byte ${residue?.at}. Something else on this ` +
        `page depends on the cookie, so the enumerated diff is incomplete and ` +
        `the cache key would not describe the document.\n        ` +
        `cookieless: ...${residue?.a}...\n        dark: ...${residue?.b}...`,
    );
  }

  ok(
    "the footer order was compared against a recorded one, not just recorded",
    footerOrderCompared >= 2,
    `only ${footerOrderCompared} page(s) were held against ${footerOrderPath}. The first ` +
      `page RECORDS the order and cannot disagree with itself, so a run that recorded one ` +
      `and compared none reports a clean sweep of an assertion that never ran.`,
  );

  /* Miniflare does not implement Workers Cache; `verify-live` owns the cache assertions. */
  skip(
    "the cache stores, separates by theme, and refuses a negotiated read",
    "miniflare does not implement Workers Cache: measured 2026-09-05, three fetches " +
      "of a response with public, s-maxage=600 and a fixed cf.cacheKey each re-rendered " +
      "and carried no Cf-Cache-Status. These are verify-live's six measurements now, " +
      "against production. The theme-only-difference assertions above are unaffected.",
  );

  const NEGOTIATED = [
    {
      path: "/blog/ten-years-on-cloudflare",
      accept: "text/markdown",
      wanted: "text/markdown",
      label: "the markdown twin",
    },
    {
      path: "/search?q=cloudflare",
      accept: "application/json",
      wanted: "application/json",
      label: "the search JSON twin",
    },
  ];

  for (const { path, accept, wanted, label } of NEGOTIATED) {
    const sep = path.includes("?") ? "&" : "?";
    const key = `${BASE}${path}${sep}negotiated=${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const negotiated = await fetch(key, {
      headers: { cookie: "theme=dark", accept },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const type = negotiated.headers.get("content-type") ?? "";
    ok(
      `${label}: an ${accept} request is answered with ${wanted}`,
      type.includes(wanted),
      `got ${JSON.stringify(type)}. The route stopped negotiating, or the gateway's ` +
        `key stopped excluding the negotiated representation. See ` +
        `negotiatesAwayFromHtml in app/lib/negotiate.mjs and cacheDimensions in ` +
        `workers/app.ts.`,
    );
    /* `no-store` keeps the platform from storing it under the HTML reader's key. */
    ok(
      `${label}: the negotiated response refuses storage on its own headers`,
      (negotiated.headers.get("cache-control") ?? "").includes("no-store"),
      `cache-control was ${JSON.stringify(negotiated.headers.get("cache-control"))}. ` +
        `An alternate representation the platform is allowed to store is the same ` +
        `defect in the other direction: the next HTML reader on this key would be ` +
        `handed ${wanted}.`,
    );
  }

  /*
   * Without a color-scheme meta the browser paints a light canvas between pages. Screencast
   * and screenshots cannot see that frame, so the document property is asserted.
   */
  {
    const SCHEME = /<meta name="color-scheme" content="([^"]*)"/;
    const FIRST_SHEET = /<link[^>]+rel="stylesheet"/;

    const READER_STATES = [
      { label: "theme=dark", cookie: "theme=dark", expect: "dark" },
      { label: "theme=light", cookie: "theme=light", expect: "light" },
      /* Legacy `theme=system` cookies must resolve as no cookie. */
      { label: "theme=system (legacy)", cookie: "theme=system", expect: "light dark" },
      { label: "no cookie", cookie: null, expect: "light dark" },
    ];

    for (const { path } of THEME_CACHED) {
      /** @type {string[]} */
      const wrong = [];
      /** @type {Array<{ state: string, html: string }>} */
      const docs = [];
      for (const state of READER_STATES) {
        const html = await fetchDoc(path, state.cookie ? { cookie: state.cookie } : {});
        docs.push({ state: state.label, html });
        const found = html.match(SCHEME);
        if (!found) wrong.push(`${state.label}: NO meta at all`);
        else if (found[1] !== state.expect) {
          wrong.push(`${state.label}: "${found[1]}", expected "${state.expect}"`);
        }
      }
      ok(
        `${path}: every reader state declares its color scheme to the browser`,
        wrong.length === 0,
        `${wrong.join("; ")}. Without this the browser paints its DEFAULT canvas ` +
          `between documents, which is light: measured at 253 of 255 for one ` +
          `composited frame on a dark page whose reader is on a light machine.`,
      );

      /* Before the first stylesheet, not at a fixed index: React 19 orders the metas. */
      const dark = docs.find((d) => d.state === "theme=dark")?.html ?? "";
      const atMeta = dark.search(SCHEME);
      const atSheet = dark.search(FIRST_SHEET);
      ok(
        `${path}: the color scheme is declared before the first stylesheet`,
        atMeta !== -1 && (atSheet === -1 || atMeta < atSheet),
        `the meta is at byte ${atMeta} and the first stylesheet link at ${atSheet}. ` +
          `The point of this meta is that it is read BEFORE any CSS is fetched; ` +
          `after the stylesheet it tells the browser nothing it is not about to ` +
          `learn anyway.`,
      );
    }

    /* The meta and the stylesheet state one fact, so they are checked to agree. */
    for (const theme of ["dark", "light"]) {
      const context = await browser.createBrowserContext();
      const probe = await context.newPage();
      await probe.setCookie({ url: BASE, name: "theme", value: theme, path: "/" });
      await probe.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
      const seen = await probe.evaluate(() => ({
        meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") ?? null,
        computed: getComputedStyle(document.documentElement).colorScheme,
      }));
      await context.close();
      ok(
        `theme=${theme}: the declared color scheme is the one the cascade resolves`,
        seen.meta === theme && seen.computed === theme,
        `the meta says ${JSON.stringify(seen.meta)} and the cascade resolves ` +
          `${JSON.stringify(seen.computed)}, expected both to be "${theme}". These are ` +
          `two statements of one fact and they have drifted.`,
      );
    }
  }
}
