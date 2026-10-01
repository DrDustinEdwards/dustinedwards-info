// The one llms.txt save, called by the site-api adapter for Carrel (app/lib/carrel/document-handler.server.ts),
// and the reads the operator's get_llms tool and the llms-drift check answer (docs/LLMS.md). The document is
// content/llms.txt, the source; /llms.txt is served from the `settings` row derived from it. A save judges the
// file with the rules CI runs (validate.mjs), refuses it with every message if it fails, commits it to the
// repository (unless it is byte-identical, commitUnlessUnchanged), then writes the row and purges /llms.txt,
// so the change is live on the next request with no build or deploy. The commit is never reverted when the D1
// write fails (hard rule 18); the error says the commit landed and how to repair the row. A document has no
// draft state: it is always the published file, and a save edits it live.

import { listPublishedPublicationTwins } from "~/db/publications";
import { listPublishedProcedures } from "~/db/procedures";
import { getSetting, setSetting } from "~/db/settings";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgeLlms, type PurgeOutcome } from "~/lib/cache-purge.server";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { CONTENT_PAGE_PATHS } from "~/lib/content-pages.mjs";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { commitFiles, readFile } from "~/lib/editor/github.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { paperMarkdownPath } from "~/lib/publications/paths.mjs";
import { SITE_ORIGIN } from "~/lib/seo";

import { LLMS_PATH, LLMS_SETTING_KEY, llmsChecks, llmsErrors } from "./validate.mjs";

type LlmsEnv = Env & { GITHUB_TOKEN?: string };

/** A file the validator refused: 422, with every message, so the caller can fix its own edit. */
class LlmsInvalid extends ContentInvalid {
  constructor(errors: string[]) {
    super(`${LLMS_PATH} was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "LlmsInvalid";
  }
}

/**
 * Every rule against what the site holds now: the registered pages and the published procedures (the
 * protocols are pages, drawn from D1), and the papers the publications table serves.
 */
async function judgeLlms(env: LlmsEnv, raw: string) {
  const [{ findWideDashes }, procedures, twins] = await Promise.all([
    loadPipeline(),
    listPublishedProcedures(env),
    listPublishedPublicationTwins(env),
  ]);
  return llmsChecks(raw, {
    pagePaths: [...CONTENT_PAGE_PATHS, ...procedures.map((p) => p.path)],
    origin: SITE_ORIGIN,
    findWideDashes,
    twinUrls: twins.map((t) => paperMarkdownPath(t.slug)),
  });
}

/**
 * The one compile door: a save and sync_llms both read the file through it. The row carries the bytes, so
 * "compiled" is the bytes judged, with the blob sha the drift check compares.
 */
export async function compileLlms(env: LlmsEnv, raw: string) {
  const errors = llmsErrors(await judgeLlms(env, raw));
  if (errors.length > 0) return { ok: false as const, errors };
  return { ok: true as const, errors: [] as string[], raw, sourceBlobSha: await gitBlobSha(raw) };
}

/** get_llms: the file, the head it was read at, the rules it fails now, and whether the row serves it. */
export async function readLlms(env: LlmsEnv) {
  const file = await readFile(env, LLMS_PATH);
  if (!file) return null;
  const row = await getSetting(env, LLMS_SETTING_KEY);
  return {
    path: LLMS_PATH,
    raw: file.content,
    bytes: new TextEncoder().encode(file.content).length,
    errors: llmsErrors(await judgeLlms(env, file.content)),
    servedFromRepository: row === file.content,
  };
}

/** The one write door for the row /llms.txt is served from: a save and sync_llms both end here, read back. */
export async function writeLlmsRow(env: LlmsEnv, raw: string) {
  await setSetting(env, LLMS_SETTING_KEY, raw);
  const stored = await getSetting(env, LLMS_SETTING_KEY);
  if (stored !== raw) {
    throw new Error(
      `The llms.txt row was written but the row read back is not the file (${stored === null ? "missing" : `${stored.length} characters`}, ` +
        `expected ${raw.length}). Run the llms sync (sync_llms) to rebuild it from the repository.`,
    );
  }
}

/** True when the served row is exactly this file. */
async function rowIsCurrent(env: LlmsEnv, raw: string) {
  return (await getSetting(env, LLMS_SETTING_KEY)) === raw;
}

/** The llms.txt save. */
export async function saveLlms(
  env: LlmsEnv,
  options: { raw: string; expectedHeadSha: string | null; actor: Actor },
) {
  const { raw, actor } = options;
  const existing = await readFile(env, LLMS_PATH);
  if (!existing) {
    throw new LlmsInvalid([`${LLMS_PATH} is missing from the repository, so there is nothing to edit. A save does not create it.`]);
  }

  const compiled = await compileLlms(env, raw);
  if (!compiled.ok) throw new LlmsInvalid(compiled.errors);
  decideFileWrite({ actor, noun: "llms.txt", incomingDraft: false, priorRaw: existing.content, isDraft: () => false });

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, raw),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        message: `Update llms.txt${tag}`,
        changes: [{ path: LLMS_PATH, content: raw }],
      }),
  });
  if (written.action === "noop") {
    return { commitSha: written.commitSha, unchanged: true, note: UNCHANGED_NOTE, purged: null as PurgeOutcome };
  }
  const { commitSha, blobShas } = written;
  if (written.action === "commit" && blobShas[LLMS_PATH] && blobShas[LLMS_PATH] !== compiled.sourceBlobSha) {
    throw new Error(
      `${LLMS_PATH} WAS committed as ${commitSha}, but the committed bytes (${blobShas[LLMS_PATH]}) are not ` +
        `the bytes judged (${compiled.sourceBlobSha}), so the row was not updated. Run sync_llms to rebuild it ` +
        "from the repository.",
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeLlmsRow(env, raw);
      purged = await purgeLlms("save llms.txt");
    },
    // Nothing kept in KV for a document: the thrown error names the commit and the repair (sync_llms), and
    // the watchdog's llms-drift check repairs the row from the repository anyway.
    recordDivergence: async () => undefined,
    slug: "llms.txt",
    commitSha,
  });

  return { commitSha, unchanged: written.action !== "commit", purged };
}
