/**
 * The playground's input caps, read by each demo's loader and stated by its form. One owner, so the
 * cap a loader enforces and the cap a form states cannot drift apart.
 */

export const QUERY_CAP = 100;

/** Cut at this length and said so in the UI: an unstated cap is a silent truncation. */
export const KEY_CAP = 120;

/** Printable ASCII only, refused rather than cut: a control character in a header value makes `new Request` throw. */
export const COOKIE_CAP = 200;
