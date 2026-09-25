// The theme attribute on the wire, and the public and admin stylesheets kept apart.

import { check, get, htmlTag, SLUG } from "./client.mjs";

export async function run() {
  for (const [label, cookie, expected] of [
    ["no cookie renders no attribute (system)", "", null],
    ["theme=system (legacy) renders no attribute", "theme=system", null],
    ["theme=dark renders the attribute", "theme=dark", "dark"],
    ["theme=light renders the attribute", "theme=light", "light"],
    ["a junk cookie degrades to the default", "theme=../../etc", null],
  ]) {
    const { text, status } = await get("/", cookie ? { cookie } : {});
    const tag = htmlTag(text);
    const got = (tag.match(/data-theme="([a-z]+)"/) ?? [])[1] ?? null;
    check(`theme: ${label}`, status === 200 && got === expected, `got ${status} ${tag}`);
  }

  // Anti-flash: no script sets the attribute.
  {
    const { text, status } = await get("/");
    const headEnd = text.indexOf("</head>");
    const head = headEnd === -1 ? "" : text.slice(0, headEnd + 7);
    const inlineSetsTheme = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?data-theme[\s\S]*?<\/script>/.test(head);
    check(
      "theme: no inline script sets data-theme (nothing to flash)",
      status === 200 && headEnd !== -1 && !inlineSetsTheme,
      `got ${status}${headEnd === -1 ? ", and no </head> to read, so the head could not be checked" : ""}`,
    );
  }

  for (const path of ["/", "/blog", `/blog/${SLUG}`, "/search?q=blog"]) {
    const { text, status } = await get(path, { cookie: "theme=dark" });
    const got = (htmlTag(text).match(/data-theme="([a-z]+)"/) ?? [])[1] ?? null;
    check(`theme persists on ${path}`, status === 200 && got === "dark", `got ${status} ${got}`);
  }

  {
    /* Public and admin sheets are asserted apart, never as a union. `/login` links both. */
    const { text: home } = await get("/");
    const publicHref = (home.match(/href="(\/assets\/[^"]+\.css)"/) ?? [])[1];
    check("css: a stylesheet is linked on /", Boolean(publicHref), home.slice(0, 200));

    const { text: login } = await get("/login");
    const loginHrefs = [...login.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]);
    const adminHref = loginHrefs.find((h) => h !== publicHref);

    /* Scope first: two distinct sheets, or a collapsed split looks healthy. */
    check(
      "css: /login links the public stylesheet and a second, admin one",
      Boolean(adminHref) && loginHrefs.includes(publicHref),
      `linked: ${loginHrefs.join(", ") || "(none)"}`,
    );
    check(
      "css: / does NOT link the admin stylesheet",
      Boolean(adminHref) && !home.includes(adminHref ?? " "),
      "the admin bundle is back on the public plane, which is the split undone",
    );

    if (publicHref && adminHref) {
      const { text: css, status } = await get(publicHref);
      check("css: public stylesheet fetches", status === 200);
      const { text: adminCss, status: adminStatus } = await get(adminHref);
      check("css: admin stylesheet fetches", adminStatus === 200);
      check(
        "css: the admin stylesheet is not empty",
        adminCss.length > 10000,
        `${adminCss.length} bytes`,
      );

      for (const [label, needle] of [
        ["dark sage locked to #93B29B", "93b29b"],
        ["dark body text #E3DBD0", "e3dbd0"],
        ["dark heading #EDE6DC", "ede6dc"],
        ["light bg caliche #FAF7F2", "faf7f2"],
        ["dark bg prairie night #1A1614", "1a1614"],
        ["prefers-contrast tier present", "prefers-contrast"],
        ["forced-colors policy present", "forced-colors"],
        ["prefers-contrast light muted #4A423A", "4a423a"],
        ["prefers-contrast dark muted #C6BDAF", "c6bdaf"],
        ["mark is prairie gold #F3E3B8", "f3e3b8"],
        ["danger fill #8E1024", "8e1024"],
      ]) {
        check(`css: ${label}`, css.toLowerCase().includes(needle));
      }

      check(
        "css: base anchor rule underlines",
        /a\{[^}]*text-decoration:underline/.test(css),
      );
      check(
        "css: .btn-danger uses --fill-danger, in the admin stylesheet",
        /\.btn-danger\{[^}]*background:var\(--fill-danger\)/.test(adminCss),
      );
      check(
        "css: .btn-danger is NOT in the public stylesheet",
        !/\.btn-danger\{[^}]*background:var\(--fill-danger\)/.test(css),
      );
      /* Search rules live on `/search`'s own sheets (its links minus `/`'s), proven non-empty. */
      const searchPage = await get("/search?q=cloudflare");
      const searchHrefs = [...searchPage.text.matchAll(/href="(\/assets\/[^"]+\.css)"/g)]
        .map((m) => m[1])
        .filter((href) => !home.includes(href));
      check(
        "css: /search links at least one stylesheet / does not",
        searchHrefs.length > 0,
        `/search links nothing of its own, so the per-route split has collapsed back ` +
          `into one bundle and the assertion below would be about the chrome sheet.`,
      );
      let searchCss = "";
      for (const href of searchHrefs) searchCss += (await get(href)).text;
      check(
        "css: search mark uses --mark-bg, not brand",
        /\.search-snippet mark\{[^}]*background:var\(--mark-bg\)/.test(searchCss),
        `searched ${searchHrefs.length} route stylesheet(s): ${searchHrefs.join(", ")}`,
      );
      check(
        "css: no :focus-visible rule relies on box-shadow, public",
        !/:focus-visible\{[^}]*box-shadow/.test(css),
      );
      check(
        "css: no :focus-visible rule relies on box-shadow, admin",
        !/:focus-visible\{[^}]*box-shadow/.test(adminCss),
      );
      check(
        "css: theme selectors survived minification",
        css.includes(":root:not([data-theme])") && css.includes("[data-theme=dark]"),
      );
    }
  }
}
