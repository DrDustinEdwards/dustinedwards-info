import assert from "node:assert/strict";
import { test } from "node:test";

import { queueNames } from "../scripts/ensure-queues.mjs";
import { parseJsonc } from "../scripts/lib/wrangler-surface.mjs";

test("the deploy creates every queue the tracked config names, dead-letter queues included", () => {
  const names = queueNames(parseJsonc("wrangler.jsonc.example"));
  for (const name of [
    "dustinedwards-media-events",
    "dustinedwards-media-events-dlq",
    "dustinedwards-webmention-verify",
    "dustinedwards-webmention-verify-dlq",
  ]) {
    assert.ok(names.includes(name), `${name} missing from ${names.join(", ")}`);
  }
});

test("queue names are read from env blocks too, once each", () => {
  const names = queueNames({
    queues: { producers: [{ queue: "a" }], consumers: [{ queue: "a", dead_letter_queue: "a-dlq" }] },
    env: { preview: { queues: { producers: [{ queue: "b" }] } } },
  });
  assert.deepEqual(names, ["a", "a-dlq", "b"]);
});
