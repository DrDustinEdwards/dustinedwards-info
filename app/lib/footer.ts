// Relative, so test/footer.test.mjs can import this file under plain node.
import { PUBLISHED_PAGES } from "./published-pages.generated.mjs";
import { GERMOMICS_URL, GERMOMICS_X_URL, OWNER_ORCID, OWNER_PUBMED, OWNER_SCHOLAR } from "./seo.ts";

/*
 * The footer's links (Dustin, 2026-10-11): the brand block on the left, then two groups beside it, Workspace
 * and Site, and the copyright line under them. The Research, Teaching, Software and Writing columns are gone:
 * the header menu carries those, and a footer that repeats the header is what the research said to avoid.
 * Data, not markup, so test/footer.test.mjs can hold every internal href against the routes app/routes.ts
 * declares: a footer link that 404s is the failure this file exists to rule out.
 *
 * Nothing here is for machines only. Agents find llms.txt, the feeds and the markdown twins through the
 * page head, robots.txt and the sitemap, the standard way (job_5670dd43eef2). The RSS link is for readers.
 */

export type FooterLink = {
  to: string;
  label: string;
  /** Another site: rendered as a plain anchor, and checked by nothing here. */
  external?: boolean;
  /** Only the owner's own profiles: check:machine-readable holds this set equal to OWNER_PROFILES. */
  me?: boolean;
  /**
   * A prose page (docs/PAGES.md) that can be a draft: listed only while its file is published, as the
   * sitemap lists it only while its row is. A draft's address answers 404 to a reader, so its link waits.
   */
  page?: boolean;
};

/** Plain text under the social marks: Scholar, PubMed, ORCID, then the posts' feed. No logo and no raw address. */
export const BRAND_PROFILES: FooterLink[] = [
  { to: OWNER_SCHOLAR, label: "Google Scholar", external: true, me: true },
  { to: OWNER_PUBMED, label: "PubMed", external: true, me: true },
  { to: OWNER_ORCID, label: "ORCID", external: true, me: true },
  // The feed route (app/routes.ts, routes/blog.rss[.xml].ts). A file, so a plain anchor; not rel="me".
  { to: "/writing/rss.xml", label: "RSS" },
];

export const SITE_HEADING = "Site";

/** The Site group, in Dustin's order (2026-10-11). Accessibility is a prose page, shown once it is published. */
export const SITE_LINKS_ALL: FooterLink[] = [
  { to: "/contact", label: "Contact" },
  { to: "/site-map", label: "Site map" },
  { to: "/colophon", label: "Colophon" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/accessibility", label: "Accessibility", page: true },
];

/**
 * The Site group as rendered: a `page` link only while `published` names its path. The list is a build
 * product of content/pages (scripts/lib/published-pages.mjs), so the footer is the same bytes for every
 * reader and reads nothing per request.
 */
export function siteLinks(published: readonly string[] = PUBLISHED_PAGES): FooterLink[] {
  return SITE_LINKS_ALL.filter((link) => !link.page || published.includes(link.to));
}

export const SITE_LINKS: FooterLink[] = siteLinks();

/**
 * Social media, in the brand block (Dustin, 2026-09-27): the Germomics podcast and its X account, the only
 * X account the site has, so neither carries rel="me". `label` is the link's accessible name and appears
 * beside the mark on hover and keyboard focus.
 */
export const SOCIAL_LINKS: (FooterLink & { mark: "germomics" | "x" })[] = [
  { to: GERMOMICS_URL, label: "Germomics podcast", external: true, mark: "germomics" },
  { to: GERMOMICS_X_URL, label: "X", external: true, mark: "x" },
];

export type PrivateTool = FooterLink & { icon: "lamp" | "gear" | "capsid"; name: string; hover?: string };

/**
 * The three logins, the Workspace group, in Dustin's order (2026-10-11): Admin, Portal, Carrel. Every reader
 * sees all three; each one's own sign-in is what keeps it private. The accessible names say what each one is
 * for, begin with the visible word so speech input still works, and end with SIGN_IN_NOTE so a link read
 * out of context still says it needs a sign-in (Dustin, 2026-09-28). Admin is this site's admin, behind Cloudflare Access.
 */
export const TOOLS_HEADING = "Workspace";
export const SIGN_IN_NOTE = "(requires sign-in)";
export const PRIVATE_TOOLS: PrivateTool[] = [
  { to: "/admin", label: "Admin", name: `Admin, this site ${SIGN_IN_NOTE}`, icon: "gear" },
  // Capsid's admin page, behind Cloudflare Access. It has its own address (portal.dustinedwards.info) since
  // 2026-10-01; the old capsid.dustin-edwards.workers.dev/portal/ answers 404.
  {
    to: "https://portal.dustinedwards.info",
    label: "Portal",
    // Dustin, 2026-09-28: the hover label reads "Capsid Portal"; the accessible name adds the sign-in note.
    name: `Capsid Portal ${SIGN_IN_NOTE}`,
    hover: "Capsid Portal",
    icon: "capsid",
    external: true,
  },
  // Behind Cloudflare Access since 2026-09-26.
  { to: "https://carrel.dustinedwards.info", label: "Carrel", name: `Carrel, writing ${SIGN_IN_NOTE}`, icon: "lamp", external: true },
];

/** Every href the footer renders, in page order: social links, profiles and feed, Workspace, Site. */
export function footerHrefs(): FooterLink[] {
  return [
    ...SOCIAL_LINKS,
    ...BRAND_PROFILES,
    ...PRIVATE_TOOLS,
    ...SITE_LINKS,
  ];
}
