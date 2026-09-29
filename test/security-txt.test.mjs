import test from "node:test";
import assert from "node:assert/strict";

import { SECURITY_CONTACT, SECURITY_TXT_EXPIRES, securityTxt } from "../app/lib/security-txt.mjs";

const ORIGIN = "https://example.test";
const DAY = 24 * 60 * 60 * 1000;

test("security.txt names the security address and its own canonical URL (RFC 9116)", () => {
  const body = securityTxt(ORIGIN);
  assert.equal(SECURITY_CONTACT, "security@dustinedwards.info");
  assert.match(body, /^Contact: mailto:security@dustinedwards\.info$/m);
  assert.match(body, /^Canonical: https:\/\/example\.test\/\.well-known\/security\.txt$/m);
  assert.match(body, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/m);
});

test("security.txt is renewed before it lapses: Expires is at least 30 days and at most a year away", () => {
  const remaining = Date.parse(SECURITY_TXT_EXPIRES) - Date.now();
  assert.ok(
    remaining > 30 * DAY,
    `Expires ${SECURITY_TXT_EXPIRES} is under 30 days away: confirm ${SECURITY_CONTACT} still delivers, then move it on`,
  );
  assert.ok(remaining <= 366 * DAY, "RFC 9116 recommends an Expires less than a year out");
});
