import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createElement as h } from "react";
import { expect, it, vi } from "vitest";

import { ENHANCE_LOADER } from "~/lib/enhance-loader.mjs";

import worker from "../../workers/app";
import { enhanceLoaderHash } from "../../workers/csp.mjs";

/*
 * A public page through the REAL root (its Layout, loader and middleware) and the real server
 * entry: the site header with its speculation rules and <Enhance> markers, a second marker, and a
 * JSON-LD block. What the policy has to allow is whatever this renders, so it is asserted here
 * against the rendered bytes rather than against the source.
 */
vi.mock("virtual:react-router/server-build", async () => {
  const entryServer = await import("~/entry.server");
  const rootModule = await import("~/root");
  const { SiteHeader } = await import("~/components/site-header");
  const { Enhance } = await import("~/components/enhance");
  const { stubServerBuild } = await import("./server-build");

  const Page = () =>
    h(
      "div",
      null,
      h(SiteHeader),
      h("main", { id: "main" }, "page"),
      h(Enhance, { module: "blog" }),
      h("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: "{}" } }),
    );

  const assetRoute = (id: string, path: string | undefined, hasLoader: boolean, parentId?: string) => ({
    id,
    parentId,
    path,
    index: path === undefined ? true : undefined,
    module: `/stub-${id}.js`,
    imports: [],
    hasLoader,
    hasAction: false,
    hasClientLoader: false,
    hasClientAction: false,
    hasClientMiddleware: false,
    hasErrorBoundary: id === "root",
  });

  const build = stubServerBuild({
    entry: { module: entryServer },
    routes: {
      root: { id: "root", path: "", module: rootModule },
      home: { id: "home", parentId: "root", index: true, module: { default: Page } },
    },
    assetRoutes: {
      root: assetRoute("root", "", true),
      home: assetRoute("home", undefined, false, "root"),
    },
  });
  return { ...build, default: build };
});

it("renders a public page whose one executable inline script is the hashed loader, with no nonce", async () => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request("https://example.com/") as never, env as never, ctx);
  const html = await response.text();
  await waitOnExecutionContext(ctx);
  expect(response.status).toBe(200);

  /* The policy: no nonce, and exactly one hash, the loader's, which is node's sha256 of the text. */
  const policy = response.headers.get("content-security-policy") ?? "";
  expect(policy).not.toContain("nonce-");
  expect(policy.match(/'sha256-[^']+'/g)).toEqual([`'${await enhanceLoaderHash()}'`]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ENHANCE_LOADER));
  expect(await enhanceLoaderHash()).toBe(
    `sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`,
  );

  /* The document: no nonce anywhere, and no parser-inserted script src. */
  expect(html).not.toMatch(/\snonce=/);
  expect(html).not.toMatch(/<script\b[^>]*\ssrc=/);

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attrs, text]) => ({
    type: /\btype="([^"]*)"/.exec(attrs ?? "")?.[1] ?? "",
    text: text ?? "",
  }));
  const executable = scripts.filter((s) => s.type !== "application/ld+json" && s.type !== "speculationrules");
  expect(executable.map((s) => s.text), "the loader, byte for byte, and nothing else").toEqual([ENHANCE_LOADER]);
  expect(scripts.filter((s) => s.type === "speculationrules")).toHaveLength(1);
  expect(scripts.filter((s) => s.type === "application/ld+json")).toHaveLength(1);

  /* The markers the loader reads, each a same-origin /assets/ URL, and the loader after them all. */
  const markers = [...html.matchAll(/<template data-enhance="([^"]+)"><\/template>/g)].map((m) => m[1] ?? "");
  expect(markers.length).toBeGreaterThanOrEqual(3);
  for (const url of markers) expect(url).toMatch(/^\/assets\/[\w-]+\.js$/);
  expect(html.indexOf(ENHANCE_LOADER)).toBeGreaterThan(html.lastIndexOf("data-enhance="));
});
