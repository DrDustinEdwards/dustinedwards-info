import { SITE_ORIGIN } from "~/lib/seo";

/**
 * WHERE THIS SITE SAYS ITS WEBMENTION ENDPOINT IS. Item H2.
 *
 * ## TWO READERS, ONE ADDRESS
 *
 * A post advertises the endpoint twice, because senders look in two places: a
 * `Link` header, which a sender can read from a HEAD request without parsing
 * anything, and a `<link rel="webmention">` in the head, which is what a sender
 * that already has the document reads. Both are the protocol's own discovery
 * order and neither is optional if the other exists, since a sender that finds
 * one and not the other concludes the site changed its mind.
 *
 * They are one constant here for the ordinary reason: two spellings of an
 * address is an address that goes half-stale. The `Link` header and the meta
 * tag on `/blog/:slug` both read this.
 *
 * ## `SITE_ORIGIN`, AND THAT IS THE TWIN'S CHOICE RATHER THAN A NEW ONE
 *
 * `linkToMarkdown` in `app/lib/markdown-twin.ts` builds the other `Link` value
 * on this route from `SITE_ORIGIN`, so the two values in one header now name
 * the same host by construction. Deriving this one from the REQUEST's origin
 * instead would put two different hosts in one header during the cutover, which
 * is the window where a sender is most likely to be reading it for the first
 * time.
 *
 * The endpoint's own `siteOrigins` accepts both spellings on the way IN, which
 * is the asymmetry that makes this safe: this site advertises one address and
 * answers to two.
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
