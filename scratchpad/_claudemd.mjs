// Every contract check:invariants puts on CLAUDE.md, asserted here before the gate runs.
//
// Four sections read the file (15, 15b, 19, 26) and each has its own shape requirement. The
// rewrite has to satisfy all of them at once, so they are collected in one place rather than
// discovered one red gate at a time. Needles are COPIED from the gate, not paraphrased.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../scripts/lib/strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(join(root, "CLAUDE.md"), "utf8");
const text = raw.replace(/\r\n/g, "\n");

let bad = 0;
const ok = (label, cond, detail = "") => {
  if (!cond) bad += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${cond ? "" : `  ${detail}`}`);
};

/* 15 */
ok(`under the 40000 truncation limit (${raw.length})`, raw.length < 40000);
ok(`under the 8192 target (${raw.length})`, raw.length < 8192, `${raw.length - 8192} over`);
const headings = [...text.matchAll(/\n## (.+)/g)].map((m) => m[1].trim());
ok(`at least 5 sections (${headings.length})`, headings.length >= 5);
const ordinal = headings.findIndex((h) => h === "Hard rules");
ok(`hard rules is one of the first two (index ${ordinal})`, ordinal !== -1 && ordinal <= 1);
ok("records append-only", /append-only/i.test(text));
const defined = [...raw.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1]));
ok(`defines at least 19 numbered rules (${defined.length})`, defined.length >= 19, defined.join(","));
const missing = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => !defined.includes(n));
ok("defines all twenty, every one of which is cited", missing.length === 0, `missing ${missing.join(",")}`);

/* 15b */
const body = (n) => {
  const start = text.indexOf(`### ${n}. `);
  if (start === -1) return "";
  const next = text.indexOf("\n### ", start + 1);
  return next === -1 ? text.slice(start) : text.slice(start, next);
};
const bodies = [4, 6, 13, 14].map(body);
ok(`bodies 4/6/13/14 all over 80 chars (${bodies.map((b) => b.length).join(",")})`, bodies.every((b) => b.length > 80));
ok("rule 4 claims login and auth", /login/.test(bodies[0]) && /auth/i.test(bodies[0]));
ok("rule 6 claims postPath and ONCE", /postPath/.test(bodies[1]) && /ONCE/.test(bodies[1]));
ok(
  "rule 13 names JUSTIFIED SUBSTITUTION and REMOTE_ARGS",
  /JUSTIFIED SUBSTITUTION|justified/i.test(bodies[2]) && /REMOTE_ARGS/.test(bodies[2]),
);
ok("rule 14 claims drizzle-kit is absent", /drizzle-kit/.test(bodies[3]));

/* 19 */
ok("points at FAILURES.md", raw.includes("FAILURES.md"));

/* 26 */
const listed = new Set(
  (/Never import bindings globally\.\s*\n\s*\n {4}([A-Z_ \t]+)\n/.exec(raw)?.[1] ?? "").split(/\s+/).filter(Boolean),
);
ok(`the binding list parses (${listed.size})`, listed.size >= 5);
const example = stripComments(readFileSync(join(root, "wrangler.jsonc.example"), "utf8"));
const declared = new Set();
for (const m of example.matchAll(/"binding"\s*:\s*"([A-Z0-9_]+)"/g)) declared.add(m[1]);
for (const m of example.matchAll(/"name"\s*:\s*"([A-Z0-9_]+)"/g)) declared.add(m[1]);
const extra = [...listed].filter((n) => !declared.has(n));
const absent = [...declared].filter((n) => !listed.has(n));
ok("every listed binding is declared", extra.length === 0, extra.join(","));
ok("every declared binding is listed", absent.length === 0, absent.join(","));

/* house style */
const wide = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
ok("no wide dash", !wide.some((c) => raw.includes(c)));

console.log(`\n${bad ? `${bad} FAILURE(S)` : "all CLAUDE.md contracts satisfied"}`);
process.exit(bad ? 1 : 0);
