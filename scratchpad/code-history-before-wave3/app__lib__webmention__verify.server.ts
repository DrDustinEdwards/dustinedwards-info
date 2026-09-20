import { parseHTML } from "linkedom";

import { recordWebmentionVerdict, type WebmentionVerdict } from "~/db";
import { readCapped } from "~/lib/read-capped.mjs";
import { collapseExcerpt, sameDocument } from "~/lib/webmention/urls.mjs";

/**
 * Does the source page really link to the target?
 *
 * ## THE CLAIM IS THE SENDER'S UNTIL THIS RUNS
 *
 * A webmention POST is an assertion by a stranger that some page of theirs
 * links here. Nothing in the POST is evidence of that: the body is two strings
 * they typed. So the row is written `unverified`, this fetches the page they
 * named, and the row moves to `pending` only if an anchor on it actually
 * resolves to the target. Without that step the endpoint would be a way to
 * publish arbitrary text under an arbitrary URL on someone else's post, which
 * is the whole failure mode webmention verification exists for.
 *
 * ## IT RUNS IN `ctx.waitUntil`, NOT A QUEUE
 *
 * Ruled 2026-09-04. A queue would be new infrastructure for a load of zero, and
 * this repository already has one queue with one consumer. The cost of the
 * choice is stated rather than hidden: a `waitUntil` that is cut short by the
 * runtime leaves the row in `unverified`, where the admin can see it and the
 * global cap still counts it. That is the safe direction. A row stuck in
 * `unverified` renders nothing and expires from nothing, so a systematic
 * failure shows up as a growing open queue rather than as silence.
 *
 * ## EVERY BOUND ON THE OUTBOUND FETCH
 *
 *   protocol       http or https only, and not this origin, not a loopback
 *                  name and not an IP literal. Decided before the row is even
 *                  written, in `sourceVerdict`, which also states what that
 *                  list does and does not buy.
 *   timeout        5 seconds, via `AbortSignal.timeout`. A slow source must not
 *                  hold a `waitUntil` open.
 *   credentials    none. There is nothing to send and nothing to leak.
 *   body           1 MB through `readCapped`, the same counting loop the CSP
 *                  sink uses on incoming bodies, for the same reason: the
 *                  sender's claim about size does not participate.
 *
 * ## NOTHING FROM THE SOURCE IS STORED AS MARKUP
 *
 * The author name, the author URL and the excerpt are read out of a document
 * this site does not control. Every one of them is stored as TEXT: the name and
 * the excerpt come off `textContent`, and the URL is re-parsed and kept only if
 * it is absolute http(s). H2 renders the name and the excerpt as escaped text
 * and the source as a React anchor with a validated href, so there is no path
 * from this function to injected HTML. Ruling 5, restated where the values are
 * produced rather than only where they are rendered.
 */

/** Bytes of source HTML that will be read. Beyond it the mention fails. */
const MAX_SOURCE_BYTES = 1024 * 1024;

/** Milliseconds before the source fetch is abandoned. */
const SOURCE_TIMEOUT_MS = 5000;

/**
 * THE FIXED SET OF FAILURE REASONS. Exported so the admin page and the tests
 * name the same strings.
 *
 * A FIXED SET RATHER THAN A MESSAGE, because the column is shown to the admin
 * and a free-text reason built from an error would put a remote server's prose
 * into this site's own admin plane. These six words are this site's, and every
 * one of them names a different repair: a wrong URL, a slow host, an enormous
 * page, a document that is not HTML, and a page that simply does not link here.
 */
export const FAILURE_REASONS = {
  fetchError: "fetch-error",
  timeout: "timeout",
  tooLarge: "too-large",
  notHtml: "not-html",
  noLink: "no-link",
} as const;

/** What `readCapped` returns when the stream itself errored. */
const UNREADABLE = "(unreadable)";

/**
 * Best-effort author, from an h-card if the page publishes one.
 *
 * ## BEST EFFORT MEANS THE FALLBACK IS NAMED, NOT INVENTED
 *
 * With no h-card the name is the source's HOSTNAME and the URL is null. That is
 * a fact about where the mention came from rather than a guess about who wrote
 * it, and it is the difference between an honest fallback and hard rule 13's
 * substituted value: a fabricated display name would render on the post as if
 * the sender had claimed it.
 *
 * `u-url` is resolved against the source and then kept only if it is absolute
 * http(s). A relative or `javascript:` value becomes null rather than being
 * stored and refused later at render time, on the same principle hard rule 6
 * applies to frontmatter: validate where the value enters, not where it exits.
 */
function readAuthor(
  document: Document,
  sourceUrl: string,
): { authorName: string | null; authorUrl: string | null } {
  const hostname = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return null;
    }
  })();

  const card = document.querySelector(".h-card");
  if (!card) return { authorName: hostname, authorUrl: null };

  const nameNode = card.querySelector(".p-name");
  const name = collapseExcerpt(nameNode?.textContent ?? card.textContent ?? "");

  const urlNode = card.querySelector(".u-url");
  const rawUrl = urlNode?.getAttribute("href") ?? null;
  let authorUrl: string | null = null;
  if (rawUrl) {
    try {
      const resolved = new URL(rawUrl, sourceUrl);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") {
        authorUrl = resolved.href;
      }
    } catch {
      authorUrl = null;
    }
  }

  return { authorName: name.length > 0 ? name : hostname, authorUrl };
}

