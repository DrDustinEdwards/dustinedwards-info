import { PUBLIC_CACHE_CONTROL, SITE_ORIGIN } from "./seo";

/**
 * Every post is reachable as HTML and as its markdown source. The two are the
 * same resource, so they advertise each other with a Link header and the HTML
 * route varies on Accept.
 *
 * Shared by `/blog/:slug` (which negotiates) and `/blog/:slug.md` (which does
 * not), so the content type and the Link relation are defined once.
 */

/** `Link` header pointing from the HTML representation at the markdown one. */
export function linkToMarkdown(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}.md>; rel="alternate"; type="text/markdown"`;
}

/** `Link` header pointing from the markdown representation at the HTML one. */
export function linkToHtml(slug: string) {
  return `<${SITE_ORIGIN}/blog/${slug}>; rel="alternate"; type="text/html"`;
}

/**
 * Parses an Accept header and reports whether the client asked for markdown in
 * preference to HTML.
 *
 * Compares q-values rather than substring-matching, because a browser sends
 * `text/html,application/xhtml+xml,...` and must keep getting HTML, while an
 * agent sending `Accept: text/markdown` must get markdown. A client that lists
 * both with equal weight gets HTML, since that is the older behaviour and the
 * safer default for anything that guessed.
 */
export function prefersMarkdown(request: Request) {
  const accept = request.headers.get("accept");
  if (!accept) return false;

  let markdown = -1;
  let html = -1;

  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().split(";");
    const type = range.trim().toLowerCase();

    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim().toLowerCase() === "q") {
        const parsed = Number.parseFloat(value ?? "");
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }

    if (type === "text/markdown") markdown = Math.max(markdown, q);
    // `*/*` and `text/*` count as asking for HTML: they are what a client sends
    // when it has no opinion, and HTML is the default representation.
    if (type === "text/html" || type === "text/*" || type === "*/*") {
      html = Math.max(html, q);
    }
  }

  return markdown > 0 && markdown > html;
}

/** The markdown representation of a post, with its headers. */
export function markdownResponse(slug: string, body: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": PUBLIC_CACHE_CONTROL,
      link: linkToHtml(slug),
      vary: "Accept",
    },
  });
}
