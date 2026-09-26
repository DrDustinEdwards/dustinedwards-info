/**
 * True on a Cloudflare Worker Preview, where `previews.vars.PREVIEW` is "1". Production carries the
 * top-level "", so a missing or empty value is production. Not the /preview draft route, which is a
 * different thing sharing the word.
 */
export function isWorkerPreview(env: { PREVIEW?: string }): boolean {
  return env.PREVIEW === "1";
}
