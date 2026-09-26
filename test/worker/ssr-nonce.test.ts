import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createElement as h, lazy, Suspense } from "react";
import { Outlet } from "react-router";
import { expect, it, vi } from "vitest";

import worker from "../../workers/app";

/*
 * An admin document route whose one Suspense boundary resolves after the shell has flushed, so
 * react-dom writes inline completion scripts of its own. The entry is the real
 * `app/entry.server.tsx`; the nonce is minted for admin paths only (workers/app.ts).
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
  const Root = () => h("html", null, h("body", null, h(Outlet)));
  const Admin = () => h("div", null, h("div", null, "shell"), h(Suspense, { fallback: null }, h(Late)));

  const assetRoute = (id: string, path: string, parentId?: string) => ({
    id,
    parentId,
    path,
    module: `/stub-${id}.js`,
    imports: [],
    hasLoader: false,
    hasAction: false,
    hasClientLoader: false,
    hasClientAction: false,
    hasClientMiddleware: false,
    hasErrorBoundary: false,
  });

  const build = stubServerBuild({
    entry: { module: entryServer },
    routes: {
      root: { id: "root", path: "", module: { default: Root } },
      admin: { id: "admin", parentId: "root", path: "admin", module: { default: Admin } },
    },
    assetRoutes: {
      root: assetRoute("root", ""),
      admin: assetRoute("admin", "admin", "root"),
    },
  });
  return { ...build, default: build };
});

async function render(path: string) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(`https://example.com${path}`) as never,
    env as never,
    ctx,
  );
  const html = await response.text();
  await waitOnExecutionContext(ctx);
  return { response, html };
}

const nonceOf = (response: Response) =>
  /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "")?.[1];

it("stamps the admin CSP header's nonce on every inline script, the late boundary's included", async () => {
  const { response, html } = await render("/admin");

  const nonce = nonceOf(response);
  expect(nonce, "the admin response carries no script nonce in its CSP").toBeTruthy();

  expect(html).toContain('id="late"');
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  expect(scripts.length, "no inline script was emitted, so nothing was checked").toBeGreaterThan(0);
  expect(scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`))).toEqual([]);
});

it("mints a fresh admin nonce per render, never a static one", async () => {
  /* A static or derived nonce looks exactly like success: every page renders and the policy is
   * worth nothing. Admin is `private, no-store`, so a per-render nonce is never shared. */
  const first = nonceOf((await render("/admin")).response);
  const second = nonceOf((await render("/admin")).response);
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
  expect(second).not.toBe(first);
});
