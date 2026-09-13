/**
 * THE SIX DESTINATIONS the Paper, Glass, Light bar carries, in one place.
 *
 * Separate from `~/lib/nav` on purpose, for one build. That list is the OLD
 * header's and is still rendered by `site-header.tsx` on every route Part B has
 * not reached; this one is the new bar's. They differ in membership and in
 * labelling, so merging them now would mean one array with a flag for which
 * header is asking, and that flag is where the two designs start bleeding into
 * each other. `~/lib/nav` is deleted when the old header is.
 *
 * TWO LABELS DELIBERATELY DISAGREE WITH THEIR PATHS:
 *
 *   /blog             is labelled "Writing". There is no /writing route and no
 *                     redirect is being added: nothing has ever been published
 *                     there, so a redirect would create a second URL for one
 *                     page and a canonical tag to keep in step. Label only.
 *   /phage-discovery  is labelled "Roster". The path is the indexed legacy URL
 *                     the Worker takes over at cutover; the label is what the
 *                     page is called.
 *
 * PLAYGROUND IS NOT HERE. It moved to the footer with /privacy and /login: the
 * three links that are not destinations. The old header carried it as a fourth
 * nav link, which is what step 3's 768 measurement was taken against.
 */
export const SHELL_NAV = [
  { to: "/blog", label: "Writing", end: true },
  { to: "/publications", label: "Publications", end: false },
  { to: "/projects", label: "Projects", end: false },
  { to: "/phage-discovery", label: "Roster", end: false },
  { to: "/about", label: "About", end: false },
  { to: "/colophon", label: "Colophon", end: false },
] as const;
