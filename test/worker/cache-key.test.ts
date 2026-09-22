import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker, { cacheDimensions } from "../../workers/app";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { serializeThemeCookie } from "~/lib/theme";

import { STUB_PATHS, STUB_PAGE_BODY, STUB_MARKDOWN_BODY } from "./stub-server-build";

/**
 * The cache KEY the gateway builds, and the response policy the renderer stamps.
 *
 * ## THIS FILE REPLACED `themed-cache.test.ts`, 2026-09-05
 *
 * That file's subject was the hand-built `caches.default` layer: what went into
 * its key, what it stored, and what a cookie-bearing reader got. The layer is
 * gone (rulings 11, 15, 16) and so are its seven cases, because there is no
 * store-then-downgrade order left to assert, no `x-theme-cache` marker to read
 * and no hand-built key to separate. Deleting a case whose subject was deleted
 * is not a loss of coverage; keeping it would have been a test of nothing.
 *
 * ## OBSERVATION BOUNDARY, AND IT IS NARROWER THAN THE OLD FILE'S
 *
 * MEASURED 2026-09-05, twice, before this file was written: miniflare does not
 * implement Workers Cache. Under `vite preview` a response with
 * `public, s-maxage=600` and a fixed `cf.cacheKey` was re-rendered on all three
 * fetches and carried no `Cf-Cache-Status`; the same is true in this pool. So
 * NOTHING HERE CAN SEE A HIT. What it can see is the key the gateway BUILDS,
 * which is a pure function and is tested as one, and the headers the renderer
 * stamps, which are what make a response storable at all.
 *
 * The other half, that the platform actually stores and serves under that key,
 * is `verify-live`'s and only the wire can answer it. That split is stated here
 * rather than implied, because a green run of this file establishes that the
 * inputs are right and says nothing about the cache.
 *
 * The route table is the stub in `stub-server-build.ts`, which declares the
 * same headers a real public route declares because it imports them from
 * `app/lib/seo.ts`.
 */

const ORIGIN = "https://example.com";

