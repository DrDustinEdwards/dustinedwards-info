/* The two ways a node test stands in for the network: swapping the global fetch, and a real
 * local server for code that takes a base URL. Both restore in `finally`, so a failing
 * assertion cannot leave the global patched or a port listening. */

import { createServer } from "node:http";

/**
 * Runs `run` with `globalThis.fetch` replaced by `impl`.
 *
 * @template T
 * @param {(url: any, init?: any) => Promise<Response>} impl
 * @param {() => Promise<T>} run
 * @returns {Promise<T>}
 */
export async function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = /** @type {typeof fetch} */ (impl);
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

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
