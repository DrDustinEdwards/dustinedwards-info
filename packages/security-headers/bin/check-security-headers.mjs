#!/usr/bin/env node
/**
 * The header check against live URLs, for a site's CI:
 *
 *   node packages/security-headers/bin/check-security-headers.mjs https://example.com/ https://example.com/admin
 *
 * Each URL is fetched without following redirects (a 302 must carry the set too) and graded by
 * checkSecurityHeaders. Exits 1 on any failure, 2 when a URL cannot be fetched, so an unreachable site
 * never reads as a pass.
 */

import { checkSecurityHeaders, failures } from "../check.mjs";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error("usage: check-security-headers.mjs <url> [<url> ...]");
  process.exit(2);
}

let failed = 0;
for (const url of urls) {
  let res;
  try {
    res = await fetch(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (security-headers check)" } });
  } catch (error) {
    console.error(`${url}: could not fetch (${error instanceof Error ? error.message : String(error)})`);
    process.exit(2);
  }
  const results = checkSecurityHeaders(res.headers);
  console.log(`\n${url} (${res.status})`);
  for (const r of results) console.log(`  ${r.pass ? "ok  " : "FAIL"} ${r.name}${r.pass ? "" : `: ${r.detail}`}`);
  failed += failures(results).length;
}
console.log(`\n${failed === 0 ? "all checks pass" : `${failed} failure(s)`}`);
process.exit(failed === 0 ? 0 : 1);
