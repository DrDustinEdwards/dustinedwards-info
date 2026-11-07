import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { invokeTool } from "@dustinedwards/site-runtime/mcp-server";

import { SERVER } from "../src/mcp-handler.ts";
import { TOOLS } from "../src/tools.ts";
import {
  AUDIT,
  FIRST_PUBLISH_REFUSAL,
  READER,
  TOKEN,
  WRITER,
  fakeOperator,
  freshEnv,
  type FakeOperator,
} from "./fake-operator.ts";
import type { Caller } from "../src/auth.ts";

const SHA = "0123abc";
let ENV = freshEnv();

function tool(name: string) {
  const found = TOOLS.find((t) => t.name === name);
  assert.ok(found, `no tool named ${name}`);
  return found;
}

/** Validates the args as the MCP server would, then goes through the one door, as mcp-handler.ts does. */
async function call(
  name: string,
  args: Record<string, unknown>,
  caller: Caller | undefined = WRITER,
) {
  const t = tool(name);
  const parsed = t.config.inputSchema.parse(args) as Record<string, unknown>;
  const output = await invokeTool(ENV, SERVER, {
    caller,
    tool: t,
    args: parsed,
    run: () => t.handler(ENV, parsed),
  });
  if (!output.isError)
    t.config.outputSchema.parse((output as { structuredContent?: unknown }).structuredContent);
  return output as Awaited<ReturnType<typeof t.handler>>;
}

let api: FakeOperator;
beforeEach(() => {
  ENV = freshEnv();
  api = fakeOperator({ body: { ok: true, data: { done: true } } });
});
afterEach(() => api.restore());

describe("the tool surface", () => {
  test("is exactly the five dei_ tools, each named once", () => {
    assert.deepEqual(
      TOOLS.map((t) => t.name),
      [
        "dei_read_registry",
        "dei_refresh_citations",
        "dei_check_publications",
        "dei_read_procedure",
        "dei_save_procedure",
      ],
    );
  });

  test("no post tool survives the move (Carrel owns writing)", () => {
    for (const t of TOOLS) assert.doesNotMatch(t.name, /post/);
  });

  test("annotations are set honestly, tool by tool", () => {
    // [readOnly, destructive, idempotent, openWorld]
    const expected: Record<string, [boolean, boolean, boolean, boolean]> = {
      dei_read_registry: [true, false, true, false],
      dei_refresh_citations: [false, false, true, true],
      dei_check_publications: [true, false, true, true],
      dei_read_procedure: [true, false, true, false],
      dei_save_procedure: [false, false, false, false],
    };
    for (const t of TOOLS) {
      const a = t.config.annotations;
      assert.deepEqual(
        [a.readOnlyHint, a.destructiveHint, a.idempotentHint, a.openWorldHint],
        expected[t.name],
        t.name,
      );
    }
  });

  test("a read-only tool needs only dei.read, and every other tool needs dei.write", () => {
    for (const t of TOOLS) {
      assert.equal(t.scope, t.config.annotations.readOnlyHint ? "dei.read" : "dei.write", t.name);
    }
  });
});

/** One-request tools: the operator request each must send, and nothing else. */
const MAPPINGS: Array<{
  name: string;
  args: Record<string, unknown>;
  tool: string;
  sent: Record<string, unknown>;
}> = [
  { name: "dei_refresh_citations", args: {}, tool: "refresh_citations", sent: {} },
  {
    name: "dei_refresh_citations",
    args: { dois: ["10.1/x"] },
    tool: "refresh_citations",
    sent: { dois: ["10.1/x"] },
  },
  { name: "dei_check_publications", args: {}, tool: "check_publications", sent: {} },
  { name: "dei_read_registry", args: {}, tool: "list_registry", sent: {} },
  {
    name: "dei_read_registry",
    args: { kind: "primer" },
    tool: "list_registry",
    sent: { kind: "primer" },
  },
  {
    name: "dei_read_registry",
    args: { record_key: "primer/m13" },
    tool: "get_registry",
    sent: { slug: "primer/m13" },
  },
  { name: "dei_read_procedure", args: { action: "list" }, tool: "list_procedures", sent: {} },
  {
    name: "dei_read_procedure",
    args: { action: "get", slug: "dna-prep" },
    tool: "get_procedure",
    sent: { slug: "dna-prep" },
  },
  {
    name: "dei_save_procedure",
    args: { slug: "dna-prep", raw: "r", expected_head_sha: SHA, is_new: false },
    tool: "save_procedure",
    sent: { slug: "dna-prep", raw: "r", expectedHeadSha: SHA, isNew: false },
  },
  {
    name: "dei_save_procedure",
    args: { slug: "p", raw: "r" },
    tool: "save_procedure",
    sent: { slug: "p", raw: "r" },
  },
];

