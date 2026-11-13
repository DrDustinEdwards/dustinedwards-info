import { createExecutionContext, env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterContextProvider, createRoutesStub } from "react-router";
import { vi } from "vitest";

import { carrelStep } from "~/lib/carrel/site-api.server";
import { Renderer } from "../../workers/app";
import {
  cloudflareContext,
  documentHandlerContext,
  getEnv,
  getExecutionContext,
} from "~/lib/context";
import { testEnv } from "./test-env";

/**
 * Driving route modules directly: the router context their loaders read, the middleware chain in
 * front of them, a rendered route component, and the frozen clock the rate-limit cases need.
 */

/** The router context a loader or action reads its bindings from, `overrides` spread over the env. */
export function routeContext(
  ctx: ExecutionContext = createExecutionContext(),
  overrides: object = {},
) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...env, ...overrides } as never, ctx });
  return context;
}

/**
 * A request through Carrel's gateway step (workers/app.ts), with the kit's in-process render taken from the
 * context's document handler, which a case sets to stand in for the app build a test has not got. Off the step's
 * paths the gateway passes it on to the site's 404, which this answers in its place.
 */
export async function carrelRequest({
  request,
  context,
}: {
  request: Request;
  context: RouterContextProvider;
}): Promise<Response> {
  const render = context.get(documentHandlerContext);
  const kit = {
    url: new URL(request.url),
    render: (page: Request, extra?: { set?: (context: RouterContextProvider) => void }) => {
      if (!render) throw new Error("the case set no document handler on the context");
      return render(page, extra?.set ?? (() => {}));
    },
    stylesheets: async () => [],
    purgeAfterWrite: () => {},
    secure: (response: Response) => response,
  };
  const answer = await carrelStep(
    request,
    getEnv(context),
    getExecutionContext(context) as ExecutionContext,
    kit,
  );
  return answer ?? new Response("Not found", { status: 404 });
}

/** A GET to Carrel's API with the site key, through the gateway step. */
export const carrelGet = (url: string) =>
  carrelRequest({
    request: new Request(url, { headers: carrelHeaders() }),
    context: routeContext(),
  });

/** A JSON write to Carrel's API with the site key, through the gateway step. */
export const carrelSend = (method: "PUT" | "POST", url: string, body: unknown) =>
  carrelRequest({
    request: new Request(url, { method, headers: carrelHeaders(), body: JSON.stringify(body) }),
    context: routeContext(),
  });

function carrelHeaders() {
  return {
    authorization: `Bearer ${testEnv.CARREL_SITE_KEY}`,
    "content-type": "application/json",
    "cf-connecting-ip": "203.0.113.9",
  };
}

/**
 * A save's purge goes to the Renderer over the Worker's loopback (cache-purge.server.ts), which Miniflare cannot purge:
 * each purge's tags go to `purge` in its place, answered with its `success`.
 */
export function recordPurges(
  purge: (options: { tags: string[] }) => Promise<{ success: boolean }>,
) {
  vi.spyOn(Renderer.prototype, "purgePages").mockImplementation(
    async (_why: string, tags: string[] = []) => (await purge({ tags })).success,
  );
}

type Middleware = (args: never, next: () => Promise<unknown>) => Promise<unknown>;

/** Runs `args` through each middleware in order and then `handler`, as the router would. */
export function throughMiddleware(
  middleware: readonly unknown[],
  handler: (args: never) => unknown,
  args: never,
): Promise<unknown> {
  const run = async (index: number): Promise<unknown> => {
    const step = middleware[index] as Middleware | undefined;
    return step ? step(args, () => run(index + 1)) : handler(args);
  };
  return run(0);
}

/** Renders a route component at `url` with the props the router would hand it. */
export function renderRoute(
  path: string,
  Component: unknown,
  props: Record<string, unknown>,
  url: string = path,
) {
  const Stub = createRoutesStub([
    {
      path,
      Component: () => createElement(Component as never, { ...props, params: {}, matches: [] }),
    },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [url] }));
}

/** The whitespace-collapsed text of every element matching `selector`, in document order. */
export async function textsOf(html: string, selector: string): Promise<string[]> {
  const texts: string[] = [];
  await new HTMLRewriter()
    .on(selector, {
      element() {
        texts.push("");
      },
      text(chunk) {
        const last = texts.length - 1;
        texts[last] = (texts[last] ?? "") + chunk.text;
      },
    })
    .transform(new Response(html))
    .text();
  return texts.map((t) => t.replace(/\s+/g, " ").trim());
}

/**
 * On a ten-minute boundary, so it is on every shorter one too: a case that advances by a window
 * length lands exactly on the next one, and the arithmetic under test is the limiter's.
 */
export const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

/**
 * Freezes `Date` at WINDOW_START. The limiters key on a FIXED wall-clock window, so a boundary
 * crossed mid-loop would reset the count and the refusal would arrive late or never. Only `Date`
 * is faked; the Durable Object call underneath is real RPC. Each file restores real timers in
 * `afterEach`, so a case failing mid-assertion cannot leak a frozen clock.
 */
export function freezeAtWindowStart() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WINDOW_START);
}

/**
 * Calls `call` up to `max` times, stopping at the first result `isRefusal` accepts. Returns that
 * refusal, or null if none came, and every result in call order, the refusal included.
 */
export async function untilRefused<T>(
  call: () => Promise<T>,
  isRefusal: (result: T) => boolean,
  max: number,
): Promise<{ refusal: T | null; results: T[] }> {
  const results: T[] = [];
  for (let i = 0; i < max; i += 1) {
    const result = await call();
    results.push(result);
    if (isRefusal(result)) return { refusal: result, results };
  }
  return { refusal: null, results };
}
