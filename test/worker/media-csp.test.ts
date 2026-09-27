import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { expect, it, vi } from "vitest";

import worker from "../../workers/app";
import { MEDIA_CSP } from "../../workers/csp.mjs";

/*
 * /media through the WHOLE worker: the gateway, the Renderer and its applyDocumentHeaders, which set
 * the policy last. A route-level assertion cannot see the header, because a policy a route set would
 * be overwritten there; this is where the reader's browser gets it.
 */
vi.mock("virtual:react-router/server-build", async () => {
  const entryServer = await import("~/entry.server");
  const rootModule = await import("~/root");
  const mediaModule = await import("~/routes/media.$");
  const { stubServerBuild } = await import("./server-build");

  const build = stubServerBuild({
    entry: { module: entryServer },
    routes: {
      root: { id: "root", path: "", module: rootModule },
      media: { id: "media", parentId: "root", path: "media/*", module: mediaModule },
    },
  });
  return { ...build, default: build };
});

async function fetchPath(path: string) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`https://example.com${path}`) as never, env as never, ctx);
  const body = await response.arrayBuffer();
  await waitOnExecutionContext(ctx);
  return { response, body };
}

const SCRIPTED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/__svg-script-ran")</script></svg>';

it("MEDIA_CSP is the sandboxed policy the job names, script-free", () => {
  expect(MEDIA_CSP).toBe("default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
});

it.each([
  ["a raster", "dustin-edwards-csp-raster-00000000000000c1-4x4.png", "image/png", "not really png bytes"],
  ["a stored SVG", "dustin-edwards-csp-svg-00000000000000c2.svg", "image/svg+xml", SCRIPTED_SVG],
  // The case the sandbox exists for: markup no attachment rule catches, because its type is not SVG.
  ["an HTML body", "dustin-edwards-csp-html-00000000000000c3.png", "text/html", `<script>alert(1)</script>`],
])("serves %s from /media with the media policy and nosniff", async (_label, key, contentType, body) => {
  await env.MEDIA.put(key, body, { httpMetadata: { contentType } });

  const { response } = await fetchPath(`/media/${key}`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toBe(MEDIA_CSP);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});

it("gives a missing object and a thumbnail request the media policy too", async () => {
  const missing = await fetchPath("/media/dustin-edwards-csp-missing-00000000000000c4.png");
  expect(missing.response.status).toBe(404);
  expect(missing.response.headers.get("content-security-policy")).toBe(MEDIA_CSP);
  expect(missing.response.headers.get("x-content-type-options")).toBe("nosniff");

  const key = "dustin-edwards-csp-thumb-00000000000000c5-4x4.png";
  await env.MEDIA.put(key, "not really png bytes", { httpMetadata: { contentType: "image/png" } });
  // Whatever the Images binding does here (transform, fallback or absent), the header is the Renderer's.
  const thumb = await fetchPath(`/media/${key}?w=320`);
  expect(thumb.response.headers.get("content-security-policy")).toBe(MEDIA_CSP);
  expect(thumb.response.headers.get("x-content-type-options")).toBe("nosniff");

  const badWidth = await fetchPath(`/media/${key}?w=7`);
  expect(badWidth.response.status).toBe(400);
  expect(badWidth.response.headers.get("content-security-policy")).toBe(MEDIA_CSP);
});

it("keeps the document policy off /media: a page is never sandboxed", async () => {
  const { response } = await fetchPath("/no-such-page");
  const policy = response.headers.get("content-security-policy") ?? "";
  expect(policy).not.toBe(MEDIA_CSP);
  expect(policy).not.toContain("sandbox");
  expect(policy).toContain("script-src");
});
