import { cloudflareContext } from "~/lib/context";
import type { RouterContextProvider } from "react-router";

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

async function readOne(kv: KVNamespace, doi: string): Promise<CitationEntry | null> {
  try {
    return await kv.get<CitationEntry>(key(doi), "json");
  } catch {
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
 * Reads KV only and never blocks on OpenAlex: a cold DOI renders no count (never a zero) and is
 * refreshed after the response.
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

  const apiKey = env.OPENALEX_API_KEY;

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
          } catch {
            // The next request tries again.
          }
        }
      })(),
    );
  }

  return out;
}
