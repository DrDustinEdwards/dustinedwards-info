import { parseHTML } from "linkedom";

import { recordWebmentionVerdict, type WebmentionVerdict } from "~/db";
import { readCapped } from "~/lib/read-capped.mjs";
import { collapseExcerpt, sameDocument } from "~/lib/webmention/urls.mjs";

// linkedom's document, not the DOM's.
type ParsedDocument = ReturnType<typeof parseHTML>["document"];

// The row is written `unverified` and moves to `pending` only if an anchor on the source resolves to the
// target. Runs in `waitUntil`, not a queue: a run cut short leaves the row `unverified`, visible and still
// counted by the cap. Nothing from the source is stored as markup.

const MAX_SOURCE_BYTES = 1024 * 1024;

const SOURCE_TIMEOUT_MS = 5000;

// A fixed set, not a message: free text would put a remote server's prose into the admin plane.
export const FAILURE_REASONS = {
  fetchError: "fetch-error",
  timeout: "timeout",
  tooLarge: "too-large",
  notHtml: "not-html",
  noLink: "no-link",
} as const;

// No h-card: the name is the source's hostname, a fact rather than a guess. `u-url` is kept only if it
// resolves to absolute http(s).
function readAuthor(
  document: ParsedDocument,
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

// Pure of the database, so a test can drive the decision over a stubbed fetch.
export async function inspectSource(
  sourceUrl: string,
  targetUrl: string,
): Promise<WebmentionVerdict> {
  // One signal, read at both sites: a timeout during the body read makes the read throw, which would
  // otherwise be misreported as a fetch error.
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

  // Checked before the body is read, so a video costs nothing to refuse. An absent content-type is not HTML.
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return { status: "failed", failureReason: FAILURE_REASONS.notHtml };
  }

  let body: string | null;
  try {
    body = await readCapped(response, MAX_SOURCE_BYTES);
  } catch {
    return {
      status: "failed",
      failureReason: signal.aborted ? FAILURE_REASONS.timeout : FAILURE_REASONS.fetchError,
    };
  }
  if (body === null) {
    return { status: "failed", failureReason: FAILURE_REASONS.tooLarge };
  }
  if (signal.aborted) {
    return { status: "failed", failureReason: FAILURE_REASONS.timeout };
  }

  const { document } = parseHTML(body);

  // Resolved against the source before comparing. The first match wins: a page linking here twice is one mention.
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

  const { authorName, authorUrl } = readAuthor(document, sourceUrl);

  // The containing element's text: the anchor alone is usually the title; the parent is the sentence.
  const container = match.parentElement ?? match;
  const excerpt = collapseExcerpt(container.textContent ?? "");

  return {
    status: "pending",
    authorName,
    authorUrl,
    excerpt: excerpt.length > 0 ? excerpt : null,
  };
}

// NEVER THROWS: a rejection inside `waitUntil` is an unread log line and a row stuck `unverified`.
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
    // The row stays `unverified`, a visible state rather than a fabricated verdict.
    console.error(
      JSON.stringify({
        alert: "webmention-verdict-write-failed",
        id,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
