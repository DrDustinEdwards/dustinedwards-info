// Its own module so the directive plugins and the renderer throw the one class without importing
// each other. pipeline.mjs re-exports it.

export class ContentError extends Error {
  /**
   * @param {string} file
   * @param {string} message
   */
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
    this.file = file;
  }
}
