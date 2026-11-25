import { createExecutionContext } from "cloudflare:test";
import { renderAndWrite } from "~/lib/editor/publish.server";
import { envWithImages } from "./media-fixtures";
import { routeContext, carrelRequest } from "./route-helpers";
import { testEnv } from "./test-env";

/* Through the real gateway step (carrelStep), so the package's guard, the site's limiter and the adapter are the
 * ones that run in production. Each refusal also checks that the repository did not change. */

export const ORIGIN = "https://example.com";
export const PREFIX = `${ORIGIN}/api/carrel/v1`;
/** The stub's fixed head: the version every write here must name to land. */
export const HEAD = "a".repeat(40);

export const siteEnv = () => testEnv as unknown as Parameters<typeof renderAndWrite>[0];

export const headersFor = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});

export const argsFor = (request: Request, overrides?: object) =>
  ({ request, context: routeContext(undefined, overrides), params: {} }) as never;

export function get(url: string, key: string = testEnv.CARREL_SITE_KEY): Promise<Response> {
  return carrelRequest(argsFor(new Request(url, { headers: headersFor(key) })));
}

export function send(method: "PUT" | "POST", url: string, body: unknown): Promise<Response> {
  const request = new Request(url, {
    method,
    headers: headersFor(testEnv.CARREL_SITE_KEY),
    body: JSON.stringify(body),
  });
  return carrelRequest(argsFor(request));
}

export type MediaInit = { body?: BodyInit; type?: string; key?: string };

/** Through the route, with the recorded IMAGES binding and anything in `overrides` over the env. */
export function mediaCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  init: MediaInit = {},
  overrides: object = {},
): Promise<Response> {
  const request = new Request(url, {
    method,
    headers: {
      ...headersFor(init.key ?? testEnv.CARREL_SITE_KEY),
      "content-type": init.type ?? "application/json",
    },
    ...(method === "GET" ? {} : { body: init.body }),
  });
  const args = {
    request,
    context: routeContext(createExecutionContext(), {
      ...envWithImages({ width: 10, height: 10 }),
      ...overrides,
    }),
    params: {},
  } as never;
  return carrelRequest(args);
}
