// The daily publication check (the site Worker's check-publications cron job, 06:00 UTC; until 2026-11-06 the
// watchdog Worker's): ORCID and Crossref are read (sources.server.ts) and each DOI they list that no publication
// file carries is mailed to ALERT_EMAIL once, so a paper waiting to be added through Carrel is not mailed daily.

import { checkPublicationSources, type PublicationCheck } from "./sources.server";
import { sendEmail } from "@dustinedwards/site-runtime/email";

/** The DOIs already mailed about. */
export const PUBLICATIONS_MAILED_KEY = "publications:mailed";

// On the site's own domain: Email Routing sends a Worker's mail only from a zone it is on.
const FROM = { email: "alerts@dustinedwards.info", name: "dustinedwards.info" };

type FoundWork = PublicationCheck["notOnSite"][number];

const line = (w: FoundWork) =>
  `${w.title || "(no title)"}${w.year ? ` (${w.year})` : ""}: https://doi.org/${w.doi}`;

/**
 * Throws on every failure, so runJobs records the job failed and /health's cron check names it: a source that did
 * not answer, the mail not sending (nothing is recorded, so tomorrow tries again), or the record not written.
 */
export async function checkPublicationsDaily(
  env: Env,
  check = checkPublicationSources,
): Promise<{ mailed: number }> {
  const report = await check(env);
  if (report.failures.length > 0) {
    throw new Error(
      `not every source could be read: ${report.failures.map((f) => `${f.source} (${f.detail})`).join(", ")}`,
    );
  }
  // Unreadable is not empty: mailing every DOI again would bury the one that is new.
  const mailed = new Set(
    ((await env.APP_KV.get(PUBLICATIONS_MAILED_KEY, "json")) as string[] | null) ?? [],
  );
  const fresh = (works: FoundWork[]) => works.filter((w) => !mailed.has(w.doi.toLowerCase()));
  const tied = fresh(report.notOnSite);
  const byName = fresh(report.nameMatches);
  if (tied.length + byName.length === 0) return { mailed: 0 };

  if (!env.ALERT_EMAIL)
    throw new Error(
      `${tied.length + byName.length} new DOI(s) found and not mailed: the ALERT_EMAIL secret is not set`,
    );
  const text = [
    ...(tied.length > 0
      ? [
          "ORCID or Crossref lists these under your ORCID, and the site does not:",
          ...tied.map(line),
        ]
      : []),
    ...(tied.length > 0 && byName.length > 0 ? [""] : []),
    ...(byName.length > 0
      ? [
          "Crossref lists these under your name, without your ORCID. Check they are yours:",
          ...byName.map(line),
        ]
      : []),
    "",
    "Add a paper through Carrel. Each DOI is mailed once.",
  ].join("\n");
  // site-runtime's one mail send, which never throws and keeps the address out of its error.
  const sent = await sendEmail(env.EMAIL, {
    from: FROM,
    to: env.ALERT_EMAIL,
    subject: "New publication found for dustinedwards.info",
    text,
  });
  if (!sent.sent)
    throw new Error(
      `new DOIs were found and the mail did not send, so tomorrow tries again: ${sent.error}`,
    );
  for (const w of [...tied, ...byName]) mailed.add(w.doi.toLowerCase());
  await env.APP_KV.put(PUBLICATIONS_MAILED_KEY, JSON.stringify([...mailed]));
  return { mailed: tied.length + byName.length };
}
