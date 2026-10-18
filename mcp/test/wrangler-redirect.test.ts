/**
 * A local build must not be captured by a site build's wrangler redirect. The site's
 * `react-router build` writes ../.wrangler/deploy/config.json, and a bare `wrangler` in this
 * folder then refuses with "Found both a user configuration file and a deploy configuration
 * file" (it stopped the first local ship:mcp, 2026-10-10). CI never has that file, so only a
 * planted copy can show it. The scripts name their config with -c, which skips the lookup.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

const mcp = fileURLToPath(new URL("..", import.meta.url));
const wrangler = join(mcp, "node_modules", "wrangler", "bin", "wrangler.js");
let root = "";
let folder = "";

before(() => {
  root = mkdtempSync(join(tmpdir(), "mcp-redirect-"));
  folder = join(root, "mcp");
  mkdirSync(folder);
  for (const name of ["package.json", "tsconfig.json"]) cpSync(join(mcp, name), join(folder, name));
  cpSync(join(mcp, "wrangler.jsonc.example"), join(folder, "wrangler.jsonc"));
  // Junctions, which Windows creates without Developer Mode or an elevated shell; elsewhere the
  // type is ignored and these are ordinary symlinks.
  symlinkSync(join(mcp, "src"), join(folder, "src"), "junction");
  symlinkSync(join(mcp, "node_modules"), join(folder, "node_modules"), "junction");
  symlinkSync(join(mcp, "..", "app"), join(root, "app"), "junction");
  /* The site build's redirect, one folder above the config, as on Dustin's machine. */
  mkdirSync(join(root, "build", "server"), { recursive: true });
  writeFileSync(join(root, "build", "server", "wrangler.json"), JSON.stringify({ name: "site", main: "index.js" }));
  mkdirSync(join(root, ".wrangler", "deploy"), { recursive: true });
  writeFileSync(join(root, ".wrangler", "deploy", "config.json"), JSON.stringify({ configPath: "../../build/server/wrangler.json" }));
});

after(() => rmSync(root, { recursive: true, force: true }));

function run(args: string[]) {
  return spawnSync(process.execPath, [wrangler, ...args], { cwd: folder, encoding: "utf8", timeout: 120_000 });
}

describe("a site build's wrangler redirect", () => {
  test("is planted correctly: a bare wrangler build is refused", () => {
    const bare = run(["deploy", "--dry-run", "--outdir=dist"]);
    assert.notEqual(bare.status, 0);
    assert.match(bare.stdout + bare.stderr, /deploy configuration file/);
  });

  test("does not stop the build script's command", () => {
    const script = requirePackage().scripts.build as string;
    assert.match(script, /(^|\s)-c wrangler\.jsonc(\s|$)/);
    const args = script.replace(/^wrangler /, "").split(/\s+/);
    const built = run(args);
    assert.equal(built.status, 0, built.stdout + built.stderr);
  });

  test("every wrangler script names its config", () => {
    const scripts = requirePackage().scripts as Record<string, string>;
    for (const [name, command] of Object.entries(scripts)) {
      if (!/\bwrangler\b/.test(command)) continue;
      for (const part of command.split("&&")) {
        if (!/\bwrangler\b/.test(part)) continue;
        assert.match(part, /\s(-c|--config)[ =]/, `npm run ${name}: ${part.trim()}`);
      }
    }
  });
});

function requirePackage() {
  return JSON.parse(readFileSync(join(mcp, "package.json"), "utf8"));
}
