/**
 * What a delete from the editor left behind, carried to /admin/posts on the redirect, because the
 * editor page no longer exists to say it. Fixed codes, never free text in a URL.
 */
export const DELETE_LEFT_PARAM = "left";

/** @type {Record<string, string>} */
const SENTENCES = {
  ask: "Its Ask records were not removed, so Ask can still quote it. Run Sync Ask corpus to prune them.",
  purge: "The cache purge failed, so public pages may still show it until their cache expires.",
};

/**
 * @param {URLSearchParams} params
 * @returns {{ slug: string, problems: string[] } | null}
 */
export function deleteLeftBehind(params) {
  const slug = params.get("deleted");
  const problems = params
    .getAll(DELETE_LEFT_PARAM)
    .map((code) => SENTENCES[code])
    .filter((sentence) => typeof sentence === "string");
  return slug && problems.length > 0 ? { slug, problems } : null;
}
