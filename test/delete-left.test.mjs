import assert from "node:assert/strict";
import { test } from "node:test";

import { DELETE_LEFT_PARAM, deleteLeftBehind } from "../app/lib/editor/delete-left.mjs";

test("a clean delete carries nothing to say", () => {
  assert.equal(deleteLeftBehind(new URLSearchParams()), null);
  assert.equal(deleteLeftBehind(new URLSearchParams({ deleted: "a-post" })), null);
});

test("each known code becomes its sentence, and an unknown code is dropped", () => {
  const params = new URLSearchParams({ deleted: "a-post" });
  params.append(DELETE_LEFT_PARAM, "ask");
  params.append(DELETE_LEFT_PARAM, "purge");
  params.append(DELETE_LEFT_PARAM, "<script>");
  const left = deleteLeftBehind(params);
  assert.equal(left?.slug, "a-post");
  assert.equal(left?.problems.length, 2);
  assert.match(left?.problems[0] ?? "", /Ask can still quote it/);
  assert.match(left?.problems[1] ?? "", /cache purge failed/);
});