/** Drives the real gateway, which calls the real renderer through ctx.exports. */
async function fetchThrough(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request as never, env as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

/** A URL nothing else in this file touches. */
let counter = 0;
const freshPath = (base: string) => `${base}?case=${(counter += 1)}`;

/** The pure function under test, over a request the caller describes. */
const dimensionsFor = (
  url: string,
  theme = "system",
  init: RequestInit = {},
) => cacheDimensions(new URL(url), new Request(url, init), theme);

describe("the cache key the gateway builds", () => {
  it("is STABLE for the same path and theme", async () => {
    /*
     * The property every cache depends on and nothing else asserts: two
     * requests that should share an entry produce the same key AND the same
     * props. Both halves, because props are in the platform's key too, so a
     * function that returned a stable string and unstable props would still
     * fragment the cache.
     */
    const a = dimensionsFor(`${ORIGIN}/blog/a-post`, "dark");
    const b = dimensionsFor(`${ORIGIN}/blog/a-post`, "dark");
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.props).toEqual(b.props);
    expect(a.props).toEqual({ theme: "dark" });
  });

  it("SEPARATES BY THEME, so one reader's colors never reach another", async () => {
    const dark = dimensionsFor(`${ORIGIN}/blog/a-post`, "dark");
    const light = dimensionsFor(`${ORIGIN}/blog/a-post`, "light");

    expect(dark.cacheKey).not.toBe(light.cacheKey);
    expect(dark.props).not.toEqual(light.props);
    /* Both halves carry it, which is what the key's docblock claims. An
     * assertion on one alone would pass against a function that had quietly
     * stopped setting the other. */
    expect(dark.cacheKey).toContain("theme=dark");
    expect(light.cacheKey).toContain("theme=light");
  });

  it("separates by PATH and by QUERY, and keeps one separator", async () => {
    const bare = dimensionsFor(`${ORIGIN}/blog/a-post`);
    const other = dimensionsFor(`${ORIGIN}/blog/another-post`);
    expect(bare.cacheKey).not.toBe(other.cacheKey);

    /*
     * A PATH THAT ALREADY CARRIES A QUERY keys correctly rather than producing
     * a second `?`. `URL` handles the separator, which is the one detail that
     * outlived the layer this function replaced.
     */
    const searched = dimensionsFor(`${ORIGIN}/search?q=cloudflare`, "dark");
    expect(searched.cacheKey.match(/\?/g)).toHaveLength(1);
    expect(searched.cacheKey).toContain("q=cloudflare");
    expect(searched.cacheKey).toContain("theme=dark");
    /* And the query is still a dimension: two searches are two entries. */
    expect(searched.cacheKey).not.toBe(dimensionsFor(`${ORIGIN}/search?q=d1`, "dark").cacheKey);
  });

  it("gives an ADMIN PATH no theme dimension, in the key OR the props", async () => {
    /*
     * Belt and braces rather than the protection itself: an admin response is
     * `private, no-store` by its own declaration and is never stored whatever
     * the key says. Asserted because a key that carried a reader's theme on an
     * authenticated path would be a reader-dependent key on the one plane where
     * that must never happen, even if nothing stores it today.
     */
    for (const path of ["/admin", "/admin/mentions", "/admin/posts/a-slug/edit"]) {
      const { cacheKey, props } = dimensionsFor(`${ORIGIN}${path}`, "dark");
      expect(cacheKey, path).not.toContain("theme");
      expect(props, path).toEqual({});
    }
  });

  it("gives a MARKDOWN-NEGOTIATED request no theme dimension", async () => {
    /*
     * The negotiated representation is never stored (`markdownResponse` says
     * why), so it has no business carrying a theme. One expression decides the
     * dimension, so the key and the props cannot disagree about it.
     */
    const { cacheKey, props } = dimensionsFor(`${ORIGIN}/blog/a-post`, "dark", {
      headers: { accept: "text/markdown" },
    });
    expect(cacheKey).not.toContain("theme");
    expect(props).toEqual({});
    /* The HTML request to the same URL DOES carry it, so the case above is the
     * negotiation deciding rather than the path. */
    expect(dimensionsFor(`${ORIGIN}/blog/a-post`, "dark").cacheKey).toContain("theme=dark");
  });

  it("gives a non-GET no theme dimension", async () => {
    /* Workers Cache caches GET and HEAD only, per the docs. A POST cannot be
     * stored, so a theme in its key would be a distinction with no entry. */
    const { cacheKey, props } = dimensionsFor(`${ORIGIN}/theme`, "dark", { method: "POST" });
    expect(cacheKey).not.toContain("theme=dark");
    expect(props).toEqual({});
  });

  it("reads the theme the TOGGLE writes, so the two agree about the cookie", async () => {
    /*
     * The toggle and the key both go through `app/lib/theme.ts`. Asserted
     * rather than assumed, because a disagreement here would serve one reader's
     * colors to another, which is the defect the whole dimension exists to
     * prevent.
     */
    const cookie = serializeThemeCookie("dark");
    expect(cookie).toContain("theme=dark");
    const { props } = cacheDimensions(
      new URL(`${ORIGIN}/`),
      new Request(`${ORIGIN}/`, { headers: { cookie: cookie.split(";")[0] ?? "" } }),
      "dark",
    );
    expect(props).toEqual({ theme: "dark" });
  });
});

