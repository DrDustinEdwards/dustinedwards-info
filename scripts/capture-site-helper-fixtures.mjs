#!/usr/bin/env node
/**
 * Captures the byte-for-byte fixtures packages/site-helpers is held to, from each site's CURRENT output:
 *
 *   node scripts/capture-site-helper-fixtures.mjs
 *
 * - germomics and foxhound: their own feed, sitemap and llms code, taken from the repository's origin/main (git archive of
 *   `app/`, so a stale or edited working tree is never read), run on fixed sample rows through scripts/lib/site-clone-loader.mjs,
 *   which stubs only the modules that need a database or Cloudflare bindings.
 * - this site: its live sitemap and llms files (https://dustinedwards.info), and its feed builders at this checkout on sample
 *   posts (test/site-helpers.test.mjs holds the package to them directly, so no feed fixture is needed from the network).
 *
 * Writes test/fixtures/site-helpers/<site>-<file> and PROVENANCE.json (each source's commit and the time it was read). It needs
 * sibling clones at ../germomics and ../foxhound (set GERMOMICS_CLONE and FOXHOUND_CLONE to move them), so CI never runs it; the
 * fixtures are committed, and a site's output changing is a deliberate re-capture and a reviewed diff.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "test", "fixtures", "site-helpers");
const runners = join(root, "scripts", "lib", "site-fixture-runners");
mkdirSync(fixtures, { recursive: true });

/** @type {{ capturedAt: string, sources: Record<string, unknown> }} */
const provenance = { capturedAt: new Date().toISOString(), sources: {} };

/** @param {string} name @param {string} clone @param {string[]} stubs module specifiers the runner stubs */
function captureFromClone(name, clone, stubs) {
  execFileSync("git", ["-C", clone, "fetch", "-q", "origin"], { stdio: "inherit" });
  const sha = execFileSync("git", ["-C", clone, "rev-parse", "origin/main"], { encoding: "utf8" }).trim();
  const work = mkdtempSync(join(tmpdir(), `site-helpers-${name}-`));
  try {
    const archive = execFileSync("git", ["-C", clone, "archive", "origin/main", "app"], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync("tar", ["-x", "-C", work], { input: archive });
    const env = {
      ...process.env,
      SITE_APP: join(work, "app"),
      SITE_STUB_DIR: runners,
      SITE_STUBS: JSON.stringify(Object.fromEntries(stubs.map((spec) => [spec, join(runners, `${name}-stubs.mjs`)]))),
    };
    const stdout = execFileSync("node", ["--import", pathToFileURL(join(root, "scripts", "lib", "site-clone-loader.mjs")).href, join(runners, `${name}.mjs`)], {
      env,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const outputs = JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}");
    for (const [file, text] of Object.entries(outputs)) writeFileSync(join(fixtures, `${name}-${file}`), String(text), "utf8");
    provenance.sources[name] = { repository: `DrDustinEdwards/${name}`, commit: sha, files: Object.keys(outputs) };
    console.log(`${name} @ ${sha.slice(0, 7)}: ${Object.keys(outputs).join(", ")}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

captureFromClone("germomics", process.env.GERMOMICS_CLONE ?? resolve(root, "..", "germomics"), ["~/lib/context.server", "~/lib/posts.server"]);
captureFromClone("foxhound", process.env.FOXHOUND_CLONE ?? resolve(root, "..", "foxhound"), [
  "~/db",
  "~/lib/cloudflare-context",
  "~/lib/blog/queries.server",
]);

// This site, as it is live: the documents the package builds the same way.
const origin = "https://dustinedwards.info";
for (const [file, path] of [
  ["sitemap.xml", "/sitemap.xml"],
  ["llms.txt", "/llms.txt"],
]) {
  const res = await fetch(`${origin}${path}`);
  if (!res.ok) throw new Error(`${origin}${path} answered ${res.status}`);
  writeFileSync(join(fixtures, `dustinedwards-${file}`), await res.text(), "utf8");
}
provenance.sources.dustinedwards = { repository: "DrDustinEdwards/dustinedwards-info", live: origin, files: ["sitemap.xml", "llms.txt"] };
console.log("dustinedwards: live sitemap.xml, llms.txt");

writeFileSync(join(fixtures, "PROVENANCE.json"), `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
