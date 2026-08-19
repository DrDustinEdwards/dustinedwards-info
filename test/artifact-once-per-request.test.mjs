/**
 * `memoizeOnce` calls through once, however many callers ask.
 *
 * WHAT THIS PROTECTS. `loadArtifact` is not a database read. It is an HTTPS
 * round trip off Cloudflare's network to the GitHub Contents API for
 * `content/generated/posts.json`, 601,683 bytes, base64 encoded to roughly
 * 802,000 over the wire, then decoded and parsed inside the Worker. Measured on
 * production at 283 to 528ms per call.
 *
 * `/admin/media` was doing it TWICE. The admin layout's Ask drift check loaded
 * the corpus for a nav badge, and the media loader's citation resolver loaded
 * the same bytes again to scan for keys. `askStatusReader` memoized its own
 * use, which is what made the waste invisible: each half looked careful alone.
 *
 * WHY THE MEMO IS ITS OWN `.mjs` MODULE. The property is "called once", and a
 * memo that stopped memoizing returns the same value, same type, same shape.
 * Only a counter separates them, and counting needs something injectable to
 * count. It cannot live inside `publish.server.ts`, because that file imports
 * through the `~/` alias and `node --test` cannot load it at all.
 *
 * OBSERVATION BOUNDARY, and it is narrower than the defect. This asserts the
 * memo. It does NOT assert that `admin.tsx` installs one, nor that the media
 * loader passes it to `resolveCitations`. **That wiring is asserted by
 * nothing**, and a future edit could drop either call site and leave every test
 * here green while the second GitHub round trip came back. Recorded rather than
 * papered over: closing it needs a source-level gate over route wiring, which
 * no existing gate covers.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { memoizeOnce } from "../app/lib/once.mjs";

test("calls through exactly once across concurrent and later callers", async () => {
  let calls = 0;
  const read = memoizeOnce(async () => {
    calls += 1;
    return { corpus: true };
  });

  const [a, b, c] = await Promise.all([read(), read(), read()]);
  const d = await read();

  assert.equal(calls, 1, `called through ${calls} times, expected 1`);
  // Same object, not merely equal. Two reads would produce equal-looking
  // results and cost the round trip this exists to remove, so a deepEqual here
  // would pass on exactly the failure being prevented.
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(c, d);
});

test("the same call pattern WITHOUT the memo reads four times", async () => {
  // The control. Without this, the assertion above would pass just as happily
  // against a corpus that was only ever asked for once anyway, and would be
  // measuring the test rather than the memo.
  let calls = 0;
  const plain = async () => {
    calls += 1;
    return { corpus: true };
  };
  await Promise.all([plain(), plain(), plain()]);
  await plain();
  assert.equal(calls, 4);
});

test("concurrent callers share one IN-FLIGHT promise, not a resolved value", async () => {
  // The distinction that matters in a loader: three callers inside one
  // Promise.all ask before the first has resolved. A resolved-value cache would
  // let all three start and would satisfy a naive count only after the fact.
  let started = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const read = memoizeOnce(async () => {
    started += 1;
    await gate;
    return "value";
  });

  const all = Promise.all([read(), read(), read()]);
  assert.equal(started, 1, `${started} reads started before any resolved, expected 1`);
  release();
  assert.deepEqual(await all, ["value", "value", "value"]);
});

test("a rejection is not swallowed", async () => {
  // Failure must reach the caller, because `resolveCitations` reports it and
  // the delete path fails closed on it. A memo that turned a throw into a
  // silent empty corpus would turn "could not check" into "nothing cites it".
  const read = memoizeOnce(async () => {
    throw new Error("github 503");
  });
  await assert.rejects(read(), /github 503/);
});
