import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { TOOLS } from "../src/tools.ts";
import { ENV, FIRST_PUBLISH_REFUSAL, TOKEN, fakeOperator, type FakeOperator } from "./fake-operator.ts";

const SHA = "0123abc";

function tool(name: string) {
  const found = TOOLS.find((t) => t.name === name);
  assert.ok(found, `no tool named ${name}`);
  return found;
}

/** Validates the args as the MCP server would, then runs the handler. */
async function call(name: string, args: Record<string, unknown>) {
  const t = tool(name);
  const parsed = t.config.inputSchema.parse(args) as Record<string, unknown>;
  return t.handler(ENV, parsed);
}

let api: FakeOperator;
beforeEach(() => {
  api = fakeOperator({ body: { ok: true, data: { done: true } } });
});
afterEach(() => api.restore());

describe("the tool surface", () => {
  test("is exactly the eleven operator tools, each named once", () => {
    assert.deepEqual(
      TOOLS.map((t) => t.name),
      [
        "list_posts",
        "get_post",
        "save_post",
        "delete_post",
        "sync_status",
        "list_mentions",
        "decide_mention",
        "upload_media",
        "list_procedures",
        "get_procedure",
        "save_procedure",
      ],
    );
  });

  test("annotations are set honestly, tool by tool", () => {
    // [readOnly, destructive, idempotent, openWorld]
    const expected: Record<string, [boolean, boolean, boolean, boolean]> = {
      list_posts: [true, false, true, false],
      get_post: [true, false, true, false],
      save_post: [false, false, false, true],
      delete_post: [false, true, false, true],
      sync_status: [true, false, true, false],
      list_mentions: [true, false, true, false],
      decide_mention: [false, true, true, false],
      upload_media: [false, false, true, true],
      list_procedures: [true, false, true, false],
      get_procedure: [true, false, true, false],
      save_procedure: [false, false, false, true],
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
});

/**
 * Each tool maps to one operator request of the same name. The expected args
 * are what must cross the API leg, and nothing else may.
 */
const MAPPINGS: Array<{ name: string; args: Record<string, unknown>; sent: Record<string, unknown> }> = [
  { name: "list_posts", args: {}, sent: {} },
  { name: "get_post", args: { slug: "hello-world" }, sent: { slug: "hello-world" } },
  { name: "save_post", args: { slug: "a", raw: "---\n---\nx" }, sent: { slug: "a", raw: "---\n---\nx" } },
  {
    name: "save_post",
    args: { slug: "a", raw: "r", expectedHeadSha: SHA, isNew: false },
    sent: { slug: "a", raw: "r", expectedHeadSha: SHA, isNew: false },
  },
  { name: "save_post", args: { slug: "a", raw: "r", isNew: true }, sent: { slug: "a", raw: "r", isNew: true } },
  { name: "delete_post", args: { slug: "a" }, sent: { slug: "a" } },
  { name: "delete_post", args: { slug: "a", expectedHeadSha: SHA }, sent: { slug: "a", expectedHeadSha: SHA } },
  { name: "sync_status", args: {}, sent: {} },
  { name: "list_mentions", args: {}, sent: {} },
  { name: "list_mentions", args: { status: "failed" }, sent: { status: "failed" } },
  { name: "decide_mention", args: { id: 7, decision: "approve" }, sent: { id: 7, decision: "approve" } },
  { name: "upload_media", args: { url: "https://x.test/a.png" }, sent: { url: "https://x.test/a.png" } },
  {
    name: "upload_media",
    args: { data: "aGk=", type: "image/png", name: "a.png" },
    sent: { data: "aGk=", type: "image/png", name: "a.png" },
  },
  { name: "list_procedures", args: {}, sent: {} },
  { name: "get_procedure", args: { slug: "dna-prep" }, sent: { slug: "dna-prep" } },
  { name: "save_procedure", args: { slug: "dna-prep", raw: "r" }, sent: { slug: "dna-prep", raw: "r" } },
  {
    name: "save_procedure",
    args: { slug: "dna-prep", raw: "r", expectedHeadSha: SHA, isNew: true },
    sent: { slug: "dna-prep", raw: "r", expectedHeadSha: SHA, isNew: true },
  },
  { name: "save_procedure", args: { slug: "p", raw: "r", isNew: false }, sent: { slug: "p", raw: "r", isNew: false } },
];

describe("each tool maps to its operator request", () => {
  for (const { name, args, sent } of MAPPINGS) {
    test(`${name} ${JSON.stringify(args)}`, async () => {
      await call(name, args);
      assert.equal(api.calls.length, 1);
      assert.deepEqual(api.calls[0].body, { tool: name, args: sent });
      assert.equal(api.calls[0].headers.get("authorization"), `Bearer ${TOKEN}`);
    });
  }

  test("every tool is covered by a mapping above", () => {
    const covered = new Set(MAPPINGS.map((m) => m.name));
    assert.deepEqual(
      TOOLS.map((t) => t.name).filter((n) => !covered.has(n)),
      [],
    );
  });

  test("tools that take no input forward nothing extra", async () => {
    for (const name of ["list_posts", "sync_status", "list_procedures"]) {
      await tool(name).handler(ENV, { slug: "stray", extra: 1 });
      assert.deepEqual(api.calls.at(-1)!.body, { tool: name, args: {} });
    }
  });
});

describe("tool results", () => {
  test("success returns the API's data as text and as structured content", async () => {
    const data = { slug: "a", commitSha: SHA };
    api.reply({ body: { ok: true, data } });
    const out = await call("save_post", { slug: "a", raw: "r" });
    assert.equal(out.isError, undefined);
    assert.deepEqual(out.content, [{ type: "text", text: JSON.stringify(data, null, 2) }]);
    assert.deepEqual(out.structuredContent, data);
  });

  for (const name of ["save_post", "save_procedure"]) {
    test(`${name}: a 403 first-publish refusal reaches the caller in the API's words`, async () => {
      api.reply(FIRST_PUBLISH_REFUSAL);
      const out = await call(name, { slug: "a", raw: "---\ndraft: false\n---\n" });
      assert.equal(out.isError, true);
      assert.equal(out.content[0].text, `${FIRST_PUBLISH_REFUSAL.body.error}\npolicy: first-publish-requires-admin`);
      assert.deepEqual(out.structuredContent, {
        status: 403,
        error: FIRST_PUBLISH_REFUSAL.body.error,
        detail: FIRST_PUBLISH_REFUSAL.body.detail,
      });
    });
  }

  test("a gate refusal relays field and line alongside the API's prose", async () => {
    api.reply({ status: 400, body: { ok: false, error: "invalid frontmatter", detail: { field: "date", line: 3 } } });
    const out = await call("save_post", { slug: "a", raw: "r" });
    assert.equal(out.content[0].text, "invalid frontmatter\nfield: date\nline: 3");
  });

  test("line 0 is still relayed", async () => {
    api.reply({ status: 400, body: { ok: false, error: "bad", detail: { line: 0 } } });
    const out = await call("save_post", { slug: "a", raw: "r" });
    assert.equal(out.content[0].text, "bad\nline: 0");
  });

  test("a 422 relays each validator message as written, in order", async () => {
    api.reply({
      status: 422,
      body: { ok: false, error: "procedure failed validation", detail: { errors: ["step 2: no timer", 5, "MISSING: temp"] } },
    });
    const out = await call("save_procedure", { slug: "p", raw: "r" });
    assert.equal(out.content[0].text, "procedure failed validation\nstep 2: no timer\nMISSING: temp");
    assert.deepEqual(out.structuredContent, {
      status: 422,
      error: "procedure failed validation",
      detail: { errors: ["step 2: no timer", 5, "MISSING: temp"] },
    });
  });

  test("a refusal without detail reports detail as null", async () => {
    api.reply({ status: 409, body: { ok: false, error: "main moved" } });
    const out = await call("delete_post", { slug: "a", expectedHeadSha: SHA });
    assert.equal(out.content[0].text, "main moved");
    assert.deepEqual(out.structuredContent, { status: 409, error: "main moved", detail: null });
  });

  test("a mention-delete refusal is relayed, not pre-empted", async () => {
    const error = "An operator may not delete a mention.";
    api.reply({ status: 403, body: { ok: false, error, detail: { policy: "mention-delete-requires-admin" } } });
    const out = await call("decide_mention", { id: 3, decision: "delete" });
    assert.equal(api.calls.length, 1);
    assert.equal(out.content[0].text, `${error}\npolicy: mention-delete-requires-admin`);
  });

  test("a wrapper-side failure reads differently from an API refusal", async () => {
    api.reply({ throws: new TypeError("fetch failed") });
    const out = await call("list_posts", {});
    assert.equal(out.isError, true);
    assert.equal(
      out.content[0].text,
      "The wrapper could not complete its request to the operator API (unreachable): " +
        "The operator API could not be reached: fetch failed",
    );
    assert.equal(out.structuredContent, undefined);
  });

  test("an unconfigured wrapper says so as a tool error", async () => {
    const out = await tool("list_posts").handler({}, {});
    assert.equal(out.isError, true);
    assert.match(out.content[0].text, /^The wrapper could not complete its request to the operator API \(unconfigured\): /);
    assert.equal(api.calls.length, 0);
  });

  test("a non-Error thrown by fetch is still reported as unreachable", async () => {
    globalThis.fetch = (() => {
      throw "not an error object";
    }) as unknown as typeof fetch;
    const out = await call("list_posts", {});
    assert.equal(
      out.content[0].text,
      "The wrapper could not complete its request to the operator API (unreachable): " +
        "The operator API could not be reached: not an error object",
    );
  });

  test("an unexpected failure is named as the wrapper's, not the API's", async () => {
    globalThis.fetch = (async () => ({
      status: 200,
      text: () => Promise.reject(new Error("body stream broke")),
    })) as unknown as typeof fetch;
    const out = await call("list_posts", {});
    assert.equal(out.isError, true);
    assert.equal(out.content[0].text, "The wrapper failed unexpectedly: body stream broke");
  });

  test("an unexpected non-Error failure is stringified", async () => {
    globalThis.fetch = (async () => ({ status: 200, text: () => Promise.reject("raw reason") })) as unknown as typeof fetch;
    const out = await call("list_posts", {});
    assert.equal(out.content[0].text, "The wrapper failed unexpectedly: raw reason");
  });

  test("no tool output or log carries the operator token", async () => {
    for (const reply of [{ body: { ok: true, data: {} } }, FIRST_PUBLISH_REFUSAL, { throws: new Error("x") }]) {
      api.reply(reply);
      const out = await call("get_post", { slug: "a" });
      assert.ok(!JSON.stringify(out).includes(TOKEN));
    }
    assert.ok(api.logs.every((line) => !line.includes(TOKEN)));
  });
});

describe("the wrapper adds no policy of its own", () => {
  test("save_post forwards a draft:false file with wide dashes untouched", async () => {
    const raw = "---\ntitle: T\ndraft: false\n---\nA wide dash \u2014 here.";
    await call("save_post", { slug: "a", raw });
    assert.deepEqual(api.calls[0].body, { tool: "save_post", args: { slug: "a", raw } });
  });

  test("save_procedure forwards a first publish for the API to decide", async () => {
    const raw = "---\ndraft: false\n---\n";
    await call("save_procedure", { slug: "p", raw });
    assert.equal(api.calls.length, 1);
    assert.equal(api.calls[0].body.args.raw, raw);
  });

  test("decide_mention forwards delete for the API to refuse", async () => {
    await call("decide_mention", { id: 1, decision: "delete" });
    assert.deepEqual(api.calls[0].body, { tool: "decide_mention", args: { id: 1, decision: "delete" } });
  });

  test("upload_media forwards both or neither source for the API to name", async () => {
    await call("upload_media", { data: "aGk=", url: "https://x.test/a.png" });
    assert.deepEqual(api.calls[0].body.args, { data: "aGk=", url: "https://x.test/a.png" });
    await call("upload_media", {});
    assert.deepEqual(api.calls[1].body.args, {});
  });

  test("upload_media forwards an http url and any type for the API to judge", async () => {
    await call("upload_media", { url: "http://x.test/a.exe", type: "application/x-msdownload" });
    assert.deepEqual(api.calls[0].body.args, { url: "http://x.test/a.exe", type: "application/x-msdownload" });
  });

  test("an empty-string source is not forwarded, so neither does not become both", async () => {
    await tool("upload_media").handler(ENV, { data: "", url: "https://x.test/a.png", type: "", name: "" });
    assert.deepEqual(api.calls[0].body.args, { url: "https://x.test/a.png" });
  });
});

describe("input schemas fail a bad call before the round trip", () => {
  const bad: Array<[string, Record<string, unknown>]> = [
    ["get_post", { slug: "Hello" }],
    ["get_post", { slug: "a--b" }],
    ["get_post", { slug: "-a" }],
    ["get_post", { slug: "" }],
    ["get_post", { slug: "a".repeat(121) }],
    ["get_post", {}],
    ["save_post", { slug: "a" }],
    ["save_post", { slug: "a", raw: "" }],
    ["save_post", { slug: "a", raw: "r", expectedHeadSha: "ABC1234" }],
    ["save_post", { slug: "a", raw: "r", expectedHeadSha: "abc12" }],
    ["save_post", { slug: "a", raw: "r", expectedHeadSha: "a".repeat(41) }],
    ["save_post", { slug: "a", raw: "r", isNew: "yes" }],
    ["delete_post", { slug: "a b" }],
    ["list_mentions", { status: "spam" }],
    ["decide_mention", { id: 0, decision: "approve" }],
    ["decide_mention", { id: 1.5, decision: "approve" }],
    ["decide_mention", { id: "1", decision: "approve" }],
    ["decide_mention", { id: 1, decision: "ignore" }],
    ["upload_media", { url: "" }],
    ["upload_media", { data: "" }],
    ["upload_media", { type: "" }],
    ["upload_media", { name: "" }],
    ["get_procedure", { slug: "A_b" }],
    ["get_procedure", { slug: "dna_prep" }],
    ["get_procedure", { slug: "dna-" }],
    ["get_post", { slug: "a_b" }],
    ["save_procedure", { slug: "p", raw: "" }],
    ["save_procedure", { slug: "p", raw: "r", expectedHeadSha: "xyz1234" }],
  ];
  for (const [name, args] of bad) {
    test(`${name} rejects ${JSON.stringify(args).slice(0, 60)}`, () => {
      assert.equal(tool(name).config.inputSchema.safeParse(args).success, false);
    });
  }

  const good: Array<[string, Record<string, unknown>]> = [
    ["get_post", { slug: "a" }],
    ["get_post", { slug: "where-should-a-blog-store-its-words-2" }],
    ["get_post", { slug: "a".repeat(120) }],
    ["save_post", { slug: "a", raw: "r", expectedHeadSha: "abc1234" }],
    ["save_post", { slug: "a", raw: "r", expectedHeadSha: "a".repeat(40) }],
    ["decide_mention", { id: 1, decision: "reject" }],
    ["list_mentions", { status: "pending" }],
  ];
  for (const [name, args] of good) {
    test(`${name} accepts ${JSON.stringify(args).slice(0, 60)}`, () => {
      assert.equal(tool(name).config.inputSchema.safeParse(args).success, true);
    });
  }
});

describe("descriptions carry the API's policy so a refusal reads as policy", () => {
  for (const name of ["get_post", "save_post", "save_procedure"]) {
    test(`${name} names first-publish-requires-admin`, () => {
      assert.match(tool(name).config.description, /first-publish-requires-admin/);
      assert.match(tool(name).config.description, /enforced by the API and not by this wrapper/);
    });
  }
  test("decide_mention names mention-delete-requires-admin", () => {
    assert.match(tool("decide_mention").config.description, /mention-delete-requires-admin/);
  });
  test("each save tool's sha description names the read that supplies it", () => {
    assert.match(tool("save_post").config.inputSchema.shape.expectedHeadSha.description ?? "", /from get_post/);
    assert.match(tool("save_procedure").config.inputSchema.shape.expectedHeadSha.description ?? "", /from get_procedure/);
  });
});
