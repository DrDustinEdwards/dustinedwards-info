import { cloudflareContext } from "~/lib/context";
import type { RouterContextProvider } from "react-router";

/**
 * Per-paper citation counts from OpenAlex, cached in APP_KV.
 *
 * Rules this file exists to enforce:
 *
 * - The page never blocks on OpenAlex. The loader reads KV only; refreshing a
 *   missing or stale entry happens in waitUntil, after the response is sent.
 * - A cached value is served even when OpenAlex is failing, with the date it
 *   was fetched. Nothing cached means nothing rendered, never a zero.
 * - Per DOI only. The author endpoint has seven works by other people merged
 *   into it, so it is never queried.
 * - One key per casefolded DOI, because DOI names are case-insensitive per
 *   spec and the site file stores them as deposited.
 */

const TTL_SECONDS = 7 * 24 * 60 * 60;
const EMAIL = "emaildustinedwards@gmail.com";

export type CitationEntry = {
  /** OpenAlex cited_by_count at fetch time. */
  count: number;
  /** ISO date the value was retrieved. */
  fetchedAt: string;
};

const key = (doi: string) => `citations:${doi.trim().toLowerCase()}`;

async function readOne(kv: KVNamespace, doi: string): Promise<CitationEntry | null> {
  try {
    return await kv.get<CitationEntry>(key(doi), "json");
  } catch {
    // A KV hiccup must never take the page down.
    return null;
  }
}

async function fetchOne(doi: string): Promise<CitationEntry | null> {
  const url = new URL(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  url.searchParams.set("mailto", EMAIL);
  // Sent only when configured, so adding a key later is config and not code.
  const apiKey = (globalThis as { OPENALEX_API_KEY?: string }).OPENALEX_API_KEY;
  if (apiKey) url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url, {
      headers: { "user-agent": `dustinedwards.info (mailto:${EMAIL})` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { cited_by_count?: number };
    if (typeof body.cited_by_count !== "number") return null;
    return {
      count: body.cited_by_count,
      fetchedAt: new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

/**
 * Cached counts for the given DOIs, keyed by the DOI as passed in.
 *
 * Returns whatever KV holds right now. Missing entries are refreshed after the
 * response, so the first request for a cold DOI renders no count and the next
 * one renders it.
 */
export async function getCitationCounts(
  context: Readonly<RouterContextProvider>,
  dois: string[],
): Promise<Record<string, CitationEntry>> {
  const { env, ctx } = context.get(cloudflareContext);
  const kv = env.APP_KV;

  const entries = await Promise.all(
    dois.map(async (doi) => [doi, await readOne(kv, doi)] as const),
  );

  const out: Record<string, CitationEntry> = {};
  const cold: string[] = [];
  for (const [doi, entry] of entries) {
    if (entry) out[doi] = entry;
    else cold.push(doi);
  }

  if (cold.length > 0) {
    // After the response, so a cold cache costs the reader nothing.
    ctx.waitUntil(
      (async () => {
        for (const doi of cold) {
          const fresh = await fetchOne(doi);
          if (!fresh) continue;
          try {
            await kv.put(key(doi), JSON.stringify(fresh), {
              expirationTtl: TTL_SECONDS,
            });
          } catch {
            // Nothing to do; the next request tries again.
          }
        }
      })(),
    );
  }

  return out;
}
