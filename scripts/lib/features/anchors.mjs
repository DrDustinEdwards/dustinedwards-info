// The feature list's anchors: every route, gate and assertion a feature names must exist.
// Routes are read by importing app/routes.ts and walking its children, so a nested route is known by
// its full path (/admin/tools) and never by its child segment alone (/tools).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { functionBody } from "../source-body.mjs";
import { codeOf, normalizeEol, root, stripped } from "./shared.mjs";

const ROUTES_PATH = join(root, "app", "routes.ts");

/**
 * Every URL path routes.ts declares, with the module that renders it. Read by IMPORTING the config
 * and walking children with their parent's prefix: a regex over the file saw `route("tools", ...)`
 * under /admin as a top-level /tools, and anchors to that nonexistent URL passed.
 *
 * @returns {Promise<Map<string, string>>}
 */
export async function declaredRouteModules() {
  const { default: config } = await import(pathToFileURL(ROUTES_PATH).href);
  /** @type {Map<string, string>} */
  const out = new Map();
  const walk = (/** @type {any[]} */ entries, /** @type {string} */ prefix) => {
    for (const entry of entries) {
      const path = entry.index ? prefix || "/" : `${prefix}/${entry.path}`.replace(/\/+/g, "/");
      // An index child renders at its parent's path, so its module is the page there.
      if (entry.index || !out.has(path)) out.set(path, join(root, "app", entry.file));
      if (entry.children) walk(entry.children, path === "/" ? "" : path);
    }
  };
  walk(config, "");
  return out;
}

export function declaredGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (!name.startsWith("check:") || name === "check:all") continue;
    // Taken from the command: gate names do not map to files mechanically.
    const file = String(command).match(/([\w./-]+\.mjs)/)?.[1];
    out.set(name, file ? join(root, file) : "");
  }
  return out;
}

/**
 * @param {import("./shared.mjs").FeaturesContext} ctx
 * @returns {{ anchorCount: number, verified: number, referencedGates: Set<string> }}
 */
