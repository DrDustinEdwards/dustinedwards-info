import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { allowedRedirects, registrationRefusal } from "../src/registration.ts";

const GEMINI = "https://vertexaisearch.cloud.google.com/oauth-redirect";
const GROK = "https://grok.com/connector/callback";
const LIST = `${GEMINI}, ${GROK}`;

describe("tightened dynamic client registration (rule 13)", () => {
  test("the allowlist is comma separated and trimmed", () => {
    assert.deepEqual(allowedRedirects(` ${GEMINI} ,,${GROK} `), [GEMINI, GROK]);
    assert.deepEqual(allowedRedirects(undefined), []);
  });

  test("an allowlisted redirect URI registers", () => {
    assert.equal(registrationRefusal(LIST, { redirect_uris: [GEMINI] }), null);
    assert.equal(registrationRefusal(LIST, { redirect_uris: [GEMINI, GROK] }), null);
  });

  test("an empty allowlist refuses every registration", () => {
    assert.match(registrationRefusal("", { redirect_uris: [GEMINI] }) ?? "", /closed/);
    assert.match(registrationRefusal(undefined, { redirect_uris: [GEMINI] }) ?? "", /closed/);
  });

  test("matching is exact: no prefix, no extra path, no other scheme or host", () => {
    for (const uri of [
      `${GEMINI}/x`,
      `${GEMINI}?a=1`,
      GEMINI.replace("https", "http"),
      "https://evil.test/oauth-redirect",
      "http://localhost:8080/callback",
      GEMINI.toUpperCase(),
    ]) {
      assert.match(registrationRefusal(LIST, { redirect_uris: [uri] }) ?? "", /not allowlisted/, uri);
    }
  });

  test("one bad URI among good ones refuses the whole registration, naming it", () => {
    const why = registrationRefusal(LIST, { redirect_uris: [GEMINI, "https://evil.test/cb"] });
    assert.match(why ?? "", /evil\.test/);
  });

  test("no redirect URIs, or a non-list, is refused", () => {
    assert.match(registrationRefusal(LIST, {}) ?? "", /at least one/);
    assert.match(registrationRefusal(LIST, { redirect_uris: [] }) ?? "", /at least one/);
    assert.match(registrationRefusal(LIST, { redirect_uris: GEMINI }) ?? "", /at least one/);
    assert.match(registrationRefusal(LIST, { redirect_uris: [7] }) ?? "", /not allowlisted/);
  });
});