/**
 * Fetch the source and decide. Pure of the database: the caller records it.
 *
 * Split out so a test can drive the decision over a stubbed fetch without also
 * asserting a row write, which is the same split `runTool` and the route use.
 */
export async function inspectSource(
  sourceUrl: string,
  targetUrl: string,
): Promise<WebmentionVerdict> {
  /*
   * ONE SIGNAL, READ TWICE. `AbortSignal.timeout` fires during the fetch OR
   * during the body read, and the two produce different observable shapes: the
   * first throws out of `fetch`, the second makes `readCapped` return its
   * unreadable sentinel, because that function swallows a stream error by
   * design so a caller never has to distinguish a truncated body from a
   * complete one.
   *
   * So the signal itself is what separates `timeout` from `fetch-error`, at
   * both sites. Reading the sentinel alone would misreport a timed-out read as
   * `no-link`, which is the reason a sender would act on and the wrong one.
   */
  const signal = AbortSignal.timeout(SOURCE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      method: "GET",
      headers: { accept: "text/html, application/xhtml+xml" },
      redirect: "follow",
      signal,
    });
  } catch {
    return {
      status: "failed",
      failureReason: signal.aborted ? FAILURE_REASONS.timeout : FAILURE_REASONS.fetchError,
    };
  }

  if (!response.ok) {
    return { status: "failed", failureReason: FAILURE_REASONS.fetchError };
  }

  /*
   * THE CONTENT TYPE IS CHECKED BEFORE THE BODY IS READ, so a source that
   * announces a video does not cost a megabyte of transfer to refuse. An
   * ABSENT content-type is treated as not-HTML rather than assumed: a server
   * that will not say what it sent is not a server whose bytes this Worker
   * should hand to a parser.
   */
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return { status: "failed", failureReason: FAILURE_REASONS.notHtml };
  }

  const body = await readCapped(response, MAX_SOURCE_BYTES);
  if (body === null) {
    return { status: "failed", failureReason: FAILURE_REASONS.tooLarge };
  }
  if (signal.aborted) {
    return { status: "failed", failureReason: FAILURE_REASONS.timeout };
  }
  if (body === UNREADABLE) {
    return { status: "failed", failureReason: FAILURE_REASONS.fetchError };
  }

  const { document } = parseHTML(body);

  /*
   * EVERY ANCHOR IS RESOLVED AGAINST THE SOURCE before it is compared, because
   * a page linking here almost always does so with an absolute URL and may do
   * so with a relative one; and `sameDocument` compares with and without a
   * trailing slash, because both spell the same post on this site.
   *
   * The FIRST match wins and is also what the excerpt is taken from. A page
   * that links here twice is one mention, and the first link is the one in
   * the prose rather than the one in a footer.
   */
  const anchors = [...document.querySelectorAll("a[href]")];
  const match = anchors.find((a) => {
    const href = a.getAttribute("href");
    if (!href) return false;
    try {
      return sameDocument(new URL(href, sourceUrl).href, targetUrl);
    } catch {
      return false;
    }
  });

  if (!match) {
    return { status: "failed", failureReason: FAILURE_REASONS.noLink };
  }

  const { authorName, authorUrl } = readAuthor(document as unknown as Document, sourceUrl);

  /*
   * THE EXCERPT IS THE CONTAINING ELEMENT'S TEXT, not the whole page and not
   * the anchor's own label. The anchor alone is usually the post's title, which
   * tells a reader nothing they cannot see; the page is unbounded. The parent
   * is the paragraph or list item the link sits in, which is the sentence
   * somebody wrote about the post.
   *
   * `textContent`, so the value is plain text at the moment it is produced. A
   * value that were markup here would be markup in the database and the render
   * would be the only thing standing between it and a reader.
   */
  const container = match.parentElement ?? match;
  const excerpt = collapseExcerpt(container.textContent ?? "");

  return {
    status: "pending",
    authorName,
    authorUrl,
    excerpt: excerpt.length > 0 ? excerpt : null,
  };
}

/**
 * Verify one received mention and write the verdict.
 *
 * NEVER THROWS. It is handed to `ctx.waitUntil`, and an unhandled rejection
 * there is a log line nobody reads plus a row left in `unverified` with no
 * reason on it. Anything unexpected becomes `fetch-error`, which is honest at
 * the granularity the admin can act on and leaves the detail in Workers Logs.
 */
export async function verifyWebmention(
  env: Env,
  id: number,
  sourceUrl: string,
  targetUrl: string,
): Promise<void> {
  let verdict: WebmentionVerdict;
  try {
    verdict = await inspectSource(sourceUrl, targetUrl);
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "webmention-verify-threw",
        id,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    verdict = { status: "failed", failureReason: FAILURE_REASONS.fetchError };
  }

  try {
    await recordWebmentionVerdict(env, id, verdict);
  } catch (error) {
    /*
     * A FAILED WRITE NEVER REVERTS ANYTHING, per hard rule 18's second clause.
     * The row stays `unverified`, which is a visible state rather than a
     * fabricated verdict, and the failure is reported here.
     */
    console.error(
      JSON.stringify({
        alert: "webmention-verdict-write-failed",
        id,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