describe("the gateway's wire policy", () => {
  it("leaves a COOKIELESS reader on the shared string, so the platform stores it", async () => {
    const response = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.page)}`));
    expect(response.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
    /* And it carries the tag that makes it purgeable, which is the pairing
     * `publicHtmlHeaders` exists to keep together. */
    expect(response.headers.get("cache-tag")).toBeTruthy();
  });

  it("DOWNGRADES a cookie-bearing reader on the wire, without changing what is stored", async () => {
    /*
     * Ruling 16 kept this and the split moved it to the gateway. It cannot live
     * in the renderer: that response is the one the platform STORES, so writing
     * `private, no-store` on it for a cookied reader would mean cookied readers
     * were never cached, which is the regression the whole arc exists to end.
     *
     * What this case can see is the WIRE header. That the stored copy stayed
     * public is the platform's side of the boundary and is verify-live's
     * measurement (b): a cookied MISS followed by a cookied HIT.
     */
    const path = freshPath(STUB_PATHS.page);
    const cookied = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=dark; _ga=GA1.1.99.99" } }),
    );
    expect(cookied.headers.get("cache-control")).toBe("private, no-store");

    /* A cookieless request to the same path is untouched, so the downgrade is
     * the cookie deciding rather than the route. */
    const bare = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(bare.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
  });

  it("does NOT downgrade a response that never asked to be shared", async () => {
    /* The downgrade is scoped to the shared string. A route on hard rule 8's
     * uncached default is already `private, no-store` and must not be rewritten
     * into something else by a cookie. */
    const response = await fetchThrough(
      new Request(`${ORIGIN}${freshPath(STUB_PATHS.silent)}`, {
        headers: { cookie: "theme=dark" },
      }),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("negotiation", () => {
  it("A MARKDOWN Accept NEVER RETURNS HTML (the shipped regression)", async () => {
    /*
     * THE DEFECT, MEASURED IN PRODUCTION on the deploy of 2f0b4d5:
     * `Accept: text/markdown` on a post returned 31,869 bytes of `text/html`.
     *
     * The old version of this case warmed the HTML entry first and asserted the
     * warming, because the layer under it could serve a stale HTML copy to a
     * markdown request. THAT PRECONDITION IS GONE WITH THE LAYER, and it cannot
     * be reconstructed here: this pool has no cache to warm. What survives is
     * the routing half, which is the half that was actually broken, and the
     * cache half is `verify-live`'s.
     */
    const path = freshPath(STUB_PATHS.negotiated);
    const markdown = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/markdown" } }),
    );
    expect(markdown.headers.get("content-type")).toContain("text/markdown");
    expect(await markdown.text()).toBe(STUB_MARKDOWN_BODY);
    /* NEVER STORED, by its own declaration. Grounds on `markdownResponse`. */
    expect(markdown.headers.get("cache-control")).toBe("private, no-store");

    const html = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/html" } }),
    );
    expect(await html.text()).toBe(STUB_PAGE_BODY);
  });

  it("treats a browser's Accept, and an absent one, as votes for HTML", async () => {
    /*
     * Asserted on the KEY rather than on a cache marker: both spellings land on
     * the same entry, which is what stops the shared document being fragmented
     * by a header browsers write differently.
     */
    const browser = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    const withAccept = dimensionsFor(`${ORIGIN}/`, "system", { headers: { accept: browser } });
    const without = dimensionsFor(`${ORIGIN}/`, "system");
    expect(withAccept.cacheKey).toBe(without.cacheKey);
    expect(withAccept.props).toEqual(without.props);
  });
});

describe("hard rule 8: the platform caches silence", () => {
  it("stamps `private, no-store` on a response that declared nothing", async () => {
    /*
     * A response with no `Cache-Control` is CACHED under RFC 9111 heuristic
     * freshness, not skipped. So a route opts IN to sharing and never opts out
     * of refusal.
     */
    const response = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.silent)}`));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("stamps the security headers and a per-request CSP nonce on every response", async () => {
    const first = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.page)}`));
    expect(first.headers.get("x-content-type-options")).toBe("nosniff");
    expect(first.headers.get("x-frame-options")).toBe("DENY");
    expect(first.headers.get("content-security-policy")).toContain("nonce-");

    const second = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.page)}`));
    /*
     * TWO RESPONSES, TWO NONCES. A static or derived nonce is the failure mode
     * that looks exactly like success: every page renders, nothing reports, and
     * the policy is worth nothing.
     *
     * This still holds through the split because the nonce is generated inside
     * the RENDERER, which is where it has to be: it must exist before the render
     * so `<Scripts nonce>` can stamp it. What the cache does to the nonce's
     * lifetime is unchanged and is recorded on /colophon.
     */
    expect(second.headers.get("content-security-policy")).not.toBe(
      first.headers.get("content-security-policy"),
    );
  });
});

describe("http is redirected before anything else happens", () => {
  it("sends a plaintext GET to https with an explicit no-store", async () => {
    /*
     * MEASURED on the live site 2026-08-23: http:// returned 200 with the full
     * page, and the shared cache did not separate the schemes, so a plaintext
     * request was answered with the byte-identical cached HTTPS response
     * INCLUDING ITS CSP NONCE.
     *
     * IT IS THE GATEWAY'S FIRST ACT since the split, before the URL is parsed
     * for the key, so a plaintext request never reaches a cache lookup at all.
     */
    const response = await fetchThrough(new Request("http://example.com/stub-page"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.com/stub-page");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
