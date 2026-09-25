import { errorMessage } from "~/lib/error-message.mjs";

/**
 * Adds or removes one tag across a selection. An item already in the target state is skipped, so
 * it is not rewritten for nothing, and one item's failure is recorded without stopping the rest.
 * `read` answers null for an item that no longer exists, which fails with `missing`.
 */
export async function applyBulkTag<T>({
  ids,
  wanted,
  adding,
  missing,
  read,
  write,
}: {
  ids: string[];
  wanted: string;
  adding: boolean;
  missing: string;
  read: (id: string) => Promise<{ item: T; tags: string[] } | null>;
  write: (id: string, item: T, tags: string[]) => Promise<void>;
}) {
  const failed: string[] = [];
  let done = 0;
  let skipped = 0;

  for (const id of ids) {
    try {
      const found = await read(id);
      if (!found) {
        failed.push(`${id}: ${missing}`);
        continue;
      }
      if (adding === found.tags.includes(wanted)) {
        skipped += 1;
        continue;
      }
      await write(
        id,
        found.item,
        adding ? [...found.tags, wanted] : found.tags.filter((t) => t !== wanted),
      );
      done += 1;
    } catch (error) {
      failed.push(`${id}: ${errorMessage(error)}`);
    }
  }

  return { done, skipped, failed };
}
