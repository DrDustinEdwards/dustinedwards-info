/**
 * A fake site for tests. It replaces globalThis.fetch, which the fake SITE
 * binding below calls, so nothing here touches the network, and records every
 * request the wrapper makes so a test can assert what crossed the API leg. It
 * also captures console output, so a test can prove the operator token was
 * never logged, and it stands in for the tool-call log Durable Object.
 */

import type { Caller } from "../src/auth.ts";

export const TOKEN = "op-token-0123456789abcdef0123456789abcdef";
export const ORIGIN = "https://site.test";
export const API_URL = `${ORIGIN}/api/operator`;
export const HEALTH_URL = `${ORIGIN}/api/health`;
export const ADMIN = "admin@example.com";

/** A SITE binding whose fetch is whatever globalThis.fetch is at call time. */
export const SITE = { fetch: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init) } as unknown as Fetcher;

export interface AuditFake {
  namespace: DurableObjectNamespace;
  rows: Array<Record<string, unknown>>;
  /** Makes the next append answer 500. */
  failNext(): void;
}

export function auditLog(): AuditFake {
  let fail = false;
  const rows: Array<Record<string, unknown>> = [];
  const stub = {
    async fetch(_input: RequestInfo | URL, init?: RequestInit) {
      if (fail) {
        fail = false;
        return new Response("down", { status: 500 });
      }
      rows.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    },
  };
  return {
    rows,
    failNext() {
      fail = true;
    },
    namespace: { idFromName: (name: string) => name, get: () => stub } as unknown as DurableObjectNamespace,
  };
}

export let AUDIT = auditLog();

export function freshEnv() {
  AUDIT = auditLog();
  return {
    SITE,
    SITE_ORIGIN: ORIGIN,
    OPERATOR_TOKEN: TOKEN,
    ADMIN_EMAIL: ADMIN,
    TOOL_CALL_LOG: AUDIT.namespace,
  };
}

/** The administrator, holding read and write. */
export const WRITER: Caller = {
  kind: "admin",
  props: { email: ADMIN, scopes: ["dei.read", "dei.write"] },
  scopes: ["dei.read", "dei.write"],
};

/** The administrator, holding read only. */
export const READER: Caller = {
  kind: "admin",
  props: { email: ADMIN, scopes: ["dei.read"] },
  scopes: ["dei.read"],
};

export interface Recorded {
  url: string;
  method: string;
  headers: Headers;
  body: { tool: string; args: Record<string, unknown> } | null;
}

type Reply = { status?: number; body: unknown } | { raw: string; status?: number } | { throws: Error };

export interface FakeOperator {
  /** Requests to /api/operator. */
  calls: Recorded[];
  /** Requests to /api/health. */
  healthCalls: Recorded[];
  logs: string[];
  /** The next operator reply, or one per call chosen by tool name. */
  reply(next: Reply | ((tool: string) => Reply)): void;
  /** The next health readings, in order; the last one repeats. */
  health(...readings: Reply[]): void;
  restore(): void;
}

function answer(next: Reply): Response {
  if ("throws" in next) throw next.throws;
  if ("raw" in next) return new Response(next.raw, { status: next.status ?? 200 });
  return new Response(JSON.stringify(next.body), {
    status: next.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

export function fakeOperator(initial: Reply = { body: { ok: true, data: {} } }): FakeOperator {
  const realFetch = globalThis.fetch;
  const consoleMethods = ["log", "info", "warn", "error", "debug", "trace"] as const;
  const realConsole = consoleMethods.map((m) => [m, console[m]] as const);
  let next: Reply | ((tool: string) => Reply) = initial;
  let readings: Reply[] = [{ body: { ok: true, checks: [] } }];

  const fake: FakeOperator = {
    calls: [],
    healthCalls: [],
    logs: [],
    reply(r) {
      next = r;
    },
    health(...r) {
      readings = r;
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
    const text = await request.text();
    const recorded = { url: request.url, method: request.method, headers: request.headers, body: text ? JSON.parse(text) : null };
    if (new URL(request.url).pathname === "/api/health") {
      fake.healthCalls.push(recorded);
      const reading = readings.length > 1 ? readings.shift()! : readings[0]!;
      return answer(reading);
    }
    fake.calls.push(recorded);
    return answer(typeof next === "function" ? next(recorded.body?.tool ?? "") : next);
  }) as typeof fetch;

  return fake;
}

/** The refusal the operator API sends when an operator tries a first publish. */
export const FIRST_PUBLISH_REFUSAL = {
  status: 403,
  body: {
    ok: false,
    error:
      "An operator may not publish a procedure for the first time. It is reserved to the admin; leave draft: true.",
    detail: { policy: "first-publish-requires-admin" },
  },
};
