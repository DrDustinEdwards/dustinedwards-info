// The one page save, called by the site-api adapter for Carrel (app/lib/pages/adapter.server.ts), and the
// read the operator's get_page tool answers. Content is edited through Carrel and nothing else: there is no
// save tool and no admin editor. A save compiles the file the way CI does (compile.mjs), judges its internal
// links (links.mjs), refuses it with every message if it fails, commits it to the repository (unless it is
// byte-identical, commitUnlessUnchanged), then writes its D1 row and search records, so the page changes on
// the next request with no build or deploy. The commit is never reverted when the D1 write fails (hard rule
// 18); the error says the commit landed and how to repair the row. A save cannot create a path: a page's
// address is structure and lives in CONTENT_PAGE_PATHS, in code.

import matter from "gray-matter";

import { listBlogPosts } from "~/db";
import { listPublishedPageHtml } from "~/db/pages";
import { listPublishedProcedures } from "~/db/procedures";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgePages, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { CONTENT_PAGE_PATHS, CONTENT_PAGES_FROM_DATA, contentPageSearchUid } from "~/lib/content-pages.mjs";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { commitFiles, readFile } from "~/lib/editor/github.server";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { PolicyError, WRITE_CAPABILITIES, type Actor } from "~/lib/editor/publish-policy.mjs";
import { recordsForPages } from "~/lib/search/records.mjs";
import { replaceSearchRecords } from "~/lib/search/replace.server";

import { compilePage, pageSlug, pageSourcePath } from "./compile.mjs";
import { idsIn, pageLinkErrors, type AddressBook } from "./links.mjs";

type PageEnv = Env & { GITHUB_TOKEN?: string };

/** A file the validator refused: 422, with every message, so the caller can fix its own edit. */
export class PageInvalid extends ContentInvalid {
  constructor(path: string, errors: string[]) {
    super(`The page "${path}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "PageInvalid";
  }
}

/**
 * The page a path names. A path outside CONTENT_PAGE_PATHS is refused here, before any read or write: a
 * save cannot create a path, and the error says so. /cv is generated from data and has no file.
 */
function registeredPage(path: string) {
  const clean = path.trim();
  if (!(CONTENT_PAGE_PATHS as readonly string[]).includes(clean)) {
    throw new PageInvalid(clean, [
      `"${clean}" is not a registered page path. A save cannot create a new path: a page's address is structure, ` +
        "so a new page's path is added to CONTENT_PAGE_PATHS (app/lib/content-pages.mjs) in code first. " +
        `Registered paths: ${CONTENT_PAGE_PATHS.filter((p) => !CONTENT_PAGES_FROM_DATA.includes(p)).join(", ")}`,
    ]);
  }
  if (CONTENT_PAGES_FROM_DATA.includes(clean)) {
    throw new PageInvalid(clean, [`${clean} is generated from structured data (CONTENT_PAGES_FROM_DATA); edit the data, not a markdown copy`]);
  }
  const slug = pageSlug(clean);
  return { path: clean, slug, file: pageSourcePath(slug) };
}

/** The one compile door: the save and sync_pages both read a file through it (no link check; see judge). */
export async function compile(env: PageEnv, slug: string, raw: string) {
  const { renderBody, findWideDashes } = await loadPipeline();
  return compilePage({ slug, raw, pipeline: { renderBody, findWideDashes } });
}

/** The address book the links are judged against: what D1 holds now, with this page's own HTML in place. */
async function addressBook(env: PageEnv, own: { path: string; html: string }): Promise<AddressBook> {
  const [procedures, posts, pageHtml] = await Promise.all([
    listPublishedProcedures(env),
    listBlogPosts(env, { perPage: 1000 }),
    listPublishedPageHtml(env),
  ]);
  const htmlOf = new Map(pageHtml);
  htmlOf.set(own.path, own.html);
  const ids = new Map<string, ReadonlySet<string>>();
  return {
    procedurePaths: new Set(procedures.map((p) => p.path)),
    posts: new Map(posts.posts.map((p) => [`/writing/${p.slug}`, true])),
    idsOf: (path) => {
      const html = htmlOf.get(path);
      if (html === undefined) return null;
      if (!ids.has(path)) ids.set(path, idsIn(html));
      return ids.get(path) ?? null;
    },
  };
}

/** Compile and link check together: every message the file has now, which is what CI and a save both refuse. */
async function judge(env: PageEnv, slug: string, raw: string) {
  const compiled = await compile(env, slug, raw);
  if (!compiled.ok) return compiled;
  const errors = pageLinkErrors(compiled.page, await addressBook(env, compiled.page));
  return errors.length > 0 ? { ok: false as const, errors } : compiled;
}

