/**
 * Who cites each paper, from OpenAlex, into a committed artifact.
 *
 *   node scripts/fetch-cited-by.mjs          report only
 *   node scripts/fetch-cited-by.mjs --write  update data/publications.cited-by.json
 *
 * ## WHY A COMMITTED ARTIFACT AND NOT A RUNTIME FETCH
 *
 * The counts on these pages come from KV and refresh themselves, because a
 * count is one number and a stale one is only slightly wrong. A citing LIST is
 * different in three ways that all point the same direction:
 *
 *   It is 55 KB across 25 papers. Fetching it per request would put a
 *   third-party round trip in front of a page that is otherwise a pure function
 *   of committed data, on a route that is shared-cached precisely because it has
 *   no per-reader anything.
 *
 *   It needs a LIST query. `?filter=cites:W...` costs 10 credits where a
 *   singleton lookup costs 1, and OpenAlex has metered both since 2026-02-13.
 *   Ruling 63 says "singleton lookups only"; there is no singleton form of
 *   cited-by, so this is the one place that rule is departed from, deliberately,
 *   and doing it at build rather than per request is what keeps the departure
 *   small: 286 credits for the whole corpus, once, rather than per reader.
 *
 *   It is EVIDENCE, and evidence carries a date. The artifact records when it
 *   was read and the page says so, which is the same contract the counts have.
 *
 * ## NOT A GATE, AND NEVER RUN BY ONE
 *
 * Network, and a gate that fetches OpenAlex is red on OpenAlex's bad day rather
 * than on ours. Same placement as `pubs-pipeline/refresh.py`: a human runs it,
 * the result is committed, and `check:publications` checks the committed file.
 *
 * ## NEWEST FIRST, CAPPED AT 50
 *
 * Ruling 63's number. One paper in this corpus exceeds it (52 citations), and
 * the artifact records the true total beside the truncated list so the page can
 * say "50 of 52" rather than implying it has them all.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readDevVar } from "./lib/dev-vars.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(root, "data", "publications.cited-by.json");
const SITE_PATH = join(root, "data", "publications.site.json");

/** Ruling 63. Also the artifact's shape: a longer list would be a bigger page. */
const MAX_CITING = 50;

/** Identifies the caller. Not an address, for the reason citations.server.ts gives. */
const USER_AGENT = "dustinedwards.info (+https://dustinedwards.info)";

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = readDevVar("OPENALEX_API_KEY");
  if (!apiKey) {
    console.error(
      "OPENALEX_API_KEY is not in .dev.vars. OpenAlex has required a key since\n" +
        "2026-02-13 and a keyless request is refused after about 100 credits, so\n" +
        "this refuses before spending anything rather than half-filling the file.",
    );
    process.exit(1);
  }

  const site = JSON.parse(readFileSync(SITE_PATH, "utf8"));
  const dois = Object.keys(site);
  const fetchedAt = new Date().toISOString().slice(0, 10);

  /** @type {Record<string, any>} */
  const works = {};
  let singles = 0;
  let lists = 0;

  const get = async (/** @type {URL} */ url) => {
    url.searchParams.set("api_key", apiKey);
    await sleep(120);
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    return { status: res.status, body: res.ok ? await res.json() : null };
  };

  for (const doi of dois) {
    const id = site[doi].id;
    const single = await get(
      new URL(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`),
    );
    singles += 1;
    if (!single.body) {
      console.log(`  MISS ${id} (${doi}) HTTP ${single.status}`);
      continue;
    }
    const openalexId = String(single.body.id ?? "").split("/").pop();
    const total = Number(single.body.cited_by_count ?? 0);
    if (!openalexId || total === 0) {
      works[doi] = { openalexId: openalexId ?? null, total, citing: [] };
      continue;
    }

    const list = new URL("https://api.openalex.org/works");
    list.searchParams.set("filter", `cites:${openalexId}`);
    list.searchParams.set("per-page", String(MAX_CITING));
    list.searchParams.set("sort", "publication_year:desc");
    // `select` keeps the response to the four fields the page renders. The
    // default response is a large record per work and this is 50 of them.
    list.searchParams.set("select", "id,doi,title,publication_year,primary_location");
    const cited = await get(list);
    lists += 1;

    works[doi] = {
      openalexId,
      total,
      citing: (cited.body?.results ?? []).map((/** @type {any} */ w) => ({
        title: w.title ?? null,
        year: w.publication_year ?? null,
        venue: w.primary_location?.source?.display_name ?? null,
        // The DOI as OpenAlex gives it, which is a full URL; the page needs the
        // bare name. Stripped here so the artifact carries one form.
        doi: typeof w.doi === "string" ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : null,
      })),
    };
    console.log(
      `  ${id.padEnd(44)} ${String(total).padStart(4)} citing, ` +
        `${works[doi].citing.length} fetched`,
    );
  }

  const artifact = {
    comment:
      "Citing works from OpenAlex, newest first, capped at " +
      `${MAX_CITING} per paper. Generated by scripts/fetch-cited-by.mjs. ` +
      "Not a gate: it needs the network. `total` is the true count and `citing` " +
      "may be shorter, which is what lets a page say 50 of 52 honestly.",
    fetchedAt,
    maxCiting: MAX_CITING,
    works,
  };

  const resolved = Object.values(works).length;
  const citing = Object.values(works).reduce((s, w) => s + w.citing.length, 0);
  console.log(
    `\nresolved ${resolved} of ${dois.length}; ${citing} citing works; ` +
      `${singles} singleton + ${lists} list queries = ${singles + lists * 10} credits`,
  );

  if (process.argv.includes("--write")) {
    // LF and a trailing newline, like every other committed artifact here.
    writeFileSync(OUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    console.log(`wrote ${OUT_PATH}`);
  } else {
    console.log("DRY RUN. Pass --write to update the artifact.");
  }
}

await main();
