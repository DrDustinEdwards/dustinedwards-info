// Relative, so test/footer.test.mjs can import this file under plain node.
import { GERMOMICS_URL, GERMOMICS_X_URL, OWNER_ORCID, OWNER_PUBMED, OWNER_SCHOLAR } from "./seo.ts";

/*
 * The footer's links (Dustin, 2026-09-27): five link columns and the Workspace group fill a grid three across
 * and two deep. Data, not markup, so test/footer.test.mjs can hold every internal href against the routes
 * app/routes.ts declares: a footer link that 404s is the failure this file exists to rule out.
 *
 * Nothing here is for machines only. Agents find llms.txt, the feeds and the markdown twins through the
 * page head, robots.txt and the sitemap, the standard way (job_5670dd43eef2).
 */

export type FooterLink = {
  to: string;
  label: string;
  /** Another site: rendered as a plain anchor, and checked by nothing here. */
  external?: boolean;
  /** Only the owner's own profiles: check:machine-readable holds this set equal to OWNER_PROFILES. */
  me?: boolean;
};

export type FooterColumn = { id: string; heading: string; items: FooterLink[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    id: "research",
    heading: "Research",
    items: [
      { to: "/research", label: "Research areas" },
      { to: "/research/phages", label: "Phages" },
      { to: "/research/protocols", label: "Protocols" },
      { to: "/research/publications", label: "Publications" },
    ],
  },
  {
    id: "teaching",
    heading: "Teaching",
    items: [
      { to: "/teaching/phage-discovery", label: "Phage Discovery Program" },
      { to: "/teaching/virus-isolation", label: "Virus Isolation course" },
      { to: "/teaching/phage-bioinformatics", label: "Phage Bioinformatics course" },
      { to: "/teaching/central-dogma", label: "Tutorials" },
    ],
  },
  {
    id: "writing",
    heading: "Writing",
    items: [
      { to: "/writing", label: "All articles" },
      { to: "/writing/rss.xml", label: "RSS feed" },
    ],
  },
  {
    id: "profiles",
    heading: "Profiles",
    // Plain text: no ORCID logo or iD, no raw address.
    items: [
      { to: OWNER_SCHOLAR, label: "Google Scholar", external: true, me: true },
      { to: OWNER_ORCID, label: "ORCID", external: true, me: true },
      { to: OWNER_PUBMED, label: "PubMed", external: true, me: true },
    ],
  },
  {
    id: "site",
    heading: "Site",
    items: [
      { to: "/about", label: "About" },
      { to: "/projects", label: "Projects" },
      { to: "/playground", label: "Playground" },
      { to: "/contact", label: "Contact" },
      { to: "/colophon", label: "Colophon" },
      { to: "/privacy", label: "Privacy" },
    ],
  },
];

/**
 * Social media, in the brand block (Dustin, 2026-09-27): the Germomics podcast and its X account, the only
 * X account the site has, so neither carries rel="me". `label` is the link's accessible name and appears
 * beside the mark on hover and keyboard focus.
 */
export const SOCIAL_LINKS: (FooterLink & { mark: "germomics" | "x" })[] = [
  { to: GERMOMICS_URL, label: "Germomics podcast", external: true, mark: "germomics" },
  { to: GERMOMICS_X_URL, label: "X", external: true, mark: "x" },
];

export type PrivateTool = FooterLink & { icon: "lamp" | "padlock" | "capsid"; name: string };

/**
 * The three logins, the Workspace group in the grid's sixth slot. The accessible names say what each one is
 * for, and begin with the visible word so speech input still works. Admin is this site's sign-in page.
 */
export const TOOLS_HEADING = "Workspace";
export const PRIVATE_TOOLS: PrivateTool[] = [
  // Behind Cloudflare Access since 2026-09-26.
  { to: "https://carrel.dustinedwards.info", label: "Carrel", name: "Carrel, writing", icon: "lamp", external: true },
  { to: "/login", label: "Admin", name: "Admin, this site", icon: "padlock" },
  // Capsid's admin page, per its docs/console.md; GitHub login, one admin.
  {
    to: "https://capsid.dustin-edwards.workers.dev/console",
    label: "Console",
    name: "Console, Capsid",
    icon: "capsid",
    external: true,
  },
];

/** Every href the footer renders, social links and tools included. */
export function footerHrefs(): FooterLink[] {
  return [...FOOTER_COLUMNS.flatMap((column) => column.items), ...SOCIAL_LINKS, ...PRIVATE_TOOLS];
}
