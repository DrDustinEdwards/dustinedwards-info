/**
 * The shared half of check:wrapper (check-wrapper.mjs and check-wrapper-config.mjs): the pass/fail counters, the
 * comment strippers, the wrangler config and the source files. Evaluated once however many parts import it.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src");
/*
 * THE SITE'S CHECKOUT, one level up.
 * The gate READS two site files (the operator API's tool list and the site's
 * origin) so that what it checks against is derived rather than restated. It
 * reads them; the Worker imports nothing from them.
 */
export const SITE_ROOT = join(ROOT, "..");

export let failures = 0;
export let assertions = 0;

export function check(label, condition, detail = "") {
  assertions += 1;
  if (!condition) {
    failures += 1;
    console.error(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

// jsonc: strip line comments before parsing. Block comments are stripped first
// because this config's own comments name forbidden binding types in prose, and a
// parser that looked at comments would find the prose before the config. That
// exact trap has already been hit twice in this portfolio.
export function readJsonc(path) {
  const raw = readFileSync(path, "utf8");
  const withoutBlocks = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLines = withoutBlocks.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(withoutLines);
}

function sourceFiles() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ name: f, text: readFileSync(join(SRC, f), "utf8") }));
}

/**
 * TWO strippers, and picking the wrong one silently disables an assertion (a first version used codeOnly()
 * everywhere and three of eleven planted violations went undetected, their target being in a string literal).
 * withoutComments strips comments, KEEPS strings: for string CONTENT (urls, paths, config values).
 * codeOnly strips comments AND strings: for executable code (identifiers, branches, property access).
 * Both strip comments, because this file's prose and the source's module headers name the very things being
 * forbidden, and a parser that reads comments finds the documentation before the code.
 */
export function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

export function codeOnly(text) {
  return withoutComments(text)
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '""')
    .replace(/"(?:\\.|[^\\"])*"/g, '""')
    .replace(/'(?:\\.|[^\\'])*'/g, '""');
}

/**
 * Resolve the wrangler config. The real `wrangler.jsonc` is gitignored (live KV ids, public repo), so a fresh
 * clone has only `wrangler.jsonc.example`, and this gate must work there too. Every assertion is about binding
 * SHAPE, never id VALUES, so the example proves as much as the real file; the real one is preferred. The gap, on
 * a machine with only the example (a forbidden binding in the real file goes unseen), is closed below by
 * asserting the two agree whenever both are present.
 */
function resolveConfig() {
  const real = join(ROOT, "wrangler.jsonc");
  const example = join(ROOT, "wrangler.jsonc.example");
  if (existsSync(real)) return { path: real, which: "wrangler.jsonc" };
  if (existsSync(example)) return { path: example, which: "wrangler.jsonc.example" };
  // Fails CLOSED. No config means nothing can be proven, which is not a pass.
  console.error(
    "FAIL  no wrangler config found (neither wrangler.jsonc nor wrangler.jsonc.example)",
  );
  process.exit(1);
}

export const configSource = resolveConfig();
export const config = readJsonc(configSource.path);
export const files = sourceFiles();

// When both exist they must describe the same bindings, or the example is
// decoration and the fresh-clone run is checking a fiction.
if (configSource.which === "wrangler.jsonc" && existsSync(join(ROOT, "wrangler.jsonc.example"))) {
  const shape = (c) =>
    JSON.stringify({
      keys: Object.keys(c).sort(),
      kv: (c.kv_namespaces ?? []).map((n) => n.binding).sort(),
      dobj: (c.durable_objects?.bindings ?? []).map((b) => b.class_name).sort(),
      services: (c.services ?? []).map((b) => `${b.binding}:${b.service}`).sort(),
      r2: (c.r2_buckets ?? []).map((b) => `${b.binding}:${b.bucket_name}`).sort(),
      routes: JSON.stringify(c.routes ?? []),
      migrations: (c.migrations ?? [])
        .map((m) => m.new_sqlite_classes ?? [])
        .flat()
        .sort(),
      flags: (c.compatibility_flags ?? []).slice().sort(),
      main: c.main,
      vars: Object.keys(c.vars ?? {}).sort(),
    });
  check(
    "wrangler.jsonc.example describes the same bindings as wrangler.jsonc",
    shape(config) === shape(readJsonc(join(ROOT, "wrangler.jsonc.example"))),
    "The example is what a fresh clone checks, so drift there silently weakens this gate.",
  );
}

// A. Bindings are an allowlist, derived from the config rather than restated.

// Any of these would give the wrapper a second route to app data, which is the
