// Status edits on a content file's front matter, by line, for every kind Carrel writes. Shared by the
// kind handlers: a status change must leave every other key byte for byte.

import { RefusedError } from "@dustinedwards/site-api";

/**
 * Sets `draft` and `publish_at` by line, leaving every other key byte for byte: serializePost writes
 * only the fields the editor knows, and a status change must not drop the others. The values are
 * written as serializePost writes them.
 */
export function withPublication(raw: string, change: { draft: boolean; publishAt?: string | null }) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) throw new RefusedError("The source has no frontmatter block, so its status cannot be set.");
  let lines = match[1]!.split(/\r?\n/);

  const set = (key: string, value: string | null) => {
    const at = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (value === null) {
      if (at !== -1) lines = lines.filter((_, i) => i !== at);
    } else if (at !== -1) {
      lines[at] = `${key}: ${value}`;
    } else {
      lines.push(`${key}: ${value}`);
    }
  };

  set("draft", change.draft ? "true" : "false");
  if (change.publishAt !== undefined) {
    set("publish_at", change.publishAt === null ? null : JSON.stringify(change.publishAt));
  }
  return `---\n${lines.join("\n")}\n---${raw.slice(match[0].length)}`;
}
