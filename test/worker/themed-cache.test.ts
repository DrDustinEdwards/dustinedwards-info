import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import worker from "../../workers/app";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { serializeThemeCookie } from "~/lib/theme";

import { STUB_PATHS, STUB_PAGE_BODY, STUB_MARKDOWN_BODY } from "./stub-server-build";

/**
 * The Worker's own HTML cache in `caches.default`: what goes in the key, what
 * is stored, and what a cookie-bearing reader receives.
 *
 * ## OBSERVATION BOUNDARY
 *
 * The subject is `workers/app.ts`. The route table behind it is the stub in
 * `stub-server-build.ts`, which declares the same headers a real public route
 * declares because it imports them from `app/lib/seo.ts`.
 *
 * `caches.default` here is miniflare's, not Cloudflare's edge. So these cases
 * see the key this Worker BUILDS and the store/lookup/downgrade decisions it
 * makes. They do NOT see whether the platform in front honours `Vary`, which is
 * the constraint the whole design exists around and which only the wire can
 * answer: `check:browser` and `verify-live` own that half.
 *
 * `x-theme-cache` is the Worker's own marker and is what makes a hit
 * distinguishable from a miss without reading the cache directly.
 */

const ORIGIN = "https://example.com";

/** Drives the real entry and waits for the `waitUntil` store to finish. */
async function fetchThrough(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request as never, env as never, ctx);
  /* THE STORE IS ON `waitUntil`, so a reader never waits on bookkeeping. A
   * test that did not wait would race its own next request and read a miss it
   * had caused itself. */
  await waitOnExecutionContext(ctx);
  return response;
}

const marker = (response: Response) => response.headers.get("x-theme-cache") ?? "(none)";

beforeEach(async () => {
  /* One shared `caches.default` across a file, so each case works on a URL of
   * its own rather than depending on what ran before it. */
});

/** A URL nothing else in this file touches. */
let counter = 0;
const freshPath = (base: string) => `${base}?case=${(counter += 1)}`;

