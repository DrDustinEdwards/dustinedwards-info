// The two routes whose own header constants are the control: the draft preview and the health
// endpoint, each held to a hand-transcribed ratified set.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { headerConstant } from "../header-constants.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

export function runPreview() {
  /*
   * The one route whose headers are the access control: /preview/:token serves an unpublished post
   * to a caller with no session, and the cookieless downgrade never fires for it.
   */

  console.log("\n  the draft preview route");

  const PREVIEW_PATH = join(root, "app", "routes", "preview.$token.tsx");

  /** Transcribed by hand, not read from the route. */
  const RATIFIED_PREVIEW = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    Vary: "Cookie",
  };

  ok(
    "app/routes/preview.$token.tsx exists",
    existsSync(PREVIEW_PATH),
    "the route that serves drafts is gone, or was renamed. Nothing below examines anything.",
  );

  if (existsSync(PREVIEW_PATH)) {
    const previewSource = readFileSync(PREVIEW_PATH, "utf8");
    const preview = stripComments(previewSource);

    const previewHeaders = headerConstant(preview, "PREVIEW_HEADERS");
    ok(
      "the route declares a PREVIEW_HEADERS constant",
      Boolean(previewHeaders),
      "not found after stripping comments. Without it every value assertion below is vacuous.",
    );
    const previewDeclared = previewHeaders ?? {};

    ok(
      "PREVIEW_HEADERS is not empty",
      Object.keys(previewDeclared).length > 0,
      "parsed to zero entries, so every value assertion would pass vacuously",
    );
    ok(
      `PREVIEW_HEADERS declares all ${Object.keys(RATIFIED_PREVIEW).length} ratified headers`,
      Object.keys(previewDeclared).length === Object.keys(RATIFIED_PREVIEW).length,
      `declares ${Object.keys(previewDeclared).length}: ${Object.keys(previewDeclared).join(", ") || "(none)"}`,
    );

    for (const [name, expected] of Object.entries(RATIFIED_PREVIEW)) {
      ok(
        `preview route declares ${name}`,
        name in previewDeclared,
        "the feature G ratification includes it and the route does not",
      );
      if (name in previewDeclared) {
        ok(
          `preview route's ${name} carries its ratified value`,
          previewDeclared[name] === expected,
          `expected ${JSON.stringify(expected)}, source has ${JSON.stringify(previewDeclared[name])}`,
        );
      }
    }

    for (const name of Object.keys(previewDeclared)) {
      ok(
        `${name} is a ratified preview header`,
        name in RATIFIED_PREVIEW,
        "the route declares it and the ratification does not. Add it here in the same commit, or remove it.",
      );
    }

    /* NO PUBLIC BRANCH, named: the rule is that the identifier does not appear in this file AT ALL. */
    ok(
      "the preview route never references SHARED_CACHE_CONTROL",
      !/\bSHARED_CACHE_CONTROL\b/.test(preview),
      "blog.$slug.tsx is the neighboring file and exports a headers() of the same " +
        "shape using it. On this route it would put an unpublished post into a " +
        "shared cache entry keyed by path alone.",
    );
    ok(
      "the preview route's headers() returns the declared constant",
      /export\s+function\s+headers\s*\([^)]*\)\s*\{[^}]*PREVIEW_HEADERS/.test(preview),
      "headers() must hand back PREVIEW_HEADERS, or the constant is documentation",
    );
    ok(
      "the preview route also declares noindex in the markup",
      /"?robots"?\s*[,:]/.test(preview) && preview.includes("noindex, nofollow"),
      "the header is the control and the meta tag is the belt; both were ratified",
    );

    console.log(
      `     ${Object.keys(previewDeclared).length} header(s) declared on /preview/:token`,
    );
  }
}

export function runHealth() {
  /* A health check served from cache is not a health check: no Cache-Control means heuristic freshness. */

  console.log("\n  the health endpoint");

  const HEALTH_PATH = join(root, "app", "routes", "api.health.ts");

  /** Transcribed by hand, not read from the route. */
  const RATIFIED_HEALTH = { "Cache-Control": "no-store" };

  ok(
    "app/routes/api.health.ts exists",
    existsSync(HEALTH_PATH),
    "the health route is gone or was renamed, so nothing below examines anything",
  );

  if (existsSync(HEALTH_PATH)) {
    const health = stripComments(readFileSync(HEALTH_PATH, "utf8"));

    const healthHeaders = headerConstant(health, "HEALTH_HEADERS");
    ok(
      "the route declares a HEALTH_HEADERS constant",
      Boolean(healthHeaders),
      "not found after stripping comments. Without it every assertion below is vacuous.",
    );
    const healthDeclared = healthHeaders ?? {};

    ok(
      "HEALTH_HEADERS is not empty",
      Object.keys(healthDeclared).length > 0,
      "parsed to zero entries, so the value assertion below would pass vacuously",
    );

    for (const [name, expected] of Object.entries(RATIFIED_HEALTH)) {
      ok(
        `the health route declares ${name}`,
        name in healthDeclared,
        `the ratification includes it and the route does not. Absent, the response ` +
          `is heuristically cached for two hours and reports stale health.`,
      );
      ok(
        `the health route's ${name} is exactly "${expected}"`,
        healthDeclared[name] === expected,
        `declared ${JSON.stringify(healthDeclared[name] ?? "(absent)")}`,
      );
    }

    const constructions = [
      ...health.matchAll(/\bnew\s+Response\s*\(|\bResponse\s*\.\s*json\s*\(/g),
    ];
    ok(
      "the health route constructs exactly one Response",
      constructions.length === 1,
      `found ${constructions.length}. Every health response must go through the one ` +
        `helper that applies HEALTH_HEADERS; a second exit is a response that can be ` +
        `cached, and on a 503 that means alerting after the site recovered.`,
    );

    const helperAt = health.search(/function\s+healthJson\b/);
    ok(
      "the route defines the healthJson helper",
      helperAt !== -1,
      "the single-construction assertion above has nothing to be scoped to",
    );

    if (helperAt !== -1) {
      // Bounded to the helper's own body by the closing brace at column 0, never a character window.
      const helperEnd = health.indexOf("\n}", helperAt);
      const helperBody = helperEnd === -1 ? "" : health.slice(helperAt, helperEnd + 2);

      ok(
        "healthJson seeds its headers from HEALTH_HEADERS",
        /new\s+Headers\(\s*HEALTH_HEADERS\s*\)/.test(helperBody),
        "the one construction site does not build from the constant, so the headers " +
          "are declared and unused",
      );
      ok(
        "the single Response construction is inside healthJson",
        constructions.length === 1 &&
          constructions[0].index > helperAt &&
          constructions[0].index < helperAt + helperBody.length,
        "a Response is built outside the helper, so it carries whatever headers its own call site set",
      );
    }
  }
}
