import { getEnv } from "~/lib/context";
import { QUERY_CAP } from "~/lib/playground/limits";
import { search } from "~/lib/search/search.server";

/** The search anatomy's share of the playground loader: one real search with the fusion decomposition. */
export async function searchAnatomyDemo(
  context: Parameters<typeof getEnv>[0],
  params: URLSearchParams,
) {
  const qRaw = params.get("q") ?? "";
  const q = qRaw.trim().slice(0, QUERY_CAP);
  let anatomy = null;
  let anatomyError: string | null = null;

  if (q) {
    if (qRaw.trim().length > QUERY_CAP) {
      anatomyError = `That query is ${qRaw.trim().length} characters. The cap is ${QUERY_CAP}, so it was cut.`;
    }
    const env = getEnv(context);
    const result = await search(env, { q, pageSize: 10, explain: true });
    anatomy = {
      q,
      total: result.total,
      explain: result.explain ?? null,
      browse: result.explain === undefined && result.total > 0,
    };
  }

  return { anatomy, anatomyError, qRaw: qRaw.slice(0, QUERY_CAP) };
}
