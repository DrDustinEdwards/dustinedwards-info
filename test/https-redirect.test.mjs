// Every gateway redirect's status (the https upgrade itself is site-runtime's canonicalRedirect, tested there).

import test from "node:test";
import assert from "node:assert/strict";

import { httpsRedirectStatus } from "../app/lib/https-redirect.mjs";

await test("THE METHOD DECIDES THE STATUS: a POST keeps its body", () => {
  // A 301 permits a client to turn a POST into a GET, which would silently
  // drop the no-script sign-in form's body.
  assert.equal(httpsRedirectStatus("GET"), 301);
  assert.equal(httpsRedirectStatus("HEAD"), 301);
  assert.equal(httpsRedirectStatus("POST"), 308);
  assert.equal(httpsRedirectStatus("DELETE"), 308);
  assert.equal(httpsRedirectStatus("get"), 301, "case must not decide it");
  assert.equal(httpsRedirectStatus(undefined), 308, "unknown method keeps the body");
});
