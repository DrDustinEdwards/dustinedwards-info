import { SITE_ORIGIN } from "~/lib/seo";

// Advertised in both a `Link` header and `<link rel="webmention">`, since senders look in either.
// `SITE_ORIGIN`, not the request's origin, so both values in one header name one host during the cutover.
export const WEBMENTION_URL = `${SITE_ORIGIN}/webmention`;

export function linkToWebmention() {
  return `<${WEBMENTION_URL}>; rel="webmention"`;
}
