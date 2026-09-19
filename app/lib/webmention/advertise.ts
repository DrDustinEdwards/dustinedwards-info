import { SITE_ORIGIN } from "~/lib/seo";

/**
 * WHERE THIS SITE SAYS ITS WEBMENTION ENDPOINT IS.
 *
 * TWO READERS, ONE ADDRESS. A post advertises the endpoint twice, because senders look in two
 * places: a `Link` header, readable from a HEAD request, and a `<link rel="webmention">` in the
 * head. Neither is optional if the other exists, since a sender that finds one and not the other
 * concludes the site changed its mind. One constant here, because two spellings of an address is an
 * address that goes half-stale.
 *
 * `SITE_ORIGIN`, matching `linkToMarkdown`, so the two values in one header name the same host by
 * construction; the REQUEST's origin would put two different hosts in one header during the cutover.
 * The endpoint's own `siteOrigins` accepts both spellings on the way IN, which is the asymmetry
 * that makes this safe: this site advertises one address and answers to two.
 */
export const WEBMENTION_URL = `${SITE_ORIGIN}/webmention`;

/**
 * The `Link` header value. Joined with the markdown twin's by the route.
 *
 * A FUNCTION rather than a second constant, so the two `Link` builders on this
 * route have the same shape and a reader comparing them is comparing two calls
 * rather than a call and a string.
 */
export function linkToWebmention() {
  return `<${WEBMENTION_URL}>; rel="webmention"`;
}
