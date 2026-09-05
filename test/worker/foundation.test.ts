import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../workers/app";
import { STUB_PAGE_BODY, STUB_PATHS } from "./stub-server-build";

/**
 * The SCOPE CONTROL for this whole layer.
 *
 * A zero from a search proves nothing until the scope is proven non-empty, and
 * the same is true of a green test run: every case in the other files asserts
 * something about a binding, a schema or the Worker entry, and every one of
 * them would report a clean pass if what it was pointed at silently stopped
 * existing in the way it expects. These cases are that proof, kept in a file of
 * their own so it is obvious they are the control and not coverage.
 *
 * It is the same discipline `check:browser` uses when its first assertion
 * proves a stylesheet applied before anything measures a layout.
 */

describe("the instrument is pointed at something", () => {
  it("has every store the cases below write to", () => {
    expect(env.DB).toBeTruthy();
    expect(env.APP_KV).toBeTruthy();
    expect(env.MEDIA).toBeTruthy();
    expect(env.OG).toBeTruthy();
    expect(env.ASK_BUDGET).toBeTruthy();
  });

  it("applied `drizzle/` into the local D1, virtual tables included", async () => {
    const rows = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all<{ name: string }>();
    const names = rows.results.map((r) => r.name);

    /* The tables the publish and media cases write to. Named rather than
     * counted: a count would move with every migration and say nothing about
     * whether the right tables arrived. */
    for (const table of ["posts", "post_tags", "tags", "media", "media_refs", "search_docs"]) {
      expect(names).toContain(table);
    }
    /*
     * AND THE FTS5 VIRTUAL TABLES, which is the half that could plausibly not
     * survive a different SQLite build. `check:backup` exists because
     * `wrangler d1 export` refuses while these exist, so a layer that quietly
     * lacked them would be testing a different database from the one that ships.
     */
    for (const table of ["posts_fts", "search_identity", "search_prose"]) {
      expect(names).toContain(table);
    }
  });

  it("runs the REAL Worker entry, not a re-implementation of it", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request(`https://example.com${STUB_PATHS.page}`) as never,
      env as never,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(STUB_PAGE_BODY);
    /*
     * THE MARKER CHANGED WITH THE SPLIT, 2026-09-05. It was `x-theme-cache`,
     * which only `workers/app.ts` set and which went with the hand-built cache
     * layer that set it.
     *
     * `Reporting-Endpoints` and the nonced CSP replace it, and they are a
     * STRONGER claim than the old one. Both are stamped inside the `Renderer`
     * entrypoint, and this request enters at the GATEWAY, so seeing them proves
     * the loopback ran: the gateway called `ctx.exports.Renderer` and got a real
     * render back. A layer driving something else that merely returned the stub
     * body would fail here, which is what this case is for.
     */
    expect(response.headers.get("reporting-endpoints")).toBeTruthy();
    expect(response.headers.get("content-security-policy")).toContain("nonce-");
  });

  it("REFUSES the network by default, which is what makes 'never live' a mechanism", async () => {
    /*
     * Asserted rather than trusted. The refusing `fetch` is installed in
     * `setup.ts` for every case; this is the one place that proves it is
     * actually installed, so a setup file that stopped running would fail here
     * rather than quietly letting the layer reach `api.github.com`, which is
     * what it did on its first run.
     */
    await expect(fetch("https://api.github.com/anything")).rejects.toThrow(
      /does not reach the network/,
    );
  });
});