describe("the themed cache key", () => {
  it("MISSES then HITS on the same path and theme", async () => {
    const path = freshPath(STUB_PATHS.page);

    const first = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(marker(first)).toBe("miss; theme=system");
    expect(await first.text()).toBe(STUB_PAGE_BODY);

    const second = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(marker(second)).toBe("hit; theme=system");
  });

  it("separates by THEME, so one reader's colours never reach another", async () => {
    const path = freshPath(STUB_PATHS.page);

    /* Warm the entry as a dark reader. */
    const dark = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=dark" } }),
    );
    expect(marker(dark)).toBe("miss; theme=dark");

    /*
     * A LIGHT READER MUST MISS. This is the defect the theme dimension exists
     * for: the platform's key is blind to the cookie, so a dark document warmed
     * first was served to every first-time visitor.
     */
    const light = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=light" } }),
    );
    expect(marker(light)).toBe("miss; theme=light");

    /* And each theme has its own entry afterwards. */
    expect(
      marker(await fetchThrough(new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=dark" } }))),
    ).toBe("hit; theme=dark");
    expect(
      marker(await fetchThrough(new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=light" } }))),
    ).toBe("hit; theme=light");
  });

  it("separates by PATH", async () => {
    const a = freshPath(STUB_PATHS.page);
    const b = freshPath(STUB_PATHS.page);
    expect(marker(await fetchThrough(new Request(`${ORIGIN}${a}`)))).toBe("miss; theme=system");
    expect(marker(await fetchThrough(new Request(`${ORIGIN}${b}`)))).toBe("miss; theme=system");
    expect(marker(await fetchThrough(new Request(`${ORIGIN}${a}`)))).toBe("hit; theme=system");
  });

  it("carries the BUILD, so a hand-built key cannot outlive the deploy that filled it", async () => {
    /*
     * MEASURED during the build of this feature: a `check:browser` run was
     * served HTML from a build several generations old, still inside its ten
     * minute lifetime, asking for a stylesheet hash the current build did not
     * have. Workers Assets serves the CURRENT manifest only, so those URLs
     * answer 404 and the page arrives unstyled. In production that is every
     * cookie-bearing reader for up to ten minutes after every deploy.
     *
     * The build id is a `define`, fixed to a known value for this layer, so the
     * assertion is on the KEY ITSELF rather than on a rebuild: the stored entry
     * is looked up under a URL carrying `__build`, and a key naming a different
     * build finds nothing.
     */
    const path = freshPath(STUB_PATHS.page);
    await fetchThrough(new Request(`${ORIGIN}${path}`));

    const edge = (caches as unknown as { default: Cache }).default;
    const url = new URL(`${ORIGIN}${path}`);
    url.searchParams.set("__theme", "system");
    url.searchParams.set("__build", "test-build-id");
    expect(await edge.match(new Request(url.toString()))).toBeTruthy();

    /* The same entry under a DIFFERENT build is not there. */
    url.searchParams.set("__build", "some-other-build");
    expect(await edge.match(new Request(url.toString()))).toBeUndefined();
  });
});

describe("a cookie-bearing reader", () => {
  it("gets the SAME body from the shared entry, downgraded to private on the wire", async () => {
    const path = freshPath(STUB_PATHS.page);

    /* A cookieless reader warms the entry. */
    const anonymous = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(anonymous.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
    const anonymousBody = await anonymous.text();

    /*
     * A SESSION COOKIE DOES NOT CHANGE THE KEY. The dimension is the THEME, and
     * a Better Auth session cookie resolves to `theme=system` exactly as no
     * cookie does, so this reader lands on the same entry and is answered from
     * the edge instead of from a full render.
     */
    const signedIn = await fetchThrough(
      new Request(`${ORIGIN}${path}`, {
        headers: { cookie: "better-auth.session_token=abc123" },
      }),
    );
    expect(marker(signedIn)).toBe("hit; theme=system");
    expect(await signedIn.text()).toBe(anonymousBody);

    /*
     * AND THE WIRE SAYS `private, no-store`. The stored copy is deliberately
     * `public`, which is what makes it storable at all; returning it verbatim
     * handed a cookied reader `public, s-maxage=600`, which the platform in
     * front is then free to keep under its theme-blind key. That is the
     * light-document-to-a-dark-reader bug reintroduced by the fix for it.
     */
    expect(signedIn.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does NOT warm the shared entry for anyone else", async () => {
    const path = freshPath(STUB_PATHS.page);

    const cookied = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { cookie: "theme=system; _ga=1" } }),
    );
    expect(marker(cookied)).toBe("miss; theme=system");
    expect(cookied.headers.get("cache-control")).toBe("private, no-store");

    /*
     * THE COOKIELESS-ONLY RULE, from the other side. The response a cookied
     * request generated is not stored, so the only variant that can ever exist
     * is the cookieless one and the ordering problem is structurally impossible
     * rather than avoided by luck.
     *
     * ...except that the STORE happens before the downgrade, deliberately, so
     * the public document IS stored under the theme key. What must not happen
     * is the platform storing it, and that is what `private, no-store` above
     * secures. The next cookieless reader legitimately hits.
     */
    expect(marker(await fetchThrough(new Request(`${ORIGIN}${path}`)))).toBe("hit; theme=system");
  });

  it("never stores a response that SETS a cookie", async () => {
    /*
     * A response that mints a session or a theme is per reader by definition.
     * Nothing shared-cached sets one today; the guard is here so that a route
     * that starts to cannot leak it to everybody.
     */
    const path = freshPath(STUB_PATHS.cookieSetter);
    const first = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(first.headers.get("set-cookie")).toBeTruthy();
    expect(marker(first)).toBe("(none)");

    const second = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(marker(second)).toBe("(none)");
  });
});

describe("negotiation", () => {
  it("A MARKDOWN Accept NEVER RETURNS HTML (the shipped regression)", async () => {
    /*
     * ## THE DEFECT, MEASURED IN PRODUCTION on the deploy of 2f0b4d5
     *
     * `Accept: text/markdown` on `/blog/ten-years-on-cloudflare` returned
     * 31,869 bytes of `text/html` marked `x-theme-cache: hit`. The Worker's key
     * is the URL plus the theme plus the build, and two routes serve more than
     * one representation at ONE url and say so with `Vary: Accept`, which the
     * platform honours and `caches.default` cannot see: it is keyed by the
     * Request handed to it and carries no headers at all.
     *
     * ## THE ORDER OF THIS CASE IS THE CASE
     *
     * The HTML entry is warmed FIRST and the warming is ASSERTED. Without that,
     * the markdown request would miss for the boring reason that nothing was
     * stored, and the case would pass against the broken code too. That is the
     * same precondition `check:browser` states for its wire version of this.
     */
    const path = freshPath(STUB_PATHS.negotiated);

    const html = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/html" } }),
    );
    expect(marker(html)).toBe("miss; theme=system");
    const warmed = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/html" } }),
    );
    /* THE ENTRY IS WARM. The next assertion is vacuous without this one. */
    expect(marker(warmed)).toBe("hit; theme=system");

    const markdown = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/markdown" } }),
    );
    expect(markdown.headers.get("content-type")).toContain("text/markdown");
    expect(await markdown.text()).toBe(STUB_MARKDOWN_BODY);
    /* IT SKIPPED THE LOOKUP ENTIRELY, which is why there is no marker at all
     * rather than a miss: one expression gates both the lookup and the store. */
    expect(marker(markdown)).toBe("(none)");
  });

  it("does not store the markdown representation either", async () => {
    const path = freshPath(STUB_PATHS.negotiated);
    await fetchThrough(new Request(`${ORIGIN}${path}`, { headers: { accept: "text/markdown" } }));

    /* A second markdown request is still a render, and an HTML request after it
     * is still a MISS: nothing about the markdown call touched the entry. */
    const html = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { accept: "text/html" } }),
    );
    expect(marker(html)).toBe("miss; theme=system");
    expect(await html.text()).toBe(STUB_PAGE_BODY);
  });

  it("treats a browser's Accept, and an absent one, as votes for HTML", async () => {
    const browser = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    const path = freshPath(STUB_PATHS.page);

    expect(
      marker(await fetchThrough(new Request(`${ORIGIN}${path}`, { headers: { accept: browser } }))),
    ).toBe("miss; theme=system");
    /* No Accept at all lands on the SAME entry, so the shared document is not
     * fragmented by a header browsers spell differently. */
    expect(marker(await fetchThrough(new Request(`${ORIGIN}${path}`)))).toBe("hit; theme=system");
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
    /* And it is not stored, because only the shared string is. */
    expect(marker(response)).toBe("(none)");
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
     */
    expect(second.headers.get("content-security-policy")).not.toBe(
      first.headers.get("content-security-policy"),
    );
  });

  it("returns a CACHED response with the nonce its stored body was rendered with", async () => {
    /*
     * A HIT IS RETURNED WITH ITS STORED POLICY, never re-stamped. Re-stamping a
     * fresh nonce here would produce a policy forbidding the document's own
     * scripts, which is the one failure mode that looks like a mysterious blank
     * page.
     */
    const path = freshPath(STUB_PATHS.page);
    const miss = await fetchThrough(new Request(`${ORIGIN}${path}`));
    const hit = await fetchThrough(new Request(`${ORIGIN}${path}`));
    expect(marker(hit)).toBe("hit; theme=system");
    expect(hit.headers.get("content-security-policy")).toBe(
      miss.headers.get("content-security-policy"),
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
     * `no-store` is load-bearing rather than tidy: the scheme is not in the
     * cache key, so a cacheable redirect stored under a shared key would be
     * handed to HTTPS readers as well and send them where they already are.
     */
    const response = await fetchThrough(new Request("http://example.com/stub-page"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.com/stub-page");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("the theme cookie the toggle writes", () => {
  it("is read back by the Worker as the cache dimension", async () => {
    /* The toggle and the cache agree about the cookie's shape because both go
     * through `app/lib/theme.ts`; asserted rather than assumed, because a
     * disagreement here serves one reader's colours to another. */
    const cookie = serializeThemeCookie("dark");
    expect(cookie).toContain("theme=dark");
    const path = freshPath(STUB_PATHS.page);
    const response = await fetchThrough(
      new Request(`${ORIGIN}${path}`, { headers: { cookie: cookie.split(";")[0] ?? "" } }),
    );
    expect(marker(response)).toBe("miss; theme=dark");
  });
});
