// The shared cache: cookieless and cookied HTML, the alternate representations, and /media.

// Derived like the sync and uploader do; a literal key goes stale.
import { ogImageKey } from "../../../app/lib/content/pipeline.mjs";
import { readArtifact } from "../artifact.mjs";
import { check, fetchLive, htmlTag, SLUG } from "./client.mjs";

/** Not `get()`: its `no-cache` makes "not a HIT" pass vacuously. */
export async function run() {
  const warm = async (/** @type {string} */ path, /** @type {string} */ cookie) => {
    const { res, text } = await fetchLive(path, { cookie, noCache: false });
    return { res, body: text, cf: res.headers.get("cf-cache-status") ?? "(none)" };
  };

  const themeOf = (/** @type {string} */ html) =>
    (htmlTag(html).match(/data-theme="(\w+)"/) ?? [])[1] ?? "(none)";

  const HTML_ROUTES = [
    "/",
    "/blog",
    `/blog/${SLUG}`,
    "/search?q=d1",
    "/phage-discovery",
    "/colophon",
  ];

  // Cookieless readers HIT the default; cookied readers get their own theme.
  for (const path of HTML_ROUTES) {
    /* Retried: an entry needs a few requests to settle. */
    let cookieless = await warm(path, "");
    for (let i = 0; i < 4 && cookieless.cf !== "HIT"; i += 1) {
      cookieless = await warm(path, "");
    }

    check(
      `cache: ${path} is shared-cached for cookieless readers`,
      cookieless.cf === "HIT",
      `cf-cache-status ${cookieless.cf}, cache-control ${cookieless.res.headers.get("cache-control")}`,
    );
    check(
      `cache: ${path} cookieless renders the default theme`,
      themeOf(cookieless.body) === "(none)",
      `rendered ${themeOf(cookieless.body)} with no cookie sent (cf ${cookieless.cf})`,
    );

    /* The theme is in the key, so the second cookied read must HIT. */
    const dark = await warm(path, "theme=dark");
    check(
      `cache: ${path} renders the theme the cookie asked for`,
      themeOf(dark.body) === "dark",
      `sent theme=dark, rendered ${themeOf(dark.body)} (cf ${dark.cf})`,
    );

    const darkAgain = await warm(path, "theme=dark");
    check(
      `cache: ${path} serves a COOKIED reader from cache on the second read`,
      darkAgain.cf === "HIT",
      `second cookied read reported cf-cache-status ${darkAgain.cf}, expected HIT. ` +
        `Before the cache arc every one of these was a full origin render, which is ` +
        `what made the theme toggle cost a reader the edge cache on every page. If ` +
        `this reads BYPASS the theme is not reaching the key, or the response is not ` +
        `storable; if it reads MISS on every attempt the entry is not being written.`,
    );
    check(
      `cache: ${path} a cookied HIT still renders the requested theme`,
      themeOf(darkAgain.body) === "dark",
      `a hit rendered ${themeOf(darkAgain.body)} for theme=dark. The key has stopped ` +
        `separating the themes, which serves the first reader's document to everyone.`,
    );

    check(
      `cache: ${path} never hands a cookied reader a public policy, hit or miss`,
      (dark.res.headers.get("cache-control") ?? "").includes("no-store") &&
        (darkAgain.res.headers.get("cache-control") ?? "").includes("no-store"),
      `miss sent ${dark.res.headers.get("cache-control")} and hit sent ` +
        `${darkAgain.res.headers.get("cache-control")}. The stored copy is public so ` +
        `that it can be stored at all; handing that header to a cookie-bearing reader ` +
        `invites a browser or an intermediary to keep a document that differs per reader.`,
    );

    /* `Vary: Cookie` would fragment every entry. */
    check(
      `cache: ${path} does not vary on Cookie`,
      !/(^|,)\s*cookie\s*(,|$)/i.test(cookieless.res.headers.get("vary") ?? ""),
      `Vary was ${JSON.stringify(cookieless.res.headers.get("vary"))}. The theme is in ` +
        `the cache key now; a Cookie dimension on top of it would split every entry by ` +
        `analytics cookies the document does not read.`,
    );
  }

  {
    const cold = `/?verify=${Math.random().toString(36).slice(2)}${Date.now()}`;
    await warm(cold, "theme=dark");
    const after = await warm(cold, "");
    check(
      "cache: a cookie-bearing request cannot poison the cookieless variant",
      themeOf(after.body) === "(none)",
      `cookie-first then cookieless rendered ${themeOf(after.body)} (cf ${after.cf})`,
    );
  }

  /* Case B: an alternate representation must not collapse the cookie dimension. */
  {
    /** @param {string} path @param {{cookie?: string, accept?: string}} [opts] */
    const req = async (path, opts = {}) => {
      const { res, text } = await fetchLive(path, { ...opts, noCache: false });
      return {
        res,
        body: text,
        cf: res.headers.get("cf-cache-status") ?? "(none)",
        cc: res.headers.get("cache-control") ?? "(none)",
        type: (res.headers.get("content-type") ?? "").split(";")[0],
      };
    };

    const bust = () => `${Math.random().toString(36).slice(2)}${Date.now()}`;

    for (const [label, base, accept, altType] of [
      ["/search", "/search?q=d1", "application/json", "application/json"],
      [`/blog/:slug`, `/blog/${SLUG}`, "text/markdown", "text/markdown"],
    ]) {
      const join = base.includes("?") ? "&" : "?";

      // Control: proves the URL is shared-cached.
      const controlUrl = `${base}${join}vb=c${bust()}`;
      await req(controlUrl);
      let control = await req(controlUrl);
      for (let i = 0; i < 3 && control.cf !== "HIT"; i += 1) control = await req(controlUrl);
      check(
        `variant ${label}: control is shared-cached cookieless`,
        control.cf === "HIT",
        `cf ${control.cf}. Without this the test below proves nothing.`,
      );
      const controlDark = await req(controlUrl, { cookie: "theme=dark" });
      /* Not "cf is not HIT": cookied reads cache under the theme key now, and a first read is a MISS
         whatever the design, so that half proved nothing. What must hold is the policy it is handed. */
      check(
        `variant ${label}: control cookie-bearing response is no-store`,
        controlDark.cc.includes("no-store"),
        `cf ${controlDark.cf}, cache-control ${controlDark.cc}`,
      );

      const testUrl = `${base}${join}vb=t${bust()}`;
      const alt = await req(testUrl, { accept });
      check(
        `variant ${label}: the alternate representation still serves ${altType}`,
        alt.res.status === 200 && alt.type === altType,
        `got ${alt.res.status} ${alt.type || "(none)"}`,
      );
      check(
        `variant ${label}: the alternate representation is never stored`,
        alt.cc.includes("no-store"),
        `cache-control ${alt.cc}. If this is public it can become a second variant.`,
      );

      await req(testUrl);
      let after = await req(testUrl);
      for (let i = 0; i < 3 && after.cf !== "HIT"; i += 1) after = await req(testUrl);
      const dark = await req(testUrl, { cookie: "theme=dark" });
      check(
        `variant ${label}: cookie-bearing response is no-store AFTER the alternate representation`,
        dark.cc.includes("no-store"),
        `cf ${dark.cf}, cache-control ${dark.cc}. This is the 2026-08-05 defect: ` +
          `a second variant collapsed the Cookie dimension.`,
      );
      check(
        `variant ${label}: renders the requested theme AFTER the alternate representation`,
        themeOf(dark.body) === "dark",
        `sent theme=dark, rendered ${themeOf(dark.body)} (cf ${dark.cf})`,
      );
    }

    const negotiated = await req(`/blog/${SLUG}`, { accept: "text/markdown" });
    const byPath = await req(`/blog/${SLUG}.md`);
    check(
      "variant: the Accept form and the .md path return the same markdown",
      negotiated.type === "text/markdown" &&
        byPath.type === "text/markdown" &&
        negotiated.body === byPath.body &&
        negotiated.body.length > 100,
      `accept ${negotiated.type} ${negotiated.body.length}b, path ${byPath.type} ${byPath.body.length}b`,
    );
  }

  /* Derived, never literal: a pruned key 404s and reads as a cache failure. */
  const thumbPost = readArtifact().posts.find((/** @type {any} */ p) => !p.cover);
  const THUMB = `/media/${ogImageKey(thumbPost)}?w=320`;
  await warm(THUMB, "");
  const cachedThumb = await warm(THUMB, "");
  check(
    "cache: the /media/* probe is fetching an object that exists",
    cachedThumb.res.status === 200 &&
      (cachedThumb.res.headers.get("content-type") ?? "").startsWith("image/"),
    `${THUMB} answered ${cachedThumb.res.status} ` +
      `${cachedThumb.res.headers.get("content-type")}. A missing object makes the two ` +
      `cache assertions below fail for a reason that has nothing to do with the cache.`,
  );
  check(
    "cache: /media/* still HITs on a second request",
    cachedThumb.cf === "HIT",
    `cf-cache-status ${cachedThumb.cf}`,
  );
  check(
    "cache: /media/* is still served immutable",
    (cachedThumb.res.headers.get("cache-control") ?? "").includes("immutable"),
    `cache-control ${cachedThumb.res.headers.get("cache-control")}`,
  );
}