/** The file, and its front matter and body as parsed. */
export async function readPage(env: PageEnv, path: string) {
  const { slug, file } = registeredPage(path);
  const existing = await readFile(env, file);
  if (!existing) return null;
  const parsed = matter(existing.content);
  const judged = await judge(env, slug, existing.content);
  return {
    slug,
    path,
    raw: existing.content,
    draft: parsed.data.draft === true,
    record: { data: parsed.data, body: parsed.content },
    errors: judged.ok ? [] : judged.errors,
  };
}

/**
 * An operator may edit, unpublish and republish a page, never publish one for the first time: the same
 * rule as posts (ruling 37), read from the prior FILE, the only authority.
 */
function decidePage(actor: Actor, incomingDraft: boolean, prior: string | null) {
  const may = WRITE_CAPABILITIES[actor.kind];
  if (!may.write) {
    throw new PolicyError("Refused: this credential is READ ONLY and may not save a page.", "smoke-is-read-only");
  }
  const everPublished = prior !== null && matter(prior).data.draft !== true;
  if (!may.firstPublish && !incomingDraft && !everPublished) {
    throw new PolicyError(
      "Refused: publishing a page for the first time is reserved to the human admin. Save it with " +
        "draft: true, and ask Dustin to publish it.",
      "first-publish-requires-admin",
    );
  }
}

export async function writeRow(env: PageEnv, compiled: Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>) {
  const db = env.DB;
  const r = compiled.record;
  const uid = compiled.searchInput.uid;
  const records = compiled.draft ? [] : recordsForPages([compiled.searchInput]);
  await db.batch([
    db
      .prepare(
        `INSERT INTO pages (slug, path, title, description, status, record, markdown, source_path,
           source_blob_sha, synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET path = excluded.path, title = excluded.title,
           description = excluded.description, status = excluded.status, record = excluded.record,
           markdown = excluded.markdown, source_path = excluded.source_path,
           source_blob_sha = excluded.source_blob_sha, synced_at = excluded.synced_at`,
      )
      .bind(
        r.slug,
        r.path,
        r.title,
        r.description,
        compiled.draft ? "draft" : "published",
        JSON.stringify(r),
        compiled.markdown,
        compiled.sourcePath,
        compiled.sourceBlobSha,
      ),
    ...replaceSearchRecords(db, uid, records),
  ]);
}

/** The row of a page whose file is gone and its search records: the one removal sync_pages makes. */
export async function deletePageRow(env: PageEnv, row: { slug: string; path: string }) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM pages WHERE slug = ?1`).bind(row.slug),
    env.DB.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(contentPageSearchUid(row.path)),
    env.DB.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    env.DB.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ]);
}

/** True when D1's row for the page was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: PageEnv, slug: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM pages WHERE slug = ?1")
    .bind(slug)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

/** The page save. */
export async function savePage(
  env: PageEnv,
  options: { path: string; raw: string; expectedHeadSha: string | null; isNew: boolean; actor: Actor },
) {
  const { raw, actor } = options;
  const { path, slug, file } = registeredPage(options.path);
  const existing = await readFile(env, file);
  if (options.isNew && existing) throw new PageInvalid(path, [`the page ${path} already has a file (${file}); pass isNew false to edit it`]);
  if (!options.isNew && !existing) throw new PageInvalid(path, [`the page ${path} has no file yet; pass isNew to create it`]);

  const compiled = await judge(env, slug, raw);
  if (!compiled.ok) throw new PageInvalid(path, compiled.errors);
  decidePage(actor, compiled.draft, existing?.content ?? null);

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, slug, compiled.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        message: `${options.isNew ? "Add" : "Update"} page: ${compiled.record.title}${tag}`,
        changes: [{ path: file, content: raw }],
      }),
  });
  const unchanged = written.action !== "commit";
  if (written.action === "noop") {
    return {
      slug,
      path,
      commitSha: written.commitSha,
      unchanged: true,
      note: UNCHANGED_NOTE,
      created: false,
      draft: compiled.draft,
      purged: null as PurgeOutcome,
    };
  }
  const { commitSha, blobShas } = written;
  if (blobShas[file] && blobShas[file] !== compiled.sourceBlobSha) {
    throw new Error(
      `The page "${path}" WAS committed as ${commitSha}, but the committed bytes (${blobShas[file]}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its page was not updated. Run the content sync to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeRow(env, compiled);
      purged = await purgePages(`save page ${path}`);
    },
    // Nothing kept in KV for a page: the thrown error names the commit and the repair (the content sync),
    // and the next ship's sync converges the row from the repository anyway.
    recordDivergence: async () => undefined,
    slug,
    commitSha,
  });

  return {
    slug,
    path,
    commitSha,
    unchanged,
    created: options.isNew,
    draft: compiled.draft,
    purged,
  };
}