describe("each tool maps to its operator requests", () => {
  for (const { name, args, tool: sentTool, sent } of MAPPINGS) {
    test(`${name} ${JSON.stringify(args)}`, async () => {
      const out = await call(name, args);
      assert.equal(out.isError, undefined, out.content[0].text);
      assert.equal(api.calls.length, 1);
      assert.deepEqual(api.calls[0].body, { tool: sentTool, args: sent });
      assert.equal(api.calls[0].headers.get("authorization"), `Bearer ${TOKEN}`);
    });
  }
});

describe("lists come back a page at a time", () => {
  test("the default page is 25, with has_more and an opaque next_cursor", async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ slug: `p${i}` }));
    api.reply({ body: { ok: true, data: { headSha: SHA, procedures: items } } });
    const out = await call("dei_read_procedure", { action: "list" });
    const data = out.structuredContent as { procedures: unknown[]; page: Record<string, unknown> };
    assert.equal(data.procedures.length, 25);
    assert.equal(data.page.total, 30);
    assert.equal(data.page.has_more, true);
    assert.equal(typeof data.page.next_cursor, "string");

    // Passing the cursor back reads on from where the first page stopped, to the last page.
    api.reply({ body: { ok: true, data: { headSha: SHA, procedures: items } } });
    const next = await call("dei_read_procedure", {
      action: "list",
      cursor: data.page.next_cursor,
    });
    const rest = next.structuredContent as {
      procedures: Array<{ slug: string }>;
      page: Record<string, unknown>;
    };
    assert.deepEqual(
      rest.procedures.map((p) => p.slug),
      ["p25", "p26", "p27", "p28", "p29"],
    );
    assert.equal(rest.page.has_more, false);
    assert.equal(rest.page.next_cursor, null);
  });
});

describe("input errors say how to fix the input", () => {
  test("get without a slug", async () => {
    const out = await call("dei_read_procedure", { action: "get" });
    assert.equal(out.isError, true);
    assert.match(out.content[0].text, /needs slug/);
    assert.equal(api.calls.length, 0);
  });

  test("kind with a record_key", async () => {
    const out = await call("dei_read_registry", { record_key: "primer/m13", kind: "primer" });
    assert.match(out.content[0].text, /kind narrows a list only/);
    assert.equal(api.calls.length, 0);
  });

  const bad: Array<[string, Record<string, unknown>]> = [
    ["dei_read_procedure", { action: "list", limit: 0 }],
    ["dei_read_procedure", { action: "list", limit: 101 }],
    ["dei_read_procedure", { action: "list", cursor: "25" }],
    ["dei_read_procedure", { action: "list", cursor: btoa("o:-1") }],
    ["dei_read_registry", { registry: "pages" }],
    ["dei_read_procedure", { action: "save", slug: "p" }],
    ["dei_read_procedure", { action: "get", slug: "A_b" }],
    ["dei_save_procedure", { slug: "p" }],
    ["dei_save_procedure", { slug: "p", raw: "r", expected_head_sha: "xyz1234" }],
    ["dei_save_procedure", { slug: "p", raw: "r", action: "save" }],
    ["dei_refresh_citations", { dois: [] }],
  ];
  for (const [name, args] of bad) {
    test(`${name} rejects ${JSON.stringify(args).slice(0, 60)}`, () => {
      assert.equal(tool(name).config.inputSchema.safeParse(args).success, false);
    });
  }
});

