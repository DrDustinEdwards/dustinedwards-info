import { RENDER_VERSION } from "@drdustinedwards/site-helpers/render/nomath";

/**
 * The attribute every wrapper of Prelum-rendered writing carries, so a reader of the page (Prelum's prelum-content
 * check, area 4) can see which pipeline release made it and spot a page an upgrade has not reached. The stored HTML is
 * this release's: every deploy renders the corpus again and sync-content fails on render drift between the Worker and
 * the build, and Carrel saves render in this Worker.
 */
export const RENDERED = { "data-render-version": RENDER_VERSION } as const;
