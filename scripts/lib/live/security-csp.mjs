// The ratified security headers by exact value, and the enforced CSP with its per-render nonce.

import { declaredSecurityHeaders } from "../header-constants.mjs";
import { check, get } from "./client.mjs";

export async function run() {
  const expected = Object.entries(declaredSecurityHeaders() ?? {});

  check(
    "security: the ratified header set was parsed from workers/app.ts",
    expected.length > 0,
    "SECURITY_HEADERS did not parse; the assertions below would examine nothing",
  );

  /* The 302 has immutable headers, so it takes the rebuild branch. */
  /** @type {Array<[string, string, number]>} */
  const SURFACES = [
    ["200", "/", 200],
    ["302", "/admin", 302],
  ];
  for (const [label, path, wantStatus] of SURFACES) {
    const { res, status } = await get(path);
    check(`security: ${path} still returns ${wantStatus}`, status === wantStatus, `got ${status}`);
    for (const [name, value] of expected) {
      const got = res.headers.get(name);
      check(
        `security (${label}) ${path}: ${name} is exactly "${value}"`,
        got === value,
        `got ${got === null ? "ABSENT" : JSON.stringify(got)}`,
      );
    }

    /* The default arrives only on this 302; source is not wire. */
    if (label === "302") {
      const cc = res.headers.get("cache-control");
      check(
        `cache: ${path} reaches the Worker's uncached default`,
        (cc ?? "").includes("no-store") && (cc ?? "").includes("private"),
        `cache-control ${cc === null ? "ABSENT" : JSON.stringify(cc)}. A response with no ` +
          `Cache-Control is heuristically cached, and this one is authenticated.`,
      );
    }
  }
  console.log(
    `  security headers: ${expected.length} asserted by exact value on a 200 and the /admin 302`,
  );

  /* A static nonce is visible only on the wire. */
  {
    const ENFORCED = "content-security-policy";
    const RO = "content-security-policy-report-only";

    for (const [label, path] of SURFACES) {
      const { res } = await get(path);
      const policy = res.headers.get(ENFORCED) ?? "";
      check(
        `csp (${label}) ${path}: the ENFORCING header is present`,
        policy.length > 0,
        "ABSENT. Ruled 2026-08-17: this policy is enforced, not merely reported.",
      );
      check(
        `csp (${label}) ${path}: Report-Only is gone (both at once is a half-migration)`,
        res.headers.get(RO) === null,
        `got ${JSON.stringify(res.headers.get(RO))}. Two policies means a browser ` +
          `enforces one and reports the other, and nobody can say which is the ruling.`,
      );
      check(
        `csp (${label}) ${path}: Reporting-Endpoints names the sink`,
        (res.headers.get("reporting-endpoints") ?? "").includes("/api/csp-report"),
        `got ${JSON.stringify(res.headers.get("reporting-endpoints"))}`,
      );
      check(
        `csp (${label}) ${path}: script-src has no 'unsafe-inline'`,
        !/script-src[^;]*'unsafe-inline'/.test(policy),
        "the easy way to silence a report, and it reduces the policy to decoration",
      );
    }

    /* A cache-busting query per probe forces two renders. */
    const nonceOf = (/** @type {string} */ p) => (p.match(/'nonce-([^']+)'/) ?? [])[1] ?? "";
    const nonceProbe = (/** @type {number} */ n) =>
      get(`/?nonce-probe=${Date.now()}-${n}`, { cookie: "theme=dark" });
    const first = await nonceProbe(1);
    const second = await nonceProbe(2);
    const n1 = nonceOf(first.res.headers.get(ENFORCED) ?? "");
    const n2 = nonceOf(second.res.headers.get(ENFORCED) ?? "");
    const m1 = first.res.headers.get("cf-cache-status") ?? "(none)";
    const m2 = second.res.headers.get("cf-cache-status") ?? "(none)";

    check("csp: the header carries a nonce", n1.length >= 16, `got ${JSON.stringify(n1)}`);
    check(
      "csp: both nonce probes were rendered, not replayed from cache",
      m1 !== "HIT" && m2 !== "HIT",
      `cf-cache-status ${JSON.stringify(m1)} and ${JSON.stringify(m2)}. The assertion ` +
        `below compares two GENERATIONS; served a stored copy it would compare one ` +
        `generation with itself and report a static nonce on a correct site. Each ` +
        `probe carries its own cache-busting query, so a HIT here means the query is ` +
        `no longer part of the key.`,
    );
    check(
      "csp: THE NONCE VARIES between two Worker-rendered responses",
      n1.length > 0 && n2.length > 0 && n1 !== n2,
      `both responses carried ${JSON.stringify(n1)}. A static nonce renders perfectly ` +
        `and protects nothing.`,
    );
    check(
      "csp: the header nonce matches the one stamped on the document's scripts",
      n1.length > 0 && first.text.includes(`nonce="${n1}"`),
      `header nonce ${JSON.stringify(n1)} does not appear as a nonce attribute in the body`,
    );
    console.log(`  csp: ENFORCED, nonce varies (${n1.slice(0, 8)}… then ${n2.slice(0, 8)}…)`);

    /* Pins the accepted shared-nonce window on a HIT; red if it changes. */
    let warm = await get("/");
    for (let i = 0; i < 5 && (warm.res.headers.get("cf-cache-status") ?? "") !== "HIT"; i += 1) {
      warm = await get("/");
    }
    const warmCf = warm.res.headers.get("cf-cache-status") ?? "(none)";
    if (warmCf === "HIT") {
      const again = await get("/");
      const c1 = nonceOf(warm.res.headers.get(ENFORCED) ?? "");
      const c2 = nonceOf(again.res.headers.get(ENFORCED) ?? "");
      check(
        "csp: cookieless readers on a cache HIT SHARE one nonce (the enforcement blocker, pinned)",
        c1.length > 0 && c1 === c2,
        `two cookieless HITs carried ${JSON.stringify(c1)} and ${JSON.stringify(c2)}. ` +
          `If these now DIFFER the shared-cache tension is gone, which is good news and ` +
          `means the enforcement ruling is unblocked: update workers/app.ts and remove ` +
          `this assertion in the same commit as the decision.`,
      );
      console.log(`  csp: shared-cache nonce reused across cookieless HITs (${c1.slice(0, 8)}…)`);
    } else {
      check(
        "csp: the shared-cache nonce case was actually observed",
        false,
        `never reached a cache HIT on / after 6 attempts (last cf-cache-status ${warmCf}). ` +
          `The blocker assertion examined nothing rather than passing quietly.`,
      );
    }
  }
}
