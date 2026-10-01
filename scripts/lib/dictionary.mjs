// Every dictionary entry file compiled the one way the Carrel adapter's save compiles it
// (app/lib/dictionary/compile.mjs), for build:content, sync:content, the gates and the link check.

import { open, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findWideDashes } from "../../app/lib/content/pipeline.mjs";
import { compileDictionaryEntry } from "../../app/lib/dictionary/compile.mjs";
import { DICTIONARY_DIR, parseDictionaryEntry } from "../../app/lib/dictionary/parse.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The D1 rows sync:content writes. */
export const DICTIONARY_ARTIFACT_PATH = path.join("content", "generated", "dictionary.json");

/** The repository's pronunciation clips, read from public/ as a clone has them. */
export const repoHost = {
  /** @param {string} sitePath site-absolute, `/audio/<name>.mp3` */
  async audio(sitePath) {
    const file = path.join(ROOT, "public", sitePath.replace(/^\//, ""));
    const info = await stat(file).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return null;
    const handle = await open(file, "r");
    try {
      const head = Buffer.alloc(2);
      await handle.read(head, 0, 2, 0);
      return { size: info.size, head: [...head] };
    } finally {
      await handle.close();
    }
  },
};

/**
 * Compiles every file in content/dictionary/, each against the others for uniqueness. A file that does not
 * compile is returned with its errors, never skipped: the caller decides what that means.
 *
 * @param {{ host?: import("../../app/lib/dictionary/compile.mjs").DictionaryHost }} [options]
 */
export async function compileAllDictionary(options = {}) {
  const host = options.host ?? repoHost;
  const names = (await readdir(path.join(ROOT, DICTIONARY_DIR))).filter((n) => n.endsWith(".md")).sort();
  const sources = await Promise.all(
    names.map(async (name) => ({
      key: name.slice(0, -3),
      raw: await readFile(path.join(ROOT, DICTIONARY_DIR, name), "utf8"),
    })),
  );
  // Each file is judged against the others' paths, as the Worker's save judges one against the table.
  const identities = sources.map(({ key, raw }) => {
    const { data } = parseDictionaryEntry({ file: key, raw });
    return { key, path: typeof data.path === "string" ? data.path : "" };
  });
  return Promise.all(
    sources.map(async ({ key, raw }) => ({
      file: `${DICTIONARY_DIR}/${key}.md`,
      key,
      raw,
      compiled: await compileDictionaryEntry({
        key,
        raw,
        pipeline: { findWideDashes },
        host,
        others: identities.filter((other) => other.key !== key),
      }),
    })),
  );
}

/**
 * The D1 rows sync:content writes and the published entries the page compile leads with. Throws on the first
 * file that does not compile: a build never ships an entry CI would refuse.
 */
export async function buildDictionary() {
  const compiled = await compileAllDictionary();
  const failed = compiled.filter((c) => !c.compiled.ok);
  if (failed.length > 0) {
    throw new Error(failed.map((c) => `${c.file} does not compile:\n  ${c.compiled.errors.join("\n  ")}`).join("\n"));
  }
  const ok = compiled.flatMap((c) => (c.compiled.ok ? [c.compiled] : []));
  const rows = ok.map((c) => ({
    key: c.key,
    path: c.entry.path,
    term: c.entry.term,
    status: c.draft ? "draft" : "published",
    record: JSON.stringify(c.entry),
    sourcePath: c.sourcePath,
    sourceBlobSha: c.sourceBlobSha,
  }));
  /** A draft entry is not shown, so the pages are compiled as though it had none. */
  const published = new Map(ok.filter((c) => !c.draft).map((c) => [c.entry.path, c.entry]));
  return { rows, entryFor: (/** @type {string} */ pagePath) => published.get(pagePath) };
}
