// Relative, so test/footer.test.mjs can import this file under plain node.
import { GERMOMICS_X_URL, OWNER_ORCID, OWNER_PUBMED, OWNER_SCHOLAR } from "./seo.ts";

/*
 * The footer's links, in the columns of the 2026-09-27 first pass (job_bdad16b2c719). Data, not markup,
 * so test/footer.test.mjs can hold every internal href against the routes app/routes.ts declares:
 * a footer link that 404s is the failure this file exists to rule out.
 */

export type FooterLink = {
  to: string;
  label: string;
  /** Another site: rendered as a plain anchor, and checked by nothing here. */
  external?: boolean;
  /** Only the owner's own profiles: check:machine-readable holds this set equal to OWNER_PROFILES. */
  me?: boolean;
};

/** A label followed by short links on one line: Citations BibTeX RIS. */
export type FooterPair = { label: string; links: FooterLink[] };

export type FooterItem = FooterLink | FooterPair;

export type FooterColumn = { id: string; heading: string; items: FooterItem[] };

export const isPair = (item: FooterItem): item is FooterPair => "links" in item;

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    id: "research",
    heading: "Research",
    items: [
      { to: "/research", label: "Research areas" },
      { to: "/research/phages", label: "Phages" },
      { to: "/research/protocols", label: "Protocols" },
      { to: "/research/publications", label: "Publications" },
      {
        label: "Citations",
        links: [
          { to: "/research/publications.bib", label: "BibTeX" },
          { to: "/research/publications.ris", label: "RIS" },
        ],
      },
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
      { to: "/writing", label: "Writing" },
      {
        label: "Feeds",
        links: [
          { to: "/writing/rss.xml", label: "RSS" },
          { to: "/writing/atom.xml", label: "Atom" },
          { to: "/writing/feed.json", label: "JSON" },
        ],
      },
      {
        label: "For machines",
        links: [
          { to: "/llms.txt", label: "llms.txt" },
          { to: "/llms-full.txt", label: "llms-full.txt" },
        ],
      },
    ],
  },
  {
    id: "profiles",
    heading: "Profiles",
    // Plain text: no ORCID logo or iD, no raw address. The only X account the site has is Germomics's,
    // so X carries no rel="me".
    items: [
      { to: OWNER_SCHOLAR, label: "Google Scholar", external: true, me: true },
      { to: OWNER_ORCID, label: "ORCID", external: true, me: true },
      { to: OWNER_PUBMED, label: "PubMed", external: true, me: true },
      { to: GERMOMICS_X_URL, label: "X", external: true },
    ],
  },
  {
    id: "site",
    heading: "Site",
    items: [
      { to: "/about", label: "About" },
      { to: "/projects", label: "Projects" },
      { to: "/playground", label: "Playground" },
      { to: "/search", label: "Search" },
      { to: "/contact", label: "Contact" },
      { to: "/colophon", label: "Colophon" },
      { to: "/privacy", label: "Privacy" },
    ],
  },
];

export type PrivateTool = FooterLink & { icon: "lamp" | "padlock" | "capsid"; name: string };

/**
 * The three logins, set apart from the pages anyone can read. The accessible names say what each one is
 * for, and begin with the visible word so speech input still works. Admin is this site's sign-in page.
 */
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

/** Every href the footer renders, private tools included. */
export function footerHrefs(): FooterLink[] {
  return [
    ...FOOTER_COLUMNS.flatMap((column) => column.items.flatMap((item) => (isPair(item) ? item.links : [item]))),
    ...PRIVATE_TOOLS,
  ];
}
