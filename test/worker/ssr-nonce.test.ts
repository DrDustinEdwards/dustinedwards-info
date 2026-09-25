import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createElement as h, lazy, Suspense } from "react";
import { expect, it, vi } from "vitest";

import worker from "../../workers/app";

/*
 * A document route whose one Suspense boundary resolves after the shell has flushed, so react-dom
 * writes inline completion scripts of its own. The entry is the real `app/entry.server.tsx`.
 */
vi.mock("virtual:react-router/server-build", async () => {
  const entryServer = await import("~/entry.server");
  const { stubServerBuild } = await import("./server-build");
  const Late = lazy(
    () =>
      new Promise<{ default: () => ReturnType<typeof h> }>((resolve) =>
        setTimeout(() => resolve({ default: () => h("div", { id: "late" }, "content") }), 50),
      ),
  );
  const Root = () =>
    h("html", null, h("body", null, h("div", null, "shell"), h(Suspense, { fallback: null }, h(Late))));

  const build = stubServerBuild({
    entry: { module: entryServer },
    routes: { root: { id: "root", path: "", module: { default: Root } } },
    assetRoutes: {
      root: {
        id: "root",
        path: "",
        module: "/stub-root.js",
        imports: [],
        hasLoader: false,
        hasAction: false,
        hasClientLoader: false,
        hasClientAction: false,
        hasClientMiddleware: false,
        hasErrorBoundary: false,
      },
    },
  });
  return { ...build, default: build };
});

it("stamps the CSP header's nonce on every inline script, the late boundary's included", async () => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request("https://example.com/") as never,
    env as never,
    ctx,
  );
  const html = await response.text();
  await waitOnExecutionContext(ctx);

  const nonce = /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "")?.[1];
  expect(nonce, "the response carries no script nonce in its CSP").toBeTruthy();

  expect(html).toContain('id="late"');
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  expect(scripts.length, "no inline script was emitted, so nothing was checked").toBeGreaterThan(0);
  expect(scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`))).toEqual([]);
});
