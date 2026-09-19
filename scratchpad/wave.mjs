// WHICH WAVE A SCRATCHPAD TOOL IS LOOKING AT, in one place.
//
// Six tools each resolved this themselves, and every one of them spelled wave 2 into a literal:
// a run against wave 3 read wave 2's snapshot directory and threw on a filename, which is the
// lucky version. The unlucky version is a tool whose literal still resolves, reporting confidently
// about the wrong wave. That is the drift `scripts/lib/strip-comments.mjs` was written about,
// arriving in the tooling that is rewriting its comment.
//
// WAVE=n selects; 1 is the default and keeps its unsuffixed directory names, because wave 1's
// proofs were committed against those spellings and have to keep reproducing.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const WAVE = Number(process.env.WAVE ?? 1);
if (!Number.isInteger(WAVE) || WAVE < 1) throw new Error(`WAVE must be a positive integer, got ${process.env.WAVE}`);

const mod = await import(pathToFileURL(join(HERE, `code-wave${WAVE}.mjs`)).href);

/** The wave's files, largest comment bytes first. */
export const FILES = mod[`WAVE${WAVE}`];
/** The chunk table: chunk number to [file, firstBlock, lastBlock] spans. */
export const CHUNKS = mod.CHUNKS;
export const KEEP_SHARE = mod.KEEP_SHARE;

const SUFFIX = WAVE === 1 ? "" : `-wave${WAVE}`;
/** The pristine copies every mode reads, so each run starts from the same bytes. */
export const BEFORE = join(HERE, `code-history-before${SUFFIX}`);
export const DECISIONS = join(HERE, `code-decisions${SUFFIX}`);
export const HISTORY_MD = join(HERE, `code-history-2026-09-wave${WAVE}.md`);

/** A repo path as its snapshot filename. Slashes flatten so the snapshot is one directory. */
export const flat = (s) => s.replace(/\//g, "__");

/** The files one chunk covers, in the order the chunk table names them. */
export function chunkFiles(chunk) {
  const spec = CHUNKS[chunk];
  if (!spec) throw new Error(`no chunk ${chunk} in wave ${WAVE}`);
  const spans = Array.isArray(spec[0]) ? spec : [spec];
  return [...new Set(spans.map((s) => s[0]))];
}
