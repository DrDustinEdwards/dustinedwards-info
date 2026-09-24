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
/*
 * THE CALLER'S NAME, AND DELIBERATELY NOT AN ADDRESS. OpenAlex removed the `mailto` polite pool, so
 * an address buys nothing from the vendor, and a real configured value does not belong in a
 * tracked file, which that address is: it is also the watchdog's ALERT_EMAIL.
 *
 * The address is not written out here either, for the reason it was removed: that gate reads the
 * WHOLE file and does not strip comments, which is correct. A value quoted in a comment is still the
 * value, sitting in git.
 */
const USER_AGENT = "dustinedwards.info (+https://dustinedwards.info)";

export type CitationEntry = {
  /** OpenAlex cited_by_count at fetch time. */
  count: number;
  /** ISO date the value was retrieved. */
  fetchedAt: string;
  /** OpenAlex work URL, taken from the response. Never constructed. */
  url: string | null;
};

/**
 * v2 adds `url`. The prefix bump forces a cold refresh rather than leaving a
 * seven day window where some counts link and others do not.
 */
const key = (doi: string) => `citations:v2:${doi.trim().toLowerCase()}`;

async function readOne(kv: KVNamespace, doi: string): Promise<CitationEntry | null> {
  try {
    return await kv.get<CitationEntry>(key(doi), "json");
  } catch {
    // A KV hiccup must never take the page down.
    return null;
  }
}

/**
 * ONE WORK BY DOI, WITH THE KEY, AND THE KEY IS MANDATORY.
 *
 * A keyless request draws on a shared budget of about 100 credits before every later one is refused,
 * so the optional path is not a polite fallback, it is a guaranteed failure with a `4xx` that this
 * function converts to `null` and the page renders as silence. A missing key SHORT CIRCUITS rather
 * than firing a request that cannot succeed. The User-Agent stays: it identifies the caller, which
 * costs nothing.
 *
 * **`env`, NOT `globalThis`.** Secrets and bindings arrive on `env`, per request; a
 * `globalThis` read is a no-op that looks like a feature flag and stays a no-op after the key is
 * set, which is the worst version of this bug. Portfolio rule and this repo's binding rule: read off
 * the request context, never a global.
 *
 * Singleton lookup, 1 credit. Never the author endpoint, which has works by other people merged into
 * it, and never a filter query from here.
 */
async function fetchOne(apiKey: string, doi: string): Promise<CitationEntry | null> {
  const url = new URL(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { cited_by_count?: number; id?: string };
    if (typeof body.cited_by_count !== "number") return null;
    return {
      count: body.cited_by_count,
      fetchedAt: new Date().toISOString().slice(0, 10),
      url: typeof body.id === "string" ? body.id : null,
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

  /*
   * NO KEY, NO REFRESH, AND THE PAGE IS UNHARMED.
   *
   * Whatever KV already holds is still returned above, so an unset secret
   * degrades to "counts stop aging forward", never to a blank page and never
   * to a zero. Checked here rather than inside `fetchOne` so a missing secret
   * costs nothing at all: no `waitUntil`, no loop, no request.
   */
  const apiKey = env.OPENALEX_API_KEY;

  if (cold.length > 0 && apiKey) {
    // After the response, so a cold cache costs the reader nothing.
    ctx.waitUntil(
      (async () => {
        for (const doi of cold) {
          const fresh = await fetchOne(apiKey, doi);
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
