import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { expect, it } from "vitest";

import worker from "../../workers/app";
import { STUB_PATHS } from "./stub-server-build";

/* A missing page is counted (site-runtime ./not-found, drizzle/0041), by path and referring host only, and a
 * preview link's 404 never is: its path carries the link's token. The privacy page names what this keeps. */

async function get(path: string, referer?: string) {
  const ctx = createExecutionContext();
  const headers = referer ? { referer } : undefined;
  const response = await worker.fetch(new Request(`https://dustinedwards.info${path}`, { headers }) as never, env as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

it("counts a 404 by path and referring host, never its query or a preview link", async () => {
  expect((await get(`${STUB_PATHS.missing}?utm=x`, "https://example.com/some/post")).status).toBe(404);
  expect((await get("/preview/secret-token")).status).toBe(404);
  const { results } = await env.DB.prepare("SELECT path, referrer_host, hit_count FROM page_404_daily ORDER BY path").all();
  expect(results).toEqual([{ path: STUB_PATHS.missing, referrer_host: "example.com", hit_count: 1 }]);
});
