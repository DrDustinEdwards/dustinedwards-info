// The site's own address, in a plain module so the Worker, the prerender and the Node scripts read one value.
// Never derive absolute URLs from `request.url`: prerendering runs in Node with no request.
export const SITE_ORIGIN = "https://dustinedwards.info";

/** What the site calls itself when it fetches another service (Crossref, DataCite, feeds). */
export const SITE_USER_AGENT = `dustinedwards.info (+${SITE_ORIGIN})`;
