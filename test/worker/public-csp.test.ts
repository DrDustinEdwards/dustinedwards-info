import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { createElement as h } from "react";
import { expect, it, vi } from "vitest";

import { NAV } from "~/lib/nav";
import { SPECULATION_RULES_HEADER, SPECULATION_RULES_PATH } from "@dustinedwards/site-runtime/prefetch";
import { PRELOADS } from "~/lib/preloads";

import worker from "../../workers/app";
import { checkSecurityHeaders, failures } from "@dustinedwards/site-runtime/check";
import { SECURITY_HEADERS } from "../../workers/security-headers.mjs";

/*
 * A public page through the REAL root (its Layout, loader and middleware) and the real server
 * entry: the site header with its island markers, a second marker, and a JSON-LD block. What the policy has to allow is whatever this renders, so it is asserted here
 * against the rendered bytes rather than against the source.
 */
vi.mock("virtual:react-router/server-build", async () => {
  const entryServer = await import("~/entry.server");
  const rootModule = await import("~/root");
  const { SiteHeader } = await import("~/components/site-header");
  const { stubServerBuild } = await import("./server-build");
  /* The route-module transform in the real build hands ErrorBoundary its `error` prop through this
   * wrapper. Without it the boundary gets no props here and renders its generic branch for a 404. */
  const { UNSAFE_withErrorBoundaryProps } = await import("react-router");

  const Page = () =>
    h(
      "div",
      null,
      h(SiteHeader),
      h("main", { id: "main" }, "page"),
      h("template", { "data-island": "blog" }),
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
      root: {
        id: "root",
        path: "",
        module: { ...rootModule, ErrorBoundary: UNSAFE_withErrorBoundaryProps(rootModule.ErrorBoundary) },
      },
      home: { id: "home", parentId: "root", index: true, module: { default: Page } },
    },
    assetRoutes: {
      root: assetRoute("root", "", true),
      home: assetRoute("home", undefined, false, "root"),
    },
  });
  return { ...build, default: build };
});

async function render(path: string) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`https://example.com${path}`) as never, env as never, ctx);
  const html = await response.text();
  await waitOnExecutionContext(ctx);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attrs, text]) => ({
    type: /\btype="([^"]*)"/.exec(attrs ?? "")?.[1] ?? "",
    text: text ?? "",
  }));
  return { response, html, scripts, policy: response.headers.get("content-security-policy") ?? "" };
}

it("renders a public page with no inline script, no hash and no nonce, and /site.js to start its islands", async () => {
  const { response, html, scripts, policy } = await render("/");
  expect(response.status).toBe(200);

  /* The policy: no nonce and no hash; 'self' covers /site.js and the islands it imports. */
  expect(policy).not.toContain("nonce-");
  expect(policy).not.toMatch(/'sha256-/);

  /* The document: no nonce anywhere, and one script, /site.js, deferred. */
  expect(html).not.toMatch(/\snonce=/);
  expect([...html.matchAll(/<script\b[^>]*\ssrc="([^"]*)"[^>]*>/g)].map((m) => m[1])).toEqual(["/site.js"]);
  expect(html).toMatch(/<script src="\/site\.js" defer="">/);
  expect(scripts.filter((s) => s.type !== "application/ld+json").map((s) => s.text)).toEqual([""]);
  expect(scripts.filter((s) => s.type === "application/ld+json")).toHaveLength(1);

  /* The markers /site.js starts: the header's two and the page's own. */
  const markers = [...html.matchAll(/<template data-island="([a-z-]+)"><\/template>/g)].map((m) => m[1]);
  expect(markers).toEqual(["theme", "header", "blog"]);
});

/*
 * Prefetch by header (site-runtime ./prefetch): every public page names the one rules file, which the Worker serves.
 * And the preloads root.tsx links, as the `Link` header Cloudflare Early Hints reads.
 */
it("names the prefetch rules and the preloads on a public page, and serves the rules", async () => {
  for (const path of ["/", "/no-such-page"]) {
    const { response } = await render(path);
    expect(response.headers.get(SPECULATION_RULES_HEADER.name), path).toBe(SPECULATION_RULES_HEADER.value);
    expect(response.headers.get("Link"), path).toBe(PRELOADS.header);
  }
  const ctx = createExecutionContext();
  const rules = await worker.fetch(new Request(`https://example.com${SPECULATION_RULES_PATH}`) as never, env as never, ctx);
  await waitOnExecutionContext(ctx);
  expect(rules.headers.get("content-type")).toBe("application/speculationrules+json");
  const body = JSON.stringify(await rules.json());
  for (const prefix of ["/lab", "/media", "/search/ask"]) expect(body, prefix).toContain(`"href_matches":"${prefix}"`);
});

/*
 * The 404 page's way on, for a reader arriving on an old link, as the markup a reader without script
 * gets: a plain GET form to /search with the query in `q`, started with the words of the missing
 * address, and a link to each of the header's sections, read off NAV so a section added there is
 * expected here too. Scoped to the page's own nav, because the header carries the same links.
 */
it("gives a 404 a search form and the header's sections", async () => {
  const { response, html, policy } = await render("/2019/05/phage-isolation-protocol");
  expect(response.status).toBe(404);
  expect(html).toContain(">Page not found<");

  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const form = /<form\b([^>]*)>([\s\S]*?)<\/form>/.exec(main);
  expect(form, "a search form in main").not.toBeNull();
  const formAttrs = form?.[1] ?? "";
  expect(formAttrs).toMatch(/\smethod="get"/);
  expect(formAttrs).toMatch(/\saction="\/search"/);
  const input = /<input\b[^>]*\sname="q"[^>]*>/.exec(form?.[2] ?? "")?.[0] ?? "";
  expect(input, "a q field in the form").not.toBe("");
  expect(input).toMatch(/\stype="search"/);
  /* The year and month are dropped: a bare year would narrow the search to that year. */
  expect(input).toMatch(/\svalue="phage isolation protocol"/);

  const start = main.indexOf('aria-labelledby="not-found-sections"');
  expect(start, "the sections nav").toBeGreaterThan(-1);
  const sections = main.slice(start, main.indexOf("</nav>", start));
  const hrefs = [...sections.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
  expect(hrefs).toEqual(NAV.map((item) => item.to));

  /* The form submits to this origin, which the policy's form-action allows. */
  expect(policy).toContain("form-action 'self'");
});

/* The shared package's check (packages/security-headers), on this site's real response: the reusable
 * gate foxing and txasm run on theirs. The public arm here; the admin arm is in ssr-nonce.test.ts's
 * territory and is held by test/security-headers-package.test.mjs against the same policy builder. */
it("passes the shared security-headers check on a rendered public page", async () => {
  const { response } = await render("/");
  expect(failures(checkSecurityHeaders(response.headers, { standard: SECURITY_HEADERS, cloudflareWebAnalytics: true }))).toEqual([]);
});
