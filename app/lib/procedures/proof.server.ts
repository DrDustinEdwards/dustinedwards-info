import { listPhages } from "~/db/phages";
import { listPublishedPublications } from "~/db/publications";
import { phageSlug } from "~/lib/phages/compile.mjs";

import { resolveProof } from "./proof.mjs";
import type { ProcedureRecord } from "./render.mjs";

/**
 * A protocol's proof of use with its words and addresses: the file holds slugs, and the papers' titles and the phages'
 * names are read from their rows, so a corrected title reaches every protocol that names the paper. Only the tables a
 * protocol actually names are read.
 */
export async function proofFor(env: Env, stored: ProcedureRecord["proofOfUse"]) {
  if (!stored) return null;
  const papers = stored.papers.length > 0 ? await listPublishedPublications(env) : [];
  const phages = stored.phages.length > 0 ? await listPhages(env) : [];
  return resolveProof(stored, {
    papers: new Map(papers.map((p) => [p.slug, { title: p.title, year: p.year }])),
    phages: new Map(phages.map((p) => [phageSlug(p.name), p.name])),
  });
}
