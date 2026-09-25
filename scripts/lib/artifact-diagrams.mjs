import { requirePosts } from "./delete-floor.mjs";

/**
 * Every diagram the artifact names, deduplicated by key. Throws on an artifact with no posts or a post
 * whose diagrams are not a list: the prune deletes every file this does not name, so a reshaped
 * artifact read as "no diagrams" would delete every committed drawing.
 *
 * @param {unknown} artifact
 * @param {string} from the file it was read from, named in a refusal
 * @returns {Array<{ posts: string[], key: string, source: string }>}
 */
export function diagramsFrom(artifact, from) {
  /** @type {Array<{ posts: string[], key: string, source: string }>} */
  const diagrams = [];
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const post of requirePosts(artifact, from)) {
    if (!Array.isArray(post.diagrams)) {
      throw new Error(`${from}: ${post.slug} has no diagrams list; nothing was pruned`);
    }
    for (const diagram of post.diagrams) {
      if (typeof diagram?.key !== "string" || !diagram.key || typeof diagram.source !== "string") {
        throw new Error(`${from}: ${post.slug} has a diagram with no key or source`);
      }
      const at = seen.get(diagram.key);
      if (at !== undefined) {
        // The same drawing in two posts is one asset, by construction: the key
        // is a hash of the source and nothing else.
        diagrams[at].posts.push(post.slug);
        continue;
      }
      seen.set(diagram.key, diagrams.length);
      diagrams.push({ posts: [post.slug], key: diagram.key, source: diagram.source });
    }
  }
  return diagrams;
}
