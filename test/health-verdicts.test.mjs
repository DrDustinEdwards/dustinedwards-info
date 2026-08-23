/**
 * The health run's verdicts.
 *
 * REPLAYS THE DEFECT, per hard rule 12. The defect is not a wrong verdict; it
 * is that on 31 July 2026 the Ask index lost nine records, `askIndexStatus`
 * computed that number correctly for 21 days, and no verdict existed to turn it
 * into anything. So the replay is the shape of that day's reading: nine
 * missing, and an assertion that it is reported as a breach and that the number
 * nine survives into the sentence a person reads.
 *
 * The second check is the R2 acceptance trip-wire. Its replay is the future
 * event rather than a past one, because the whole point of it is that the
 * condition it watches for has not happened yet: `MEDIA` measured empty on
 * 2026-08-22, RECOVERY.md section 3 accepted having no backup on that basis,
 * and one uploaded object ends the acceptance.
 *
 * @see app/lib/health/verdicts.mjs
 * @see workers/health.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  HEARTBEAT_KEY,
  alertText,
  askDriftVerdict,
  mediaUnbackedVerdict,
} from "../app/lib/health/verdicts.mjs";

test("nine missing records is a breach, and the nine reaches the message", () => {
  const verdict = askDriftVerdict({
    expected: 46,
    present: 37,
    missing: Array.from({ length: 9 }, (_, i) => `missing-key-${i}`),
    stale: [],
  });

  assert.equal(verdict.ok, false, "nine missing records must not read as healthy");
  assert.match(verdict.detail, /drift 9\b/, "the drift count belongs in the sentence");
  assert.match(verdict.detail, /9 missing/);
  assert.match(verdict.detail, /sync-ask/, "a breach must name its repair");
});

test("an index in step is not a breach", () => {
  const verdict = askDriftVerdict({ expected: 46, present: 46, missing: [], stale: [] });
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /46 expected/);
});

test("STALE counts as drift too, in the other direction", () => {
  // A record the corpus no longer knows about is a reader getting a wrong
  // answer just as much as one the index lacks. A verdict that only counted
  // `missing` would pass while Ask cited a deleted post.
  const verdict = askDriftVerdict({ expected: 12, present: 15, missing: [], stale: ["a", "b", "c"] });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /drift 3\b/);
  assert.match(verdict.detail, /3 stale/);
});

test("both directions are summed, not maxed", () => {
  const verdict = askDriftVerdict({ expected: 10, present: 10, missing: ["x"], stale: ["y"] });
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /drift 2\b/, "one missing plus one stale is two problems");
});

test("an empty MEDIA bucket keeps the no-backup acceptance alive", () => {
  const verdict = mediaUnbackedVerdict([]);
  assert.equal(verdict.ok, true);
  assert.match(verdict.detail, /RECOVERY\.md section 3/, "the verdict must cite what it rests on");
});

test("one uploaded original ends the acceptance and names the key", () => {
  const verdict = mediaUnbackedVerdict([{ key: "posts/first-upload.png" }]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.detail, /posts\/first-upload\.png/, "name the object, not just the count");
  assert.match(verdict.detail, /not regenerable/);
  assert.match(verdict.detail, /re-decided/);
});

test("the alert text is self-contained, because destinations render one field", () => {
  const text = alertText([
    { name: "ask-index-drift", detail: "Ask index drift 9: 9 missing, 0 stale." },
    { name: "media-unbacked", detail: "MEDIA bucket is NO LONGER EMPTY." },
  ]);

  // Everything a person needs must survive being read as a bare string, with
  // no sibling keys in the envelope to fall back on.
  assert.match(text, /dustinedwards\.info/, "which site");
  assert.match(text, /FAILED \(2\)/, "how many");
  assert.match(text, /ask-index-drift/, "which check");
  assert.match(text, /9 missing/, "the numbers");
  assert.match(text, /media-unbacked/, "and the other check, not just the first");
});

test("the heartbeat key is stable, because a rename orphans the last run", () => {
  assert.equal(HEARTBEAT_KEY, "health:last-run");
});
