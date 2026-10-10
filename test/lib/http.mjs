/* A real local server for node tests of code that takes a base URL. It closes in `finally`, so a
 * failing assertion cannot leave a port listening. Swapping the global fetch is
 * `installFetch` in `@dustinedwards/devkit/network`. */

import { createServer } from "node:http";

/**
 * Runs `run` against a loopback server answering with `handler`, then closes it.
 *
 * @template T
 * @param {import("node:http").RequestListener} handler
 * @param {(base: string) => Promise<T>} run receives `http://127.0.0.1:<port>`
 * @returns {Promise<T>}
 */
export async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = /** @type {import("node:net").AddressInfo} */ (server.address());
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
}
