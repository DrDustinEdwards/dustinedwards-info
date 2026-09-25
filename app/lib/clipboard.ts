/**
 * Copies text to the clipboard. Wrapped in a promise because with no clipboard (an insecure
 * context) the call throws before any promise exists, and every caller wants one failure path.
 * Client-safe and dependency-free: the enhancement bundles import it.
 */
export function copyText(text: string): Promise<void> {
  return Promise.resolve().then(() => navigator.clipboard.writeText(text));
}
