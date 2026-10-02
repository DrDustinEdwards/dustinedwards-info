// What the CV's routes share: the cache tags a save purges (app/lib/cv/save.server.ts, purgeCv).

/** The tag the CV page, its charts and its twin carry. Narrower than the "pages" tag every hand-authored page shares. */
export const CV_CACHE_TAG = "cv";

/** The HTML keeps its long-standing "pages" tag beside the new one, so nothing that purges "pages" stops reaching it. */
export const CV_HTML_TAGS = `pages,${CV_CACHE_TAG}`;
