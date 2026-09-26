// The ratified security headers by exact value, and the enforced CSP: the loader hash and no nonce on
// public pages, a per-render nonce on the admin plane.

import { ENHANCE_LOADER } from "../../../app/lib/enhance-loader.mjs";
import { enhanceLoaderHash } from "../../../workers/csp.mjs";
import { declaredSecurityHeaders } from "../header-constants.mjs";
import { check, get } from "./client.mjs";

/**
 * The executable inline scripts in a document: no `src`, and not a data block (JSON-LD) or
 * speculation rules, which `script-src` either does not gate or admits by keyword.
 *
 * @param {string} html
 * @returns {string[]} each script's text
 */
export function inlineExecutableScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => {
      const type = /\btype="([^"]*)"/.exec(attrs ?? "")?.[1] ?? "";
      return !/\bsrc=/.test(attrs ?? "") && type !== "application/ld+json" && type !== "speculationrules";
    })
    .map(([, , text]) => text ?? "");
}

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

  /* What the policy trusts is visible only on the wire. */
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

    /*
     * PUBLIC: exactly the loader's hash and no nonce, on a render and on a cached copy alike, and the
     * page's one executable inline script is the loader, byte for byte.
     */
    const loaderSource = `'${await enhanceLoaderHash()}'`;
    /** @param {string} label @param {{ res: Response, text: string }} probe */
    const assertPublic = (label, { res, text }) => {
      const policy = res.headers.get(ENFORCED) ?? "";
      const hashes = policy.match(/'sha256-[^']+'/g) ?? [];
      check(
        `csp (${label}): the public policy carries no nonce`,
        !policy.includes("'nonce-"),
        `got ${JSON.stringify(policy)}. A public page is edge-cached with its header, so every ` +
          `reader of that copy would share the nonce.`,
      );
      check(
        `csp (${label}): the public policy names exactly one hash, the loader's`,
        hashes.length === 1 && hashes[0] === loaderSource,
        `hashes ${JSON.stringify(hashes)}, expected [${loaderSource}]. The deployed loader and ` +
          `this checkout disagree, or a second inline script was allowed.`,
      );
      check(
        `csp (${label}): the document carries no nonce attribute`,
        !/\snonce=/.test(text),
        "a nonce on a cached public page is shared by every reader of the copy",
      );
      const inline = inlineExecutableScripts(text);
      check(
        `csp (${label}): the one executable inline script is the loader, byte for byte`,
        inline.length === 1 && inline[0] === ENHANCE_LOADER,
        `${inline.length} executable inline script(s): ` +
          `${JSON.stringify(inline.map((t) => t.slice(0, 60)))}. Anything else is refused by ` +
          `the policy, and a loader that differs from its hash is refused with every enhancement.`,
      );
    };

    /* A cache-busting query forces a render; the warmed bare path is the stored copy. */
    const rendered = await get(`/?csp-probe=${Date.now()}`, { cookie: "theme=dark" });
    assertPublic("rendered /", rendered);

    let warm = await get("/");
    for (let i = 0; i < 5 && (warm.res.headers.get("cf-cache-status") ?? "") !== "HIT"; i += 1) {
      warm = await get("/");
    }
    const warmCf = warm.res.headers.get("cf-cache-status") ?? "(none)";
    check(
      "csp: a cache HIT on / was observed",
      warmCf === "HIT",
      `never reached a cache HIT on / after 6 attempts (last cf-cache-status ${warmCf}). ` +
        `The stored copy is what readers share, so the assertion below examined nothing.`,
    );
    if (warmCf === "HIT") assertPublic("cached /", warm);

    /* ADMIN: a per-render nonce, which varies. The anonymous 302 is uncached, so two probes render twice. */
    const nonceOf = (/** @type {string} */ p) => (p.match(/'nonce-([^']+)'/) ?? [])[1] ?? "";
    const a1 = await get("/admin");
    const a2 = await get("/admin");
    const n1 = nonceOf(a1.res.headers.get(ENFORCED) ?? "");
    const n2 = nonceOf(a2.res.headers.get(ENFORCED) ?? "");
    check("csp: the admin header carries a nonce", n1.length >= 16, `got ${JSON.stringify(n1)}`);
    check(
      "csp: THE ADMIN NONCE VARIES between two Worker-rendered responses",
      n1.length > 0 && n2.length > 0 && n1 !== n2,
      `both responses carried ${JSON.stringify(n1)}. A static nonce renders perfectly ` +
        `and protects nothing.`,
    );
    console.log(
      `  csp: ENFORCED, public carries the loader hash and no nonce, admin nonce varies ` +
        `(${n1.slice(0, 8)}… then ${n2.slice(0, 8)}…)`,
    );
  }
}
