/**
 * The one message the webmention route sends and the queue consumer reads. The queue name is here so
 * `queue()` routes a batch by it; the binding and its consumer settings are in wrangler.jsonc.
 */

export const WEBMENTION_VERIFY_QUEUE = "dustinedwards-webmention-verify";

export type WebmentionVerifyMessage = { id: number; source: string; target: string };

/** Null for anything else: a message is acked and dropped rather than retried on a shape it will never change. */
export function readVerifyMessage(body: unknown): WebmentionVerifyMessage | null {
  if (typeof body !== "object" || body === null) return null;
  const { id, source, target } = body as Record<string, unknown>;
  if (typeof id !== "number" || !Number.isInteger(id)) return null;
  if (typeof source !== "string" || source.length === 0) return null;
  if (typeof target !== "string" || target.length === 0) return null;
  return { id, source, target };
}
