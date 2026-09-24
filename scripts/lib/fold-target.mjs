/**
 * THE FOLD TARGET: Dustin's screen, as a page lays out on it. Any check that asks "is this above the
 * fold" measures at this viewport and imports it rather than restating it.
 *
 * His monitor is 1920x1080 at Windows 150% scaling with a bookmarks bar, so the page gets a 1280x593
 * CSS viewport at device pixel ratio 1.5. PR #84 measured "1920x890" as CSS pixels and reported the
 * key row above the fold when it was not visible on his screen at all (job_b001eb9809fb).
 */
export const FOLD_VIEWPORT = Object.freeze({ width: 1280, height: 593, deviceScaleFactor: 1.5 });
