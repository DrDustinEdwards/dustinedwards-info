// The health endpoint, whose own header constants are the control, held to a hand-transcribed ratified set.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { headerConstant } from "../header-constants.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

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
