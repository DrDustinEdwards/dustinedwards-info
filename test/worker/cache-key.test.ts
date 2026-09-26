import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker, { cacheDimensions } from "../../workers/app";
import { enhanceLoaderHash } from "../../workers/csp.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

import { STUB_PATHS, STUB_PAGE_BODY, STUB_MARKDOWN_BODY } from "./stub-server-build";

/* miniflare does not implement Workers Cache, so nothing here can see a HIT: this asserts the
 * key the gateway builds and the headers that make a response storable. Storage is verify-live's. */

const ORIGIN = "https://example.com";

async function fetchThrough(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request as never, env as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

let counter = 0;
const freshPath = (base: string) => `${base}?case=${(counter += 1)}`;

const dimensionsFor = (
  url: string,
  theme = "system",
  init: RequestInit = {},
) => cacheDimensions(new URL(url), new Request(url, init), theme);

describe("the cache key the gateway builds", () => {
  it("is STABLE for the same path and theme", async () => {
    /* Props are in the platform's key too, so a stable string with unstable props would still
     * fragment the cache. */
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
    expect(dark.cacheKey).toContain("theme=dark");
    expect(light.cacheKey).toContain("theme=light");
  });

  it("separates by PATH and by QUERY", async () => {
    const post = dimensionsFor(`${ORIGIN}/blog/a-post`);
    expect(post.cacheKey).not.toBe(dimensionsFor(`${ORIGIN}/blog/another-post`).cacheKey);

    const cloudflare = dimensionsFor(`${ORIGIN}/search?q=cloudflare`, "dark");
    expect(cloudflare.cacheKey).not.toBe(dimensionsFor(`${ORIGIN}/search?q=d1`, "dark").cacheKey);
  });
});

describe("the gateway's wire policy", () => {
  it("leaves a COOKIELESS reader on the shared string, so the platform stores it", async () => {
    const response = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.page)}`));
    expect(response.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
    expect(response.headers.get("cache-tag")).toBeTruthy();
  });

  it("DOWNGRADES a cookie-bearing reader on the wire, without changing what is stored", async () => {
    /* This cannot live in the renderer: its response is the one the platform STORES, so
     * stamping `private, no-store` there would mean cookied readers were never cached. */
    const path = freshPath(STUB_PATHS.page);
    const cookied = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=dark; _ga=GA1.1.99.99" } }),
    );
    expect(cookied.headers.get("cache-control")).toBe("private, no-store");

    /* A cookieless request to the same path is untouched: the cookie decides, not the route. */
    const bare = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(bare.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
  });

  it("does NOT downgrade a response that never asked to be shared", async () => {
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
    const path = freshPath(STUB_PATHS.negotiated);
    const markdown = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/markdown" } }),
    );
    expect(markdown.headers.get("content-type")).toContain("text/markdown");
    expect(await markdown.text()).toBe(STUB_MARKDOWN_BODY);
    expect(markdown.headers.get("cache-control")).toBe("private, no-store");

    const html = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/html" } }),
    );
    expect(await html.text()).toBe(STUB_PAGE_BODY);
  });

  it("treats a browser's Accept, and an absent one, as votes for HTML", async () => {
    /* Both spellings land on one entry, so browsers' differing Accept headers do not fragment
     * the shared document. */
    const browser = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    const withAccept = dimensionsFor(`${ORIGIN}/`, "system", { headers: { accept: browser } });
    const without = dimensionsFor(`${ORIGIN}/`, "system");
    expect(withAccept.cacheKey).toBe(without.cacheKey);
    expect(withAccept.props).toEqual(without.props);
  });
});

describe("the cache-header rule: the platform caches silence", () => {
  it("stamps `private, no-store` on a response that declared nothing", async () => {
    /* A response with no `Cache-Control` is CACHED under RFC 9111 heuristic freshness, not
     * skipped, so a route opts IN to sharing and never opts out of refusal. */
    const response = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.silent)}`));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("stamps the security headers and a nonce-free CSP on a public response", async () => {
    const first = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.page)}`));
    expect(first.headers.get("x-content-type-options")).toBe("nosniff");
    expect(first.headers.get("x-frame-options")).toBe("DENY");
    /* The response is shared-cached with its header, so a nonce here would be every reader's.
     * The page's one inline script is allowed by the loader's hash instead. */
    const policy = first.headers.get("content-security-policy") ?? "";
    expect(policy).not.toContain("nonce-");
    expect(policy).toContain(`script-src '${await enhanceLoaderHash()}' 'strict-dynamic'`);

    /* Nothing per-request is left in a public policy, so two renders agree byte for byte. The
     * admin nonce, which does vary, is test/worker/ssr-nonce.test.ts's. */
    const second = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.page)}`));
    expect(second.headers.get("content-security-policy")).toBe(policy);
  });
});

describe("http is redirected before anything else happens", () => {
  it("sends a plaintext GET to https with an explicit no-store", async () => {
    /* The shared cache does not separate schemes, so a plaintext request would otherwise get
     * the cached HTTPS response. */
    const response = await fetchThrough(new Request("http://example.com/stub-page"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.com/stub-page");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
