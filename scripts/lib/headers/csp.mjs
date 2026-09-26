// The content security policy: both branches called rather than parsed, the feed exemption, the
// nonce on the admin branch only, the loader hash on both, and the enforced header on both exits.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ENHANCE_LOADER } from "../../../app/lib/enhance-loader.mjs";
import { contentSecurityPolicy, enhanceLoaderHash, isAdminPath } from "../../../workers/csp.mjs";
import { UNPOLICED_TYPES, isUnpolicedType } from "../../../workers/feed-types.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";
import { documentHeadersOf } from "./static-set-and-cache.mjs";

/** @param {string} code workers/app.ts with its comments stripped */
export async function run(code) {
  /*
   * unsafe-inline IS THE ASSERTION THAT MATTERS: it silences the report, breaks nothing, and is
   * what an injected script needs. strict-dynamic makes browsers ignore it until it is dropped.
   */

  console.log("\n  content security policy");

  /* The policy is called, not parsed: a regex sees both branches exist, not which one a request gets. */
  const NONCE = "gate-fixture-nonce-not-a-real-one";
  const publicCsp = await contentSecurityPolicy(undefined);
  const adminCsp = await contentSecurityPolicy(NONCE);

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
    "contentSecurityPolicy returns the same string for both arms, so the adminNonce " +
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

  /* The types are read out of the feed module and isUnpolicedType() is called, so the two owners
     cannot drift. */
  {
    /** Named rather than globbed: the assertion is about THESE THREE, and a glob quietly shrinks. */
    const FEED_FORMATS = ["rss", "atom", "json"];
    const feedModule = join(root, "app", "lib", "feed-response.ts");
    const feedSource = existsSync(feedModule)
      ? stripComments(readFileSync(feedModule, "utf8"))
      : "";
    ok("the feed module app/lib/feed-response.ts exists", feedSource !== "", "not on disk");
    const typesBlock = /FEED_CONTENT_TYPES\s*=\s*\{([^}]*)\}/.exec(feedSource)?.[1] ?? "";

    for (const format of FEED_FORMATS) {
      const declared = new RegExp(`\\b${format}:\\s*"([^"]+)"`).exec(typesBlock);
      ok(
        `the ${format} feed declares a content-type this gate can read`,
        Boolean(declared),
        `no \`${format}: "..."\` entry in FEED_CONTENT_TYPES, so the next assertion would ` +
          "have nothing to test and would pass",
      );
      if (!declared) continue;
      ok(
        `the ${format} feed serves "${declared[1]}", which isUnpolicedType() exempts from the CSP`,
        isUnpolicedType(declared[1]),
        `isUnpolicedType("${declared[1]}") is false, so this feed is served a policy it ` +
          `cannot use on every shared-cached response. Exempt types: ` +
          `${[...UNPOLICED_TYPES].join(", ")}`,
      );
    }

    /* THE NEGATIVE, so the three above cannot pass by isUnpolicedType() having become a constant true. */
    for (const type of ["text/html", "text/html; charset=utf-8", "image/svg+xml", ""]) {
      ok(
        `isUnpolicedType(${JSON.stringify(type)}) is false, so a document still gets a policy`,
        !isUnpolicedType(type),
        "isUnpolicedType() exempts a type a browser renders as a browsing context",
      );
    }
    ok("isUnpolicedType(null) is false", !isUnpolicedType(null));
  }

  /* The public branch matters most: a nonce there silences a report and breaks nothing visible,
     while header and body share one public cache entry, so every reader would share it. */
  const publicStyleSrc = directiveIn(publicCsp, "style-src");
  const adminStyleSrc = directiveIn(adminCsp, "style-src");

  ok(
    "the PUBLIC style-src carries no nonce source",
    !publicStyleSrc.includes("nonce-"),
    "public style-src is " +
      JSON.stringify(publicStyleSrc) +
      ". Every shared-cached public HTML route is edge-cached, so a nonce there is one " +
        "value every reader shares for the cache lifetime. " +
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
      path + " is NOT an admin path, so it gets the nonce-free policy",
      !isAdminPath(path),
      "isAdminPath(" +
        JSON.stringify(path) +
        ") is true, so this route would be served a policy carrying a nonce.",
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

  /*
   * THE LOADER HASH, recomputed here with node:crypto from the constant root.tsx renders, so the
   * policy's hash and the page's script are held to one text by a second implementation.
   */
  const expectedHash =
    "sha256-" + createHash("sha256").update(ENHANCE_LOADER, "utf8").digest("base64");
  const computedHash = await enhanceLoaderHash();
  ok(
    "the loader hash is the sha256 of ENHANCE_LOADER in app/lib/enhance-loader.mjs",
    computedHash === expectedHash,
    "enhanceLoaderHash() returned " +
      JSON.stringify(computedHash) +
      ", node:crypto says " +
      JSON.stringify(expectedHash) +
      ". Every page's one inline script would be refused, and every enhancement with it.",
  );
  ok(
    "the loader never contains `<`, so React renders it raw and the bytes stay the hashed bytes",
    ENHANCE_LOADER.length > 0 && !ENHANCE_LOADER.includes("<"),
    "a `<` can close the script element or open a comment, and the text the browser " +
      "hashes is then not the text the policy names",
  );

  const scriptSrc = directiveIn(publicCsp, "script-src");
  const adminScriptSrc = directiveIn(adminCsp, "script-src");
  /** @param {string} directive */
  const sourcesOf = (directive) => directive.split(" ").slice(1);

  /* PUBLIC: no nonce at all, since a cached page would share it, and exactly this one hash. */
  ok(
    "the PUBLIC policy carries no nonce source anywhere",
    !publicCsp.includes("'nonce-"),
    "public policy is " +
      JSON.stringify(publicCsp) +
      ". Public pages are edge-cached with their header, so a nonce there is one value " +
      "every reader shares for the cache lifetime, which is what the loader hash replaced.",
  );
  ok(
    "the PUBLIC script-src is exactly the loader hash, 'strict-dynamic' and 'inline-speculation-rules'",
    JSON.stringify(sourcesOf(scriptSrc)) ===
      JSON.stringify([`'${expectedHash}'`, "'strict-dynamic'", "'inline-speculation-rules'"]),
    "public script-src is " +
      JSON.stringify(scriptSrc) +
      ". A second hash is a second inline script nobody reviewed; a missing one refuses the " +
      "loader; without 'inline-speculation-rules' the header's rules are refused silently.",
  );

  /* ADMIN: the same sources plus this render's nonce, which <Scripts> and the sidebar script need. */
  ok(
    "the ADMIN script-src carries the per-request nonce, not a literal",
    adminScriptSrc.includes("'nonce-" + NONCE + "'"),
    "admin script-src is " +
      JSON.stringify(adminScriptSrc) +
      ". A literal nonce is a static nonce, which renders correctly and protects nothing, " +
      "and without the argument's nonce the admin plane's hydration scripts are refused.",
  );
  ok(
    "the ADMIN script-src is the public one plus the nonce and nothing else",
    JSON.stringify(sourcesOf(adminScriptSrc)) ===
      JSON.stringify([`'nonce-${NONCE}'`, ...sourcesOf(scriptSrc)]),
    "admin script-src is " + JSON.stringify(adminScriptSrc) + ", public is " + JSON.stringify(scriptSrc),
  );

  for (const [arm, directive] of [
    ["public", scriptSrc],
    ["admin", adminScriptSrc],
  ]) {
    ok(
      `the ${arm} script-src does NOT carry 'unsafe-inline'`,
      !directive.includes("'unsafe-inline'"),
      "adding it is the easy way to silence a violation report and it reduces the " +
        "policy to decoration. 'strict-dynamic' makes browsers ignore it, so this " +
        "change would look harmless and would not be.",
    );
    ok(
      `the ${arm} script-src does NOT carry 'unsafe-eval'`,
      !directive.includes("'unsafe-eval'"),
      "nothing on this site evals, and adding it would be silencing a report rather than fixing it",
    );
  }
  for (const [arm, csp] of [
    ["public", publicCsp],
    ["admin", adminCsp],
  ]) {
    ok(
      `the ${arm} policy keeps object-src 'none' and base-uri 'none'`,
      directiveIn(csp, "object-src") === "object-src 'none'" &&
        directiveIn(csp, "base-uri") === "base-uri 'none'",
      "a hash-and-strict-dynamic policy is strict only with both: a plugin object or an " +
        "injected <base> moves where the trusted scripts load from",
    );
  }

  /*
   * ENFORCED, NOT REPORT-ONLY: a revert leaves the page working, the header present and the
   * reports arriving, with nothing blocked.
   */
  ok(
    "the CSP is applied as ENFORCED, not Report-Only",
    /headers\.set\(\s*"Content-Security-Policy"/.test(code) &&
      !code.includes('"Content-Security-Policy-Report-Only"'),
    "the header reverted to Report-Only. Ruled 2026-08-17: the policy is ENFORCED, " +
      "with shared caching kept on the public HTML routes, which since the loader " +
      "hash carry no nonce at all.",
  );
  ok(
    "the CSP is applied on BOTH exits, like the static set, through applyDocumentHeaders",
    /headers\.set\(\s*"Content-Security-Policy"/.test(documentHeadersOf(code)),
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
