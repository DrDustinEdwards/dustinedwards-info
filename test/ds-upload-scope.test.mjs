import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  enforceVerdict,
  planViolations,
  plannedWrites,
  refusal,
} from "../scripts/lib/ds-upload-scope.mjs";

/** A throwaway output folder holding exactly these files. */
function outDirWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "ds-scope-"));
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), "x");
  }
  return dir;
}

/** The files a real build writes today (ds-bundle, 2026-09-23), locals included. */
const REAL_BUILD = [
  "_ds_bundle.css",
  "_ds_bundle.js",
  "_ds_needs_recompile",
  "_ds_sync.json",
  "styles.css",
  "README.md",
  "components/general/SiteLogo/SiteLogo.html",
  "components/general/SiteLogo/SiteLogo.jsx",
  "fonts/fonts.css",
  "fonts/inter-latin-normal.woff2",
  "guidelines/index.md",
  "guidelines/capsid/TASK-redesign-brief-2026-09.md",
  "_vendor/react.js",
  "_preview/SiteLogo.js",
  "_preview/SiteLogoHeader.js",
  ".resync-verdict.json",
  ".sync-diff.json",
  "_screenshots/review/general__SiteLogo.png",
];

const upload = (deletePaths = []) => ({
  version: 2,
  ok: true,
  upload: { any: true, components: [], deletePaths, bundle: true, styling: true, aux: true },
});

test("a real build's upload is inside scope, and what stays local is not planned", () => {
  const dir = outDirWith(REAL_BUILD);
  try {
    const writes = plannedWrites(dir);
    assert.ok(!writes.some((p) => p.startsWith(".") || p.startsWith("_screenshots/")));
    assert.equal(writes.length, REAL_BUILD.length - 3);
    const { verdict, violations } = enforceVerdict(upload(), dir);
    assert.deepEqual(violations, []);
    assert.equal(verdict.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PLANTED: a plan deleting templates/visual-system is refused before upload", () => {
  const dir = outDirWith(REAL_BUILD);
  try {
    const { verdict, violations } = enforceVerdict(
      upload(["templates/visual-system/VisualSystem.dc.html", "templates/visual-system"]),
      dir,
    );
    assert.equal(violations.length, 2);
    assert.ok(violations.every((v) => v.includes("protected")));
    assert.equal(verdict.ok, false);
    assert.equal(verdict.upload, null);
    assert.deepEqual(verdict.uploadScopeRefused, violations);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PLANTED: a plan writing a root .html page is refused before upload", () => {
  const dir = outDirWith([...REAL_BUILD, "Home page - Plate I, locked system.html"]);
  try {
    const { verdict, violations } = enforceVerdict(upload(), dir);
    assert.deepEqual(violations, [
      "write Home page - Plate I, locked system.html: not a build-owned path",
    ]);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.upload, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("github.md and the old canvas folders are never in scope", () => {
  for (const p of ["github.md", "part-c/09-solid-lawn.html", "references/home-1280-light.png", "uploads/Capture.PNG"]) {
    assert.notEqual(refusal(p), null, p);
  }
  assert.match(refusal("github.md"), /protected/);
});

test("_preview/ is build-owned only for the component scripts directly in it", () => {
  assert.equal(refusal("_preview/SiteLogo.js"), null);
  assert.notEqual(refusal("_preview/reskin.png"), null);
  assert.notEqual(refusal("_preview/nested/x.js"), null);
});

test("a path that is not plain and relative is refused, not normalized", () => {
  for (const p of ["../styles.css", "/styles.css", "fonts/../templates/x", "components\\x.html", "", "fonts//a"]) {
    assert.notEqual(refusal(p), null, JSON.stringify(p));
  }
});

test("a verdict that uploads nothing is passed through untouched", () => {
  const v = { ok: true, upload: { any: false, deletePaths: [] } };
  assert.equal(enforceVerdict(v, "/nonexistent").verdict, v);
  const n = { ok: false, upload: null };
  assert.equal(enforceVerdict(n, "/nonexistent").verdict, n);
});

test("a hand-built plan names every refused path, writes and deletes both", () => {
  const v = planViolations({ writes: ["styles.css", "index.html"], deletes: ["github.md", "fonts/a.woff2"] });
  assert.deepEqual(v, ["write index.html: not a build-owned path", "delete github.md: protected: never written or deleted by a sync"]);
});
