/**
 * Asserts that every head description stays inside the length search engines
 * will actually show.
 *
 * Google truncates a description around 155 to 160 characters. A description
 * that runs past that is not a longer description, it is a shorter one with an
 * ellipsis, and the tail is wasted. 160 is the gate.
 *
 * Reads the source rather than a rendered page, so it runs offline and fails
 * before a deploy rather than after one.
 *
 * Run: npm run check:meta
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT = 160;

/** @type {{ where: string, key: string, text: string }[]} */
const found = [];

// The four single-topic descriptions.
const route = readFileSync(join(ROOT, "app", "routes", "publications.tsx"), "utf8");
const block = route.match(
  /const TOPIC_META: Record<TopicId, \{[^}]*\}> = \{([\s\S]*?)\n\};/,
);
if (!block) throw new Error("TOPIC_META block not found in publications.tsx");
for (const m of block[1].matchAll(
  /"?([a-z-]+)"?: \{\s*title: "((?:[^"\\]|\\.)*)",\s*description:\s*"((?:[^"\\]|\\.)*)",/g,
)) {
  found.push({ where: "TOPIC_META", key: m[1], text: JSON.parse(`"${m[3]}"`) });
}
if (found.length !== 4) {
  throw new Error(`expected 4 topic descriptions, parsed ${found.length}`);
}

// The bare-page description, which the four topic views fall back to.
const seo = readFileSync(join(ROOT, "app", "lib", "seo.ts"), "utf8");
for (const name of ["PUBLICATIONS_DESCRIPTION", "PHAGE_HUNTERS_DESCRIPTION"]) {
  const m = seo.match(
    new RegExp(`export const ${name} =\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)";`),
  );
  if (!m) throw new Error(`${name} not found in seo.ts`);
  found.push({ where: "seo.ts", key: name, text: JSON.parse(`"${m[1]}"`) });
}

let failed = 0;
console.log(`${"where".padEnd(12)}${"key".padEnd(30)}${"len".padStart(5)}`);
for (const d of found) {
  const over = d.text.length > LIMIT;
  if (over) failed += 1;
  console.log(
    `${d.where.padEnd(12)}${d.key.padEnd(30)}${String(d.text.length).padStart(5)}` +
      (over ? `  OVER ${LIMIT}` : ""),
  );
}

if (failed > 0) {
  console.error(
    `\n${failed} description(s) exceed ${LIMIT} characters and will truncate in ` +
      `search results. Shorten them rather than raising the limit.`,
  );
  process.exit(1);
}
console.log(`\nAll ${found.length} descriptions are within ${LIMIT} characters.`);
