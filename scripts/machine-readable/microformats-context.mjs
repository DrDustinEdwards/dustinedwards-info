/*
 * What the microformats part renders and reads once: the built corpus, the bundled routes, the site identity and
 * the shared tally. Evaluated once however many parts import it; the checks are in microformats.mjs.
 */

import { errorMessage } from "@dustinedwards/site-runtime/log";
import { rmSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { bundleRoutes, importBundled } from "../lib/route-render.mjs";
import { buildArtifact } from "../build-content.mjs";
import { postPath } from "../../app/lib/content/pipeline.mjs";
import { createTally } from "@dustinedwards/devkit/node";

/** @type {(html: string, options: { baseUrl: string }) => any} */
export const mf2 = (await import("microformats-parser")).mf2;

console.log("\n  microformats\n");

export const tally = createTally({ separator: ": ", print: false });
export const { ok: assert, failed: failures } = tally;

/**
 * A second, narrow read on purpose: asking the pipeline would make the assertion `x === x`.
 *
 * @param {string} slug
 * @returns {Promise<string>}
 */
export async function frontmatterDate(slug) {
  const raw = await readFile(postPath(slug), "utf8");
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?$/m.exec(raw);
  if (!fence) throw new Error(`${slug}.md has no frontmatter block`);
  const line = /^date:[ \t]*(.+?)[ \t]*$/m.exec(fence[1]);
  if (!line) throw new Error(`${slug}.md frontmatter carries no date: field`);
  const parsed = new Date(line[1].replace(/^["']|["']$/g, ""));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${slug}.md frontmatter date "${line[1]}" is not a date`);
  }
  return parsed.toISOString();
}

/**
 * @param {any} item
 * @param {string} name
 * @returns {string | undefined}
 */
export function prop(item, name) {
  const value = item?.properties?.[name];
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

/**
 * @param {any[]} items
 * @returns {any[]}
 */
export function flatten(items) {
  /** @type {any[]} */
  const out = [];
  const walk = (/** @type {any[]} */ list) => {
    for (const item of list ?? []) {
      out.push(item);
      walk(item.children);
      for (const values of Object.values(item.properties ?? {})) {
        walk(/** @type {any[]} */ (values).filter((v) => v && typeof v === "object" && v.type));
      }
    }
  };
  walk(items);
  return out;
}

// Built here, not read off disk: the artifact is gitignored, and a stale one would certify a
// corpus nobody serves.
let artifact;
try {
  artifact = JSON.parse(await buildArtifact());
} catch (error) {
  console.error(
    `  FAIL  microformats: the corpus would not build, so there is nothing to ` +
      `render.\n\n  ${errorMessage(error)}\n\n  ` +
      `If this names content/generated/stack.json, run npm run build:stack first; ` +
      `check:all builds it for the tier.\n`,
  );
  throw new Error("microformats: the corpus would not build", { cause: error });
}
export const published = artifact.posts.filter((/** @type {any} */ p) => !p.draft);

assert(
  "the corpus has published posts to render",
  published.length > 0,
  `${artifact.posts.length} post(s) built, ${published.length} published. This gate ` +
    `asserts nothing over an empty scope, so an empty one is a failure rather than a pass.`,
);
if (failures.length > 0) {
  console.error(`  FAIL  microformats stopped before rendering:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  throw new Error("microformats: the corpus has no published posts");
}

// seo.ts gets its own bundle call: esbuild derives `outbase` from the entries' common parent, and
// mixing it with the routes moves every output under a subdirectory.
const routes = await bundleRoutes([
  "app/routes/blog.$slug.tsx",
  "app/routes/blog._index.tsx",
  "app/routes/home.tsx",
]);
// Registered at once, so an assertion that throws anywhere below cannot leave the bundles behind:
// a top-level try/finally would re-indent the whole gate. rmSync throws on a real failure.
const removeRoutes = () => rmSync(routes.outDir, { recursive: true, force: true });
process.once("exit", removeRoutes);
const identity = await bundleRoutes(["app/lib/seo.ts"]);
const removeIdentity = () => rmSync(identity.outDir, { recursive: true, force: true });
process.once("exit", removeIdentity);
export const cleanup = async () => {
  process.off("exit", removeRoutes);
  process.off("exit", removeIdentity);
  await routes.cleanup();
  await identity.cleanup();
};
export const [postModule, indexModule, homeModule] = await Promise.all(
  routes.files.map(importBundled),
);
const seo = await importBundled(identity.files[0]);

export const SITE = /** @type {any} */ (seo).SITE;
export const SITE_ORIGIN = /** @type {any} */ (seo).SITE_ORIGIN;
export const OWNER_PROFILES = /** @type {string[]} */ ([
  ...(/** @type {any} */ (seo).OWNER_PROFILES ?? []),
]);

assert(
  "the site identity module loaded",
  typeof SITE?.name === "string" && typeof SITE_ORIGIN === "string",
  `app/lib/seo.ts yielded SITE=${JSON.stringify(SITE)} and ` +
    `SITE_ORIGIN=${JSON.stringify(SITE_ORIGIN)}. Every expected author name and ` +
    `canonical origin below would be undefined, and undefined compares equal to a ` +
    `missing property, so the whole gate would pass by reading nothing.`,
);
if (failures.length > 0) {
  await cleanup();
  console.error(`  FAIL  microformats stopped before rendering:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  throw new Error("microformats: the site identity module did not load");
}

export const EXPECTED_AUTHOR_URL = `${SITE_ORIGIN}/`;
