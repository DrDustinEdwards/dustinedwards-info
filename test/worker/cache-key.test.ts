import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../workers/app";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

import { STUB_PATHS, STUB_PAGE_BODY, STUB_MARKDOWN_BODY } from "./stub-server-build";

/* miniflare does not implement Workers Cache, so nothing here can see a HIT: this asserts the headers that make a
 * response storable. The key is site-runtime ./worker's (tested there); storage is verify-live's. */

const ORIGIN = "https://example.com";

async function fetchThrough(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request as never, env as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

let counter = 0;
const freshPath = (base: string) => `${base}?case=${(counter += 1)}`;

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
});

describe("the cache-header rule: the platform caches silence", () => {
  it("stamps `private, no-store` on a response that declared nothing", async () => {
    /* A response with no `Cache-Control` is CACHED under RFC 9111 heuristic freshness, not
     * skipped, so a route opts IN to sharing and never opts out of refusal. */
    const response = await fetchThrough(new Request(`${ORIGIN}${freshPath(STUB_PATHS.silent)}`));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("http is redirected before anything else happens", () => {
  it("sends a plaintext GET to https with an explicit no-store", async () => {
    /* The shared cache does not separate schemes, so a plaintext request would otherwise get
     * the cached HTTPS response. */
    const response = await fetchThrough(new Request("http://example.com/stub-page"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.com/stub-page");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
