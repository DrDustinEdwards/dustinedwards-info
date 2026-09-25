import { getEnv, getExecutionContext } from "~/lib/context";
import type { RouterContextProvider } from "react-router";
import { errorMessage } from "~/lib/error-message.mjs";

// Per DOI only: the OpenAlex author endpoint has works by other people merged into it.

const TTL_SECONDS = 7 * 24 * 60 * 60;
// A name, not an address: OpenAlex dropped the `mailto` pool, and a secrets gate reads this whole
// file, comments included, so do not quote the address here either.
const USER_AGENT = "dustinedwards.info (+https://dustinedwards.info)";

export type CitationEntry = {
  count: number;
  fetchedAt: string;
  /** Taken from the response. Never constructed. */
  url: string | null;
};

// DOIs are case-insensitive per spec. The `v2` prefix bump forced a cold refresh when `url` arrived.
const key = (doi: string) => `citations:v2:${doi.trim().toLowerCase()}`;

// The page still renders no count on any failure, but every failure is logged under one alert key, so
// a revoked key or a KV outage is visible rather than looking like a cold cache.
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

async function readOne(kv: KVNamespace, doi: string): Promise<CitationEntry | null> {
  try {
    return await kv.get<CitationEntry>(key(doi), "json");
  } catch (error) {
    logFailure("kv-read", doi, error);
    return null;
  }
}

/**
 * The key is mandatory: keyless requests share a budget of about 100 credits, after which every
 * one is refused and the page renders silence.
 */
async function fetchOne(apiKey: string, doi: string): Promise<CitationEntry | null> {
  const url = new URL(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) {
      // 401 and 403 are configuration (a revoked or wrong key), and name it so; a 404 is a DOI
      // OpenAlex does not hold.
      const stage = res.status === 401 || res.status === 403 ? "openalex-key-refused" : "openalex-status";
      logFailure(stage, doi, `HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { cited_by_count?: number; id?: string };
    if (typeof body.cited_by_count !== "number") {
      logFailure("openalex-shape", doi, "the response carried no cited_by_count");
      return null;
    }
    return {
      count: body.cited_by_count,
      fetchedAt: new Date().toISOString().slice(0, 10),
      url: typeof body.id === "string" ? body.id : null,
    };
  } catch (error) {
    logFailure("openalex-fetch", doi, error);
    return null;
  }
}

/**
 * Reads KV only and never blocks on OpenAlex: a cold DOI renders no count (never a zero) and is
 * refreshed after the response.
 */
export async function getCitationCounts(
  context: Readonly<RouterContextProvider>,
  dois: string[],
): Promise<Record<string, CitationEntry>> {
  const env = getEnv(context);
  const ctx = getExecutionContext(context);
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

  const apiKey = env.OPENALEX_API_KEY;
  if (cold.length > 0 && !apiKey) {
    logFailure("config", null, `OPENALEX_API_KEY is not set, so ${cold.length} cold DOI(s) never refresh`);
  }

  if (cold.length > 0 && apiKey) {
    ctx.waitUntil(
      (async () => {
        for (const doi of cold) {
          const fresh = await fetchOne(apiKey, doi);
          if (!fresh) continue;
          try {
            await kv.put(key(doi), JSON.stringify(fresh), {
              expirationTtl: TTL_SECONDS,
            });
          } catch (error) {
            // The next request tries again.
            logFailure("kv-write", doi, error);
          }
        }
      })(),
    );
  }

  return out;
}
