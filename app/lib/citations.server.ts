import type { RouterContextProvider } from "react-router";
import { inArray } from "drizzle-orm";

import { getDb } from "~/db/client";
import { publicationCitations } from "~/db/schema";
import { getEnv, getExecutionContext } from "~/lib/context";
import { errorMessage } from "~/lib/error-message.mjs";

// Per DOI only: the OpenAlex author endpoint has works by other people merged into it.
//
// The counts live in D1 with no expiry (drizzle/0020_publications.sql). A row is replaced by a refresh
// and never deleted, so a page never shows a blank for a paper that once had a count: it serves the last
// count and refreshes behind the response. The refresh also runs weekly, from the watchdog, through the
// operator API's refresh_citations.

/** A row older than this is refreshed after the response that reads it. The count is shown regardless. */
const STALE_AFTER_DAYS = 7;
// A name, not an address: OpenAlex dropped the `mailto` pool, and a secrets gate reads this whole
// file, comments included, so do not quote the address here either.
const USER_AGENT = "dustinedwards.info (+https://dustinedwards.info)";

export type CitationEntry = {
  count: number;
  /** The day OpenAlex was read, YYYY-MM-DD. */
  fetchedAt: string;
  /** Taken from the response. Never constructed. */
  url: string | null;
};

/** DOIs are case-insensitive per spec: the table is keyed by the lower-cased name. */
const citationKey = (doi: string) => doi.trim().toLowerCase();

// The page renders the last count on any failure, but every failure is logged under one alert key, so
// a revoked key or an outage is visible rather than looking like a cold cache.
function logFailure(stage: string, doi: string | null, detail: unknown) {
  console.error(
    JSON.stringify({
      alert: "citation-count-failed",
      stage,
      doi,
      detail: errorMessage(detail),
    }),
  );
}

export type CitationFailure = { doi: string; stage: string; detail: string };

/**
 * The key is mandatory: keyless requests share a budget of about 100 credits, after which every
 * one is refused and the count stops moving.
 */
async function fetchOne(
  apiKey: string,
  doi: string,
): Promise<{ entry: CitationEntry } | { failure: CitationFailure }> {
  const url = new URL(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  url.searchParams.set("api_key", apiKey);
  const fail = (stage: string, detail: unknown) => {
    logFailure(stage, doi, detail);
    return { failure: { doi, stage, detail: errorMessage(detail) } };
  };

  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) {
      // 401 and 403 are configuration (a revoked or wrong key), and name it so; a 404 is a DOI
      // OpenAlex does not hold.
      return fail(res.status === 401 || res.status === 403 ? "openalex-key-refused" : "openalex-status", `HTTP ${res.status}`);
    }
    const body = (await res.json()) as { cited_by_count?: number; id?: string };
    if (typeof body.cited_by_count !== "number") {
      return fail("openalex-shape", "the response carried no cited_by_count");
    }
    return {
      entry: {
        count: body.cited_by_count,
        fetchedAt: new Date().toISOString().slice(0, 10),
        url: typeof body.id === "string" ? body.id : null,
      },
    };
  } catch (error) {
    return fail("openalex-fetch", error);
  }
}

async function readRows(env: Env, dois: string[]): Promise<Map<string, CitationEntry>> {
  const keys = [...new Set(dois.map(citationKey))];
  const out = new Map<string, CitationEntry>();
  if (keys.length === 0) return out;
  const rows = await getDb(env)
    .select()
    .from(publicationCitations)
    .where(inArray(publicationCitations.doi, keys));
  for (const row of rows) out.set(row.doi, { count: row.count, fetchedAt: row.fetchedAt, url: row.url });
  return out;
}

/** Replaces a row; a read older than the stored one never overwrites it, and nothing ever deletes one. */
async function writeCitation(env: Env, doi: string, entry: CitationEntry) {
  await env.DB.prepare(
    `INSERT INTO publication_citations (doi, count, url, fetched_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(doi) DO UPDATE SET count = excluded.count, url = excluded.url, fetched_at = excluded.fetched_at
     WHERE excluded.fetched_at >= publication_citations.fetched_at`,
  )
    .bind(citationKey(doi), entry.count, entry.url, entry.fetchedAt)
    .run();
}

/**
 * Reads each DOI from OpenAlex and replaces its row. A DOI that fails keeps the count it had, and the
 * failure is returned, so the caller (the operator tool the watchdog calls) can say which and why.
 */
export async function refreshCitations(
  env: Env,
  dois: string[],
): Promise<{ refreshed: number; failures: CitationFailure[] }> {
  const apiKey = env.OPENALEX_API_KEY;
  if (!apiKey) {
    const detail = "OPENALEX_API_KEY is not set, so no count can refresh";
    logFailure("config", null, detail);
    return { refreshed: 0, failures: dois.map((doi) => ({ doi, stage: "config", detail })) };
  }
  let refreshed = 0;
  const failures: CitationFailure[] = [];
  for (const doi of dois) {
    const result = await fetchOne(apiKey, doi);
    if ("failure" in result) {
      failures.push(result.failure);
      continue;
    }
    try {
      await writeCitation(env, doi, result.entry);
      refreshed += 1;
    } catch (error) {
      logFailure("d1-write", doi, error);
      failures.push({ doi, stage: "d1-write", detail: errorMessage(error) });
    }
  }
  return { refreshed, failures };
}

/** Whether a row's read is old enough to refresh. A date the table cannot parse counts as stale. */
function isStale(entry: CitationEntry, now = Date.now()) {
  const read = Date.parse(`${entry.fetchedAt}T00:00:00Z`);
  return Number.isNaN(read) || now - read > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Reads D1 only and never blocks on OpenAlex. A row that is stale, or missing, is refreshed after the
 * response, and the last count is shown meanwhile: a count once seen is never replaced by a blank.
 */
export async function getCitationCounts(
  context: Readonly<RouterContextProvider>,
  dois: string[],
): Promise<Record<string, CitationEntry>> {
  const env = getEnv(context);
  const ctx = getExecutionContext(context);
  const rows = await readRows(env, dois);

  const out: Record<string, CitationEntry> = {};
  const due: string[] = [];
  for (const doi of dois) {
    const entry = rows.get(citationKey(doi));
    if (entry) out[doi] = entry;
    if (!entry || isStale(entry)) due.push(doi);
  }

  if (due.length > 0) {
    if (!env.OPENALEX_API_KEY) {
      logFailure("config", null, `OPENALEX_API_KEY is not set, so ${due.length} stale or missing DOI(s) never refresh`);
    } else {
      ctx.waitUntil(refreshCitations(env, due).then(() => undefined));
    }
  }

  return out;
}