export function checkAnchors(ctx) {
  const { ok, features, routes, routeModules, gates } = ctx;

  ok(
    "the feature list is not empty",
    features.length > 0,
    "no features, so every check below would pass vacuously",
  );
  ok(
    "routes.ts parsed to a plausible number of routes",
    routes.size >= 50,
    `read ${routes.size}, floor 50, measured 55 with nested paths composed. The walk has ` +
      `stopped descending into children, or routes.ts has lost routes.`,
  );
  ok(
    "routes.ts: a nested route is known by its full path, never by its child segment alone",
    routes.has("/admin/tools") && !routes.has("/tools"),
    "the walk is flattening children to the top level again, so an anchor to a URL that " +
      "does not exist would pass",
  );
  ok(
    "package.json declares gates",
    gates.size > 0,
    "no check:* scripts found",
  );
  ok(
    "every feature carries a component and a name",
    features.every(
      (/** @type {any} */ f) => f.component && f.name && f.what,
    ),
    features
      .filter((/** @type {any} */ f) => !f.component || !f.name || !f.what)
      .map((/** @type {any} */ f) => f.name ?? "(unnamed)")
      .join(", "),
  );

  const anchorCount = features.reduce(
    (/** @type {number} */ sum, /** @type {any} */ f) =>
      sum + (f.anchors?.length ?? 0),
    0,
  );
  ok(
    "the features carry anchors at all",
    anchorCount > 0,
    "every feature is unanchored, so this gate would examine nothing",
  );

  const VERIFIABLE = ["route", "gate", "assertion"];
  const referencedGates = new Set();
  let verified = 0;

  for (const feature of features) {
    const label = `${feature.component} / ${feature.name}`;
    const anchors = feature.anchors ?? [];

    ok(`${label} carries at least one anchor`, anchors.length > 0);

    /* A decision anchor proves nothing offline, so it may never stand alone. */
    ok(
      `${label} carries a verifiable anchor, not only a decision`,
      anchors.some((/** @type {any} */ a) => VERIFIABLE.includes(a.kind)),
      `its anchors are ${anchors.map((/** @type {any} */ a) => a.kind).join(", ") || "(none)"}. ` +
        `A decision anchor cannot be verified offline, so it cannot be the only one.`,
    );

    for (const anchor of anchors) {
      if (anchor.kind === "route") {
        verified += 1;
        ok(
          `${label} names a route that exists: ${anchor.path}`,
          routes.has(anchor.path),
          `routes.ts declares no ${anchor.path}`,
        );

        const routeFile = routeModules.get(anchor.path);
        if (routeFile && existsSync(routeFile)) {
          const routeSource = codeOf(routeFile);
          const isPage = /export\s+default\s+function\b/.test(routeSource);
          const hasLoader = /export\s+(?:async\s+)?function\s+loader\b/.test(routeSource);
          /* The LOADER's own body: a 405 from an action on a GET-able route is not the loader refusing. */
          const loaderBody = functionBody(routeSource, /export\s+(?:async\s+)?function\s+loader\b/);
          const loaderRefuses = /status:\s*405/.test(loaderBody);
          const loaderAuthenticates = /\bauthenticateOperator\s*\(/.test(loaderBody);
          const derived = isPage || (hasLoader && !loaderRefuses && !loaderAuthenticates);
          const declared = anchor.anonymousGet !== false;
          const why = !hasLoader
            ? "exports neither a component nor a loader"
            : loaderRefuses
              ? "returns 405 from its loader"
              : "authenticates in its loader";
          ok(
            `${label}: the anonymousGet flag on ${anchor.path} matches the route`,
            declared === derived,
            declared
              ? `the anchor renders as a link, but ${routeFile.slice(root.length + 1)} ` +
                  `${why}, so a reader following it gets an error rather than a page. ` +
                  `Add "anonymousGet": false.`
              : `the anchor is marked not-followable, but ${routeFile.slice(root.length + 1)} ` +
                  `${isPage ? "exports a component" : "has a loader that neither refuses nor authenticates"}. ` +
                  `The route became a page and the flag outlived it. Remove "anonymousGet": false.`,
          );
        } else {
          ok(
            `${label}: the module for ${anchor.path} is on disk`,
            false,
            `routes.ts declares ${anchor.path} and this gate could not resolve it to ` +
              `a file, so its followability was never checked.`,
          );
        }
      } else if (anchor.kind === "gate") {
        verified += 1;
        referencedGates.add(anchor.gate);
        const file = gates.get(anchor.gate) ?? "";
        ok(
          `${label} names a gate that exists: ${anchor.gate}`,
          gates.has(anchor.gate),
          `package.json declares no ${anchor.gate}`,
        );
        ok(
          `${label}: the script for ${anchor.gate} is on disk`,
          Boolean(file) && existsSync(file),
          `${anchor.gate} maps to ${file || "(no .mjs in its command)"}, which does not exist`,
        );
      } else if (anchor.kind === "assertion") {
        verified += 1;
        referencedGates.add(anchor.gate);
        /* `file` names the module or test the gate runs when the text is not in its entry script. */
        const file = anchor.file
          ? join(root, String(anchor.file))
          : (gates.get(anchor.gate) ?? "");
        ok(
          `${label}: ${anchor.gate} is a gate that exists`,
          gates.has(anchor.gate),
          `package.json declares no ${anchor.gate}`,
        );
        /* Both sides LF-normalized, or a multi-line anchor passes only on a CRLF disk. */
        const present =
          Boolean(file) && existsSync(file)
            ? stripped(normalizeEol(readFileSync(file, "utf8"))).includes(normalizeEol(anchor.text))
            : false;
        ok(
          `${label}: ${anchor.gate} still asserts "${anchor.text}"`,
          present,
          !file || !existsSync(file)
            ? `${anchor.gate} has no script on disk`
            : `that exact text is not in ${anchor.gate}'s script. It was reworded or removed.`,
        );
      } else if (anchor.kind === "decision") {
        ok(
          `${label} decision anchor is dated: ${anchor.id ?? "(none)"}`,
          typeof anchor.id === "string" && /^\d{4}-\d{2}-\d{2}/.test(anchor.id),
          `a decision anchor is context and is not verified here, but it must at ` +
            `least name a dated entry so a reader can find it`,
        );
      } else {
        ok(
          `${label} has a known anchor kind`,
          false,
          `${JSON.stringify(anchor.kind)} is not one of route, gate, assertion, decision`,
        );
      }
    }
  }

  ok(
    "verifiable anchors were actually checked",
    verified > 0,
    "every anchor was a decision, so nothing was verified",
  );

  return { anchorCount, verified, referencedGates };
}

/**
 * Reported, not failed: failing would invite filler prose.
 *
 * @param {import("./shared.mjs").FeaturesContext} ctx
 * @param {{ anchorCount: number, verified: number, referencedGates: Set<string> }} result
 */
export function reportAnchors({ features, routes, gates }, { anchorCount, verified, referencedGates }) {
  const unreferenced = [...gates.keys()]
    .filter((name) => !referencedGates.has(name))
    .sort();

  console.log(
    `  ${features.length} feature(s), ${anchorCount} anchor(s), ${verified} verifiable, ` +
      `${routes.size} route(s) parsed, ${gates.size} gate(s) known`,
  );
  if (unreferenced.length > 0) {
    console.log(
      `  REPORT  ${unreferenced.length} gate(s) no feature references: ${unreferenced.join(", ")}`,
    );
  } else {
    console.log("  every gate is referenced by at least one feature");
  }
}
