// What the page route and its twin share: the cache tags a save purges (app/lib/pages/save.server.ts).

/** The tag a content page and its twin carry. Narrower than the "pages" tag every hand-authored page shares. */
export const CONTENT_PAGES_CACHE_TAG = "content-pages";

/** The HTML keeps its long-standing "pages" tag beside the new one, so nothing that purges "pages" stops reaching it. */
export const CONTENT_PAGE_HTML_TAGS = `pages,${CONTENT_PAGES_CACHE_TAG}`;
