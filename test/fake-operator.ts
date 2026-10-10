/**
 * A fake operator API for tests. It replaces globalThis.fetch, so nothing here
 * touches the network, and records every request the wrapper makes so a test
 * can assert what crossed the API leg. It also captures console output, so a
 * test can prove the operator token was never logged.
 */

export const TOKEN = "op-token-0123456789abcdef0123456789abcdef";
export const API_URL = "https://operator.test/api/operator";
export const ENV = { OPERATOR_API_URL: API_URL, OPERATOR_TOKEN: TOKEN };

export interface Recorded {
  url: string;
  method: string;
  headers: Headers;
  body: { tool: string; args: Record<string, unknown> };
}

type Reply = { status?: number; body: unknown } | { raw: string; status?: number } | { throws: Error };

export interface FakeOperator {
  calls: Recorded[];
  logs: string[];
  reply(next: Reply): void;
  restore(): void;
}

export function fakeOperator(initial: Reply = { body: { ok: true, data: {} } }): FakeOperator {
  const realFetch = globalThis.fetch;
  const consoleMethods = ["log", "info", "warn", "error", "debug", "trace"] as const;
  const realConsole = consoleMethods.map((m) => [m, console[m]] as const);
  let next = initial;

  const fake: FakeOperator = {
    calls: [],
    logs: [],
    reply(r) {
      next = r;
    },
    restore() {
      globalThis.fetch = realFetch;
      for (const [m, fn] of realConsole) console[m] = fn;
    },
  };

  for (const m of consoleMethods) {
    console[m] = (...args: unknown[]) => {
      fake.logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
  }

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    fake.calls.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: JSON.parse(await request.text()),
    });
    if ("throws" in next) throw next.throws;
    if ("raw" in next) return new Response(next.raw, { status: next.status ?? 200 });
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return fake;
}

/** The refusal the operator API sends when an operator tries a first publish. */
export const FIRST_PUBLISH_REFUSAL = {
  status: 403,
  body: {
    ok: false,
    error:
      "An operator may not perform a post's first publication. It is reserved to the admin; leave draft: true.",
    detail: { policy: "first-publish-requires-admin" },
  },
};