describe("tool results", () => {
  test("a 403 first-publish refusal reaches the caller in the API's words", async () => {
    api.reply(FIRST_PUBLISH_REFUSAL);
    const out = await call("dei_save_procedure", { slug: "a", raw: "---\ndraft: false\n---\n" });
    assert.equal(out.isError, true);
    assert.equal(
      out.content[0].text,
      `${FIRST_PUBLISH_REFUSAL.body.error}\npolicy: first-publish-requires-admin`,
    );
    assert.deepEqual(out.structuredContent, {
      status: 403,
      error: FIRST_PUBLISH_REFUSAL.body.error,
      detail: FIRST_PUBLISH_REFUSAL.body.detail,
    });
  });

  test("a 422 relays each validator message as written, in order", async () => {
    api.reply({
      status: 422,
      body: {
        ok: false,
        error: "procedure failed validation",
        detail: { errors: ["step 2: no timer", 5, "MISSING: temp"], line: 0 },
      },
    });
    const out = await call("dei_save_procedure", { slug: "p", raw: "r" });
    assert.equal(
      out.content[0].text,
      "procedure failed validation\nline: 0\nstep 2: no timer\nMISSING: temp",
    );
  });

  test("a wrapper-side failure reads differently from an API refusal", async () => {
    api.reply({ throws: new TypeError("fetch failed") });
    const out = await call("dei_refresh_citations", {});
    assert.equal(out.isError, true);
    // The kind of failure, never the error's own text (S4): that goes to the Worker log.
    assert.equal(
      out.content[0].text,
      "The wrapper could not complete its request to the operator API (unreachable). The detail is in the server's log.",
    );
    assert.ok(!out.content[0].text.includes("fetch failed"));
  });

  test("an unconfigured wrapper says so as a tool error and sends nothing", async () => {
    const out = await tool("dei_refresh_citations").handler({ ...ENV, SITE: undefined }, {});
    assert.match(out.content[0].text, /\(unconfigured\)\./);
    assert.equal(api.calls.length, 0);
  });

  test("no tool output or log carries the operator token", async () => {
    for (const reply of [
      { body: { ok: true, data: {} } },
      FIRST_PUBLISH_REFUSAL,
      { throws: new Error("x") },
    ]) {
      api.reply(reply);
      const out = await call("dei_read_procedure", { action: "get", slug: "a" });
      assert.ok(!JSON.stringify(out).includes(TOKEN));
    }
    assert.ok(api.logs.every((line) => !line.includes(TOKEN)));
    assert.ok(AUDIT.rows.every((row) => !JSON.stringify(row).includes(TOKEN)));
  });
});

describe("the wrapper adds no policy of its own", () => {
  test("a first publish is forwarded for the API to decide", async () => {
    const raw = "---\ndraft: false\n---\n";
    await call("dei_save_procedure", { slug: "p", raw });
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0].body?.args.raw, raw);
  });
});

describe("least scope: read by default, write only when granted", () => {
  test("a read-only grant reads", async () => {
    const out = await call("dei_read_registry", {}, READER);
    assert.equal(out.isError, undefined);
  });

  for (const [name, args] of [
    ["dei_refresh_citations", {}],
    ["dei_save_procedure", { slug: "p", raw: "r" }],
  ] as const) {
    test(`a read-only grant cannot run ${name}, and is told how to get write`, async () => {
      const out = await call(name, args, READER);
      assert.equal(out.isError, true);
      assert.match(out.content[0].text, /read access only.*Allow changes/s);
      assert.equal(api.calls.length + api.healthCalls.length, 0);
    });
  }

  test("dei_read_procedure list and get need only read", async () => {
    assert.equal((await call("dei_read_procedure", { action: "list" }, READER)).isError, undefined);
    assert.equal(
      (await call("dei_read_procedure", { action: "get", slug: "p" }, READER)).isError,
      undefined,
    );
  });
});
