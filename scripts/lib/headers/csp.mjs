// The content security policy: both branches called rather than parsed, the feed exemption, the
// style nonce on the admin branch only, and the enforced header on both exits.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { contentSecurityPolicy, isAdminPath } from "../../../workers/csp.mjs";
import { UNPOLICED_TYPES, isFeed } from "../../../workers/feed-types.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

/** @param {string} code workers/app.ts with its comments stripped */
export function run(code) {
  /*
   * unsafe-inline IS THE ASSERTION THAT MATTERS: it silences the report, breaks nothing, and is
   * what an injected script needs. strict-dynamic makes browsers ignore it until it is dropped.
   */

  console.log("\n  content security policy");

  /* The policy is called, not parsed: a regex sees both branches exist, not which one a request gets. */
  const NONCE = "gate-fixture-nonce-not-a-real-one";
  const publicCsp = contentSecurityPolicy(NONCE, false);
  const adminCsp = contentSecurityPolicy(NONCE, true);

  /** @param {string} csp */
  const directivesOf = (csp) => csp.split("; ").filter(Boolean);
  /**
   * @param {string} csp
   * @param {string} name
   */
  const directiveIn = (csp, name) =>
    directivesOf(csp).find((d) => d === name || d.startsWith(name + " ")) ?? "";

  const directives = directivesOf(publicCsp);
  ok(
    "the policy builder returns directives",
    directives.length > 0,
    "parsed zero, so every directive assertion below would pass vacuously",
  );
  ok(
    "the two branches actually differ",
    publicCsp !== adminCsp,
    "contentSecurityPolicy returns the same string for both arms, so the styleNonce " +
      "argument is being ignored and every branch assertion below compares one policy " +
      "with itself.",
  );

  // The ratified directive NAMES, not their values, or this becomes a mirror of workers/csp.mjs.
  // BOTH BRANCHES: a directive dropped from one arm is what a single-arm sweep calls clean.
  for (const name of [
    "default-src",
    "script-src",
    "style-src",
    "style-src-attr",
    "font-src",
    "img-src",
    "media-src",
    "connect-src",
    "object-src",
    "base-uri",
    "form-action",
    "frame-ancestors",
  ]) {
    for (const [arm, csp] of [
      ["public", publicCsp],
      ["admin", adminCsp],
    ]) {
      ok(
        "the " + arm + " policy declares " + name,
        Boolean(directiveIn(csp, name)),
        "parsed: " +
          (directivesOf(csp)
            .map((d) => d.split(" ")[0])
            .join(", ") || "(none)"),
      );
    }
  }

  /* The types are read out of the route files and isFeed() is called, so the two owners cannot drift. */
  {
    /** Named rather than globbed: the assertion is about THESE THREE, and a glob quietly shrinks. */
    const FEED_ROUTES = [
      "blog.rss[.xml].ts",
      "blog.atom[.xml].ts",
      "blog.feed[.json].ts",
    ];

    for (const file of FEED_ROUTES) {
      const routePath = join(root, "app", "routes", file);
      if (!existsSync(routePath)) {
        ok(`the feed route ${file} exists`, false, "not on disk");
        continue;
      }
      const source = stripComments(readFileSync(routePath, "utf8"));
      const declared = source.match(/"content-type":\s*"([^"]+)"/);
      ok(
        `${file} declares a content-type this gate can read`,
        Boolean(declared),
        "no `\"content-type\": \"...\"` literal found, so the next assertion would " +
          "have nothing to test and would pass",
      );
      if (!declared) continue;
      ok(
        `${file} serves "${declared[1]}", which isFeed() exempts from the CSP`,
        isFeed(declared[1]),
        `isFeed("${declared[1]}") is false, so this feed is served a policy with a ` +
          `per-request nonce on a shared-cached body. Exempt types: ` +
          `${[...UNPOLICED_TYPES].join(", ")}`,
      );
    }

    /* THE NEGATIVE, so the three above cannot pass by isFeed() having become a constant true. */
    for (const type of ["text/html", "text/html; charset=utf-8", "image/svg+xml", ""]) {
      ok(
        `isFeed(${JSON.stringify(type)}) is false, so a document still gets a policy`,
        !isFeed(type),
        "isFeed() exempts a type a browser renders as a browsing context",
      );
    }
    ok("isFeed(null) is false", !isFeed(null));
  }

  /* The public branch matters most: granting the nonce everywhere silences a report and breaks nothing
     visible, while header and body share one public cache entry. */
  const publicStyleSrc = directiveIn(publicCsp, "style-src");
  const adminStyleSrc = directiveIn(adminCsp, "style-src");

  ok(
    "the PUBLIC style-src carries no nonce source",
    !publicStyleSrc.includes("nonce-"),
    "public style-src is " +
      JSON.stringify(publicStyleSrc) +
      ". Every shared-cached public HTML route is edge-cached, so its nonce is stable " +
        "for up to ten minutes and a nonce source there widens the accepted script-src " +
        "exposure to styles. " +
      "Nothing public injects an inline stylesheet, so it buys nothing and costs that.",
  );
  ok(
    "the PUBLIC style-src is exactly 'self'",
    publicStyleSrc === "style-src 'self'",
    "public style-src is " +
      JSON.stringify(publicStyleSrc) +
      ", expected \"style-src 'self'\". Anything else is a widening of the public policy.",
  );
  ok(
    "the PUBLIC style-src carries no 'unsafe-inline'",
    !publicStyleSrc.includes("'unsafe-inline'"),
    "that is the easy way to silence the CodeMirror report, and it would apply to every " +
      "public page, which is the opposite of what the admin-only branch is for",
  );
  ok(
    "the ADMIN style-src carries the nonce source",
    adminStyleSrc.includes("'nonce-" + NONCE + "'"),
    "admin style-src is " +
      JSON.stringify(adminStyleSrc) +
      ". Without a nonce source the nonce CodeMirror puts on its injected <style> authorizes " +
      "nothing, and the StyleModule is dropped on every editor load, which is the defect " +
      "this branch exists for.",
  );
  ok(
    "the ADMIN style-src still carries 'self'",
    adminStyleSrc.includes("'self'"),
    "admin style-src is " +
      JSON.stringify(adminStyleSrc) +
      ". There is no 'strict-dynamic' for styles, so 'self' keeps applying and the linked " +
      "stylesheet needs it.",
  );
  ok(
    "style-src-attr is identical on both branches",
    directiveIn(publicCsp, "style-src-attr") === directiveIn(adminCsp, "style-src-attr"),
    "the style nonce changed what ATTRIBUTES are permitted, which it must not: the 117 " +
      "inline style attributes the highlighter emits are a public-page concern, and nonces " +
      "do not apply to attributes at all",
  );

  /* WHAT DECIDES THE BRANCH, on real paths rather than on the caller's if, which would mirror it. */
  for (const path of [
    "/",
    "/blog",
    "/blog/some-post",
    "/colophon",
    "/projects",
    "/playground",
    "/search",
    "/login",
    "/media/thing.png",
    "/api/csp-report",
    "/administrator",
    "/admin-tools",
    "/admin.data",
  ]) {
    ok(
      path + " is NOT an admin path, so it gets the absolute style-src",
      !isAdminPath(path),
      "isAdminPath(" +
        JSON.stringify(path) +
        ") is true, so this route would be served a policy carrying a style nonce.",
    );
  }
  for (const path of [
    "/admin",
    "/admin/",
    "/admin/posts",
    "/admin/posts/a-slug/edit",
    // A child route's single-fetch URL. It matches the slash arm, unlike the
    // layout's own `/admin.data`, which does not. Both are JSON either way.
    "/admin/posts.data",
  ]) {
    ok(
      path + " IS an admin path, so the editor's StyleModule is accepted",
      isAdminPath(path),
      "isAdminPath(" +
        JSON.stringify(path) +
        ") is false, so CodeMirror's injected stylesheet is refused on that route.",
    );
  }

  const scriptSrc = directiveIn(publicCsp, "script-src");
  ok(
    "script-src carries the per-request nonce, not a literal",
    scriptSrc.includes("'nonce-" + NONCE + "'"),
    "script-src is " +
      JSON.stringify(scriptSrc) +
      ". A literal nonce is a static nonce, which renders correctly and protects nothing.",
  );
  ok(
    "script-src is identical on both branches",
    scriptSrc === directiveIn(adminCsp, "script-src"),
    "the style branch changed script-src, which it has no business touching",
  );
  ok(
    "script-src carries 'strict-dynamic'",
    scriptSrc.includes("'strict-dynamic'"),
    "script-src is " + JSON.stringify(scriptSrc),
  );
  ok(
    "script-src does NOT carry 'unsafe-inline'",
    !scriptSrc.includes("'unsafe-inline'"),
    "adding it is the easy way to silence a violation report and it reduces the " +
      "policy to decoration. 'strict-dynamic' makes browsers ignore it, so this " +
      "change would look harmless and would not be.",
  );
  ok(
    "script-src does NOT carry 'unsafe-eval'",
    !scriptSrc.includes("'unsafe-eval'"),
    "nothing on this site evals, and adding it would be silencing a report rather than fixing it",
  );

  /*
   * ENFORCED, NOT REPORT-ONLY: a revert leaves the page working, the header present and the
   * reports arriving, with nothing blocked.
   */
  ok(
    "the CSP is applied as ENFORCED, not Report-Only",
    /headers\.set\(\s*"Content-Security-Policy"/.test(code) &&
      !code.includes('"Content-Security-Policy-Report-Only"'),
    "the header reverted to Report-Only. Ruled 2026-08-17: the existing nonce " +
      "plus strict-dynamic policy is ENFORCED, keeping shared caching on the " +
      "seven HTML routes and accepting the ten-minute nonce window.",
  );
  ok(
    "the CSP is applied on BOTH exits, like the static set",
    [...code.matchAll(/headers\.set\(\s*"Content-Security-Policy"/g)].length >= 2,
    "a redirect that misses it is UNPROTECTED, not merely unreported",
  );
  /* REPORTING SURVIVES ENFORCEMENT: a policy blocks silently, so the reports are the only signal. */
  ok(
    "reporting is still on after the switch to enforcing",
    publicCsp.includes("report-uri ") && publicCsp.includes("report-to "),
    "the policy blocks but reports nothing, so a false positive would be invisible",
  );
  ok(
    "a report destination is declared (report-to AND the legacy report-uri)",
    adminCsp.includes("report-to ") && adminCsp.includes("report-uri "),
    "a CSP with no report destination is a header nobody reads. Both are sent " +
      "because report-to is Baseline 2026 and report-uri still carries older browsers.",
  );
  ok(
    "Reporting-Endpoints is sent alongside report-to",
    code.includes('"Reporting-Endpoints"'),
    "report-to names an endpoint that Reporting-Endpoints has to define",
  );

  console.log(
    `     ${directives.length} directive(s), ENFORCED, ` +
      `${[...code.matchAll(/headers\.set\(\s*"Content-Security-Policy"/g)].length} application site(s)`,
  );
}
