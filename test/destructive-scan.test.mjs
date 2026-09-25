import test from "node:test";
import assert from "node:assert/strict";

import {
  bindingUses,
  findAction,
  intentBranches,
  isLiteralString,
  objectConst,
  parseSource,
  propertyValue,
} from "../scripts/lib/destructive-scan.mjs";

const P = "confirmationSatisfied";

/** @param {string} body */
function branches(body, name = "r.tsx") {
  const sf = parseSource(name, `export async function action({ request }) {\n${body}\n}`);
  const action = findAction(sf);
  assert.ok(action, "the action was found");
  return intentBranches(action, P);
}

test("a comment naming the predicate does not guard a branch", () => {
  const [b] = branches(`
    const intent = form.get("intent");
    if (intent === "delete") {
      // confirmationSatisfied(typed, 1) used to be here
      await remove();
    }`);
  assert.equal(b.intent, "delete");
  assert.equal(b.guarded, false);
});

test("a real call guards the branch", () => {
  const [b] = branches(`
    if (intent === "delete") {
      if (!confirmationSatisfied(typed, 1)) return confirm();
      await remove();
    }`);
  assert.equal(b.guarded, true);
});

test("an apostrophe in JSX text does not hide the action's comparisons", () => {
  const sf = parseSource(
    "r.tsx",
    `export default function Page() { return <p>Don't {"}"} do it</p>; }
     export async function action() { if (intent === "delete") { await remove(); } }`,
  );
  const found = intentBranches(/** @type {any} */ (findAction(sf)), P);
  assert.deepEqual(found.map((b) => b.intent), ["delete"]);
  assert.equal(found[0].guarded, false);
});

test("form.get(\"intent\") compared directly is part of the vocabulary", () => {
  const found = branches(`if (form.get("intent") === "podcast-slot") { await write(); }`);
  assert.deepEqual(found.map((b) => b.intent), ["podcast-slot"]);
});

test("a !== guard that returns selects the statements after it", () => {
  const found = branches(`
    if (form.get("intent") !== "purge") { return bad(); }
    if (!confirmationSatisfied(typed, 1)) return confirm();
    await purge();`);
  assert.equal(found[0].intent, "purge");
  assert.equal(found[0].guarded, true);
});

test("an intent tested twice is held at both sites", () => {
  const found = branches(`
    if (intent === "delete" || intent === "tag") {
      if (intent === "delete") {
        if (!confirmationSatisfied(typed, 1)) return confirm();
      }
    }
    if (intent === "delete") { await remove(); }`);
  const deletes = found.filter((b) => b.intent === "delete");
  assert.equal(deletes.length, 3);
  assert.deepEqual(deletes.map((b) => b.guarded), [true, true, false]);
});

test("a comparison outside an if condition is reported, not read as guarded", () => {
  const [b] = branches(`return intent === "delete" ? remove() : keep();`);
  assert.equal(b.guarded, false);
  assert.match(b.reason ?? "", /not the condition of an if/);
});

test("switch cases are part of the vocabulary", () => {
  const found = branches(`switch (intent) { case "a": await a(); break; case "b": await b(); }`);
  assert.deepEqual(found.map((b) => b.intent), ["a", "b"]);
});

test("a commented-out comparison is not part of the vocabulary", () => {
  const found = branches(`// if (intent === "ghost") {}\nif (intent === "real") {}`);
  assert.deepEqual(found.map((b) => b.intent), ["real"]);
});

test("a policy must be a non-empty string literal in the descriptor object", () => {
  const sf = parseSource(
    "api.ts",
    `export const TOOL_DESCRIPTORS = {
       a: { args: {}, policy: "refused " + "with 403" },
       b: { args: {} /* policy: "in a comment" */ },
       c: { args: {}, policy: "" },
     };`,
  );
  const obj = objectConst(sf, "TOOL_DESCRIPTORS");
  assert.ok(obj);
  const policy = (/** @type {string} */ name) => {
    const entry = /** @type {any} */ (propertyValue(obj, name));
    return isLiteralString(propertyValue(entry, "policy"));
  };
  assert.equal(policy("a"), true);
  assert.equal(policy("b"), false);
  assert.equal(policy("c"), false);
});

test("a delete through an alias, a destructure or a bracket is caught", () => {
  for (const src of [
    "const b = env.MEDIA_BACKUP; await b.delete(k);",
    "const { MEDIA_BACKUP: m } = env; await m.delete(k);",
    'await env["MEDIA_BACKUP"].delete(k);',
  ]) {
    assert.equal(bindingUses(parseSource("x.ts", src), "MEDIA_BACKUP").deletes.length, 1, src);
  }
});

test("a comment naming the binding is not a use, and a helper it is handed to is reported", () => {
  const quiet = bindingUses(parseSource("x.ts", "// env.MEDIA_BACKUP.delete(k)\nconst a = 1;"), "MEDIA_BACKUP");
  assert.equal(quiet.mentions, 0);
  assert.equal(quiet.deletes.length, 0);
  const handed = bindingUses(parseSource("x.ts", "await wipe(env.MEDIA_BACKUP);"), "MEDIA_BACKUP");
  assert.deepEqual(handed.passedTo, ["wipe"]);
});
