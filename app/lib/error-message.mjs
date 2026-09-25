/**
 * The message of a thrown value: an Error's own message, anything else as a string. Plain
 * JavaScript with no imports, so the Worker, the build scripts and the browser all share it.
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
