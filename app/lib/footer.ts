// Relative, so test/footer.test.mjs can import this file under plain node.
import { familyLinks, siteLinks as familySiteLinks } from "capsomer/behavior/family-footer";
import { PUBLISHED_PAGES } from "./published-pages.generated.mjs";

/*
 * The footer's links are Capsomer's (capsomer/family-footer), shared with Capsid's and Capsomer's sites.
 * This file gives them to test/footer.test.mjs as this site renders them, so a footer link that 404s here
 * still fails a test.
 */

export { SOCIAL_LINKS } from "capsomer/behavior/family-footer";

/** The Site group: Accessibility only while its page is published. */
export const siteLinks = (published: readonly string[] = PUBLISHED_PAGES) => familySiteLinks(published);

export const SITE_LINKS = siteLinks();

/** Every href the footer renders, in page order: social links, profiles and feed, Workspace, Site. */
export const footerHrefs = () => familyLinks(PUBLISHED_PAGES);
