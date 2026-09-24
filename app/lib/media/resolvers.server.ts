// Resolvers return structured results, never booleans, so a refusal can name the post and the form.

export type MediaCitation = {
  type: string;
  id: string;
  title: string;
  form: "markdown-image" | "figure-directive" | "frontmatter-cover" | "link" | "html" | "other";
  detail: string;
};

// Batched: each resolver reads one corpus and scans it, so a per-key call would be one read per key.
export type ReferenceResolver = (
  env: Env,
  keys: string[],
) => Promise<Map<string, MediaCitation[]>>;

import { postsResolver } from "./resolvers/posts.server";

// A plain array, not a runtime `register()`, so there is no import-order problem.
const RESOLVERS: Array<{ name: string; resolve: ReferenceResolver }> = [
  { name: "posts", resolve: postsResolver },
];

export type ResolutionResult = {
  citations: Map<string, MediaCitation[]>;
  // False when a resolver threw: a delete must then refuse.
  complete: boolean;
  failed: string[];
};

// Failure is reported, never swallowed: "we could not check" must not render as "nothing cites it".
export async function resolveCitations(
  env: Env,
  keys: string[],
): Promise<ResolutionResult> {
  const citations = new Map<string, MediaCitation[]>(keys.map((key) => [key, []]));
  const failed: string[] = [];

  const answers = await Promise.all(
    RESOLVERS.map(async (resolver) => {
      try {
        return { name: resolver.name, map: await resolver.resolve(env, keys) };
      } catch (error) {
        console.error(`media resolver ${resolver.name} failed`, error);
        failed.push(resolver.name);
        return null;
      }
    }),
  );

  for (const answer of answers) {
    if (!answer) continue;
    for (const [key, found] of answer.map) {
      const list = citations.get(key);
      if (list) list.push(...found);
    }
  }

  return { citations, complete: failed.length === 0, failed };
}
