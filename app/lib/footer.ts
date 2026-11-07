// Relative, so test/footer.test.mjs can import this file under plain node.
import {
  familyLinks,
  legalLinks as familyLegalLinks,
  siteLinks as familySiteLinks,
} from "capsomer/behavior/family-footer";
import { PUBLISHED_PAGES } from "./published-pages.generated.mjs";

/*
 * The footer's links are Capsomer's (capsomer/family-footer), shared with Capsid's and Capsomer's sites.
 * This file gives them to test/footer.test.mjs as this site renders them, so a footer link that 404s here
 * still fails a test.
 */

export { SOCIAL_LINKS } from "capsomer/behavior/family-footer";

/** The Site group: Contact, Site map, Features, Colophon. */
export const siteLinks = (published: readonly string[] = PUBLISHED_PAGES) =>
  familySiteLinks(published);

/** The Legal group: Privacy and Terms, plus Accessibility only while its page is published. */
export const legalLinks = (published: readonly string[] = PUBLISHED_PAGES) =>
  familyLegalLinks(published);

export const LEGAL_LINKS = legalLinks();

/** Every href the footer renders, in page order: social links, profiles and feed, Workspace, Site, Legal. */
export const footerHrefs = () => familyLinks(PUBLISHED_PAGES);
