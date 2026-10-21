import { listPublicationIdentities } from "~/db/publications";
import { errorMessage } from "~/lib/error-message.mjs";
import { OWNER_ORCID, SITE } from "~/lib/seo";

import { canonicalAuthor } from "./authors.mjs";
import { doiKey } from "./validate.mjs";

// Checks the publications list against ORCID and Crossref, so a DOI is caught the day one appears. It
// reads both and writes nothing: a publication is written through Carrel, never from here.
//
// ORCID's public API lists the works on the record. Crossref's `orcid:` filter lists the works whose
// deposit names the ORCID. A publisher that leaves the ORCID out of its deposit is caught only by name, so
// Crossref is also read for the last year's works under the owner's name, and those come back apart as
// matches to confirm: a name is not an identity (the reason citations.server.ts reads per DOI only).

// A name, not an address, for the reason citations.server.ts gives.
const USER_AGENT = "dustinedwards.info (+https://dustinedwards.info)";
const ORCID_ID = OWNER_ORCID.replace(/^https?:\/\/orcid\.org\//, "");
const NAME_WINDOW_DAYS = 400;

type SourceWork = { doi: string; title: string; year: number | null; sources: Array<"orcid" | "crossref"> };
type SourceFailure = { source: "orcid" | "crossref" | "crossref-name"; detail: string };

export type PublicationCheck = {
  orcid: string;
  /** DOIs ORCID or Crossref ties to the ORCID that no publication file carries, as its DOI or preprint DOI. */
  notOnSite: SourceWork[];
  /** Crossref works under the owner's name, created within NAME_WINDOW_DAYS, on neither list above nor the site. */
  nameMatches: SourceWork[];
  /** Published papers whose DOI is missing from the ORCID record. */
  notOnOrcid: Array<{ slug: string; doi: string }>;
  /** Files with no DOI yet (status submitted), to match the lists above against by title. */
  manuscripts: Array<{ slug: string; title: string }>;
  failures: SourceFailure[];
};

type CrossrefItem = {
  DOI?: string;
  title?: string[];
  issued?: { "date-parts"?: Array<Array<number | null>> };
  author?: Array<{ given?: string; family?: string; ORCID?: string }>;
};

async function getJson(url: string, accept = "application/json"): Promise<unknown> {
  const res = await fetch(url, { headers: { accept, "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** The works on the ORCID record that carry a DOI, one per DOI. */
async function readOrcid(): Promise<SourceWork[]> {
  const body = (await getJson(`https://pub.orcid.org/v3.0/${ORCID_ID}/works`)) as {
    group?: Array<{
      "external-ids"?: { "external-id"?: Array<{ "external-id-type"?: string; "external-id-value"?: string }> };
      "work-summary"?: Array<{
        title?: { title?: { value?: string } };
        "publication-date"?: { year?: { value?: string } } | null;
      }>;
    }>;
  };
  if (!Array.isArray(body.group)) throw new Error("the response carried no group list");
  const out: SourceWork[] = [];
  for (const group of body.group) {
    const summary = group["work-summary"]?.[0];
    const year = Number(summary?.["publication-date"]?.year?.value);
    for (const id of group["external-ids"]?.["external-id"] ?? []) {
      if (id["external-id-type"] !== "doi" || !id["external-id-value"]) continue;
      out.push({
        doi: id["external-id-value"].trim(),
        title: summary?.title?.title?.value ?? "",
        year: Number.isFinite(year) && year > 0 ? year : null,
        sources: ["orcid"],
      });
    }
  }
  return out;
}

function fromCrossref(item: CrossrefItem): SourceWork | null {
  if (!item.DOI) return null;
  const year = item.issued?.["date-parts"]?.[0]?.[0];
  return { doi: item.DOI, title: item.title?.[0] ?? "", year: typeof year === "number" ? year : null, sources: ["crossref"] };
}

async function readCrossref(params: Record<string, string>): Promise<CrossrefItem[]> {
  const url = new URL("https://api.crossref.org/works");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("rows", "200");
  url.searchParams.set("select", "DOI,title,issued,author");
  const body = (await getJson(url.href)) as { message?: { items?: CrossrefItem[] } };
  if (!Array.isArray(body.message?.items)) throw new Error("the response carried no item list");
  return body.message.items;
}

const isOwner = (author: { given?: string; family?: string }) =>
  canonicalAuthor(`${author.given ?? ""} ${author.family ?? ""}`) === SITE.name;

/** Reads every source, keeps what each one failed on, and compares the answers with the publication rows. */
export async function checkPublicationSources(env: Env, now = Date.now()): Promise<PublicationCheck> {
  const failures: SourceFailure[] = [];
  const attempt = async <T>(source: SourceFailure["source"], read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read();
    } catch (error) {
      failures.push({ source, detail: errorMessage(error) });
      return null;
    }
  };
  const since = new Date(now - NAME_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [orcid, crossref, byName, rows] = await Promise.all([
    attempt("orcid", readOrcid),
    attempt("crossref", () => readCrossref({ filter: `orcid:${ORCID_ID}` })),
    attempt("crossref-name", () => readCrossref({ "query.author": SITE.name, filter: `from-created-date:${since}` })),
    listPublicationIdentities(env),
  ]);

  const known = new Set<string>();
  const published: Array<{ slug: string; doi: string }> = [];
  const manuscripts: PublicationCheck["manuscripts"] = [];
  for (const row of rows) {
    const record = JSON.parse(row.record) as { doi?: string | null; preprintDoi?: string | null };
    if (record.doi) {
      known.add(doiKey(record.doi));
      published.push({ slug: row.slug, doi: record.doi });
    } else {
      manuscripts.push({ slug: row.slug, title: row.title });
    }
    if (record.preprintDoi) known.add(doiKey(record.preprintDoi));
  }

  const tied = new Map<string, SourceWork>();
  for (const work of [...(orcid ?? []), ...(crossref ?? []).flatMap((i) => fromCrossref(i) ?? [])]) {
    const key = doiKey(work.doi);
    const seen = tied.get(key);
    if (!seen) tied.set(key, { ...work });
    else for (const source of work.sources) if (!seen.sources.includes(source)) seen.sources.push(source);
  }

  const nameMatches = new Map<string, SourceWork>();
  for (const item of byName ?? []) {
    const work = fromCrossref(item);
    if (!work || !(item.author ?? []).some(isOwner)) continue;
    const key = doiKey(work.doi);
    if (!known.has(key) && !tied.has(key)) nameMatches.set(key, work);
  }

  const onOrcid = new Set((orcid ?? []).map((w) => doiKey(w.doi)));
  return {
    orcid: OWNER_ORCID,
    notOnSite: [...tied.entries()].filter(([key]) => !known.has(key)).map(([, work]) => work),
    nameMatches: [...nameMatches.values()],
    // Unknowable when ORCID could not be read, so empty rather than every paper.
    notOnOrcid: orcid ? published.filter((p) => !onOrcid.has(doiKey(p.doi))) : [],
    manuscripts,
    failures,
  };
}
