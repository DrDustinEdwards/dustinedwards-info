/**
 * Reads only: a retried write may land twice. Wraps a timeout as well as a rejection because
 * Cloudflare transients show up as both a fast death and a hang.
 */

import { spawnSync } from "node:child_process";

import { descendantPids, killTree, readProcessTable } from "./child-processes.mjs";

/** Generous: the R2 hang ran past ten minutes, and a slow read is not a hang. */
const DEFAULT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_500;

/**
 * @template T
 * @param {() => T | Promise<T>} fn
 * @param {{ label: string, timeoutMs?: number }} options
 * @returns {Promise<T>}
 */
export async function retryRead(fn, { label, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const attempt = () =>
    new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`timed out after ${timeoutMs}ms (the hang symptom)`));
      }, timeoutMs);
      Promise.resolve()
        .then(fn)
        .then(
          (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
          },
        );
    });

  try {
    return /** @type {T} */ (await attempt());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `  transient read failed, retrying once: ${label}\n` +
        `    first error: ${message.split("\n")[0].slice(0, 200)}`,
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return /** @type {T} */ (await attempt());
  }
}

/**
 * retryRead's timer cannot fire around `spawnSync`: the blocking call holds the event loop, so a
 * hung wrangler hung the caller forever. The bound goes on the spawn itself. A timeout or a spawn
 * error comes back as `status: null` with `error` set, never as a clean exit, and a timed-out
 * shell's orphaned descendants (the real wrangler, under `shell: true`) are killed by parentage.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import("node:child_process").SpawnSyncOptions & { timeoutMs?: number }} [options]
 * @returns {{ stdout: string, stderr: string, status: number | null, signal: string | null, error: string }}
 */
export function spawnSyncBounded(command, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  const code = /** @type {NodeJS.ErrnoException | undefined} */ (result.error)?.code;
  const timedOut = code === "ETIMEDOUT";
  let error = "";
  if (timedOut) {
    error = `${command} timed out after ${timeoutMs}ms (the hang symptom)`;
    if (Number.isInteger(result.pid) && result.pid > 0) {
      const table = readProcessTable();
      // A dead shell's direct child must be running the program it was asked to run.
      const program = options.shell ? (command.trim().split(/\s+/)[0] ?? command) : undefined;
      const orphans = table.size === 0 ? [] : descendantPids(result.pid, table, program);
      for (const pid of orphans) killTree(pid);
      error +=
        table.size === 0
          ? "; the process table could not be read, so its children may still be running"
          : `; ${orphans.length} descendant process(es) killed`;
    }
  } else if (result.error) {
    error = `${command} could not run: ${result.error.message}`;
  }
  return {
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    status: result.error ? null : result.status,
    signal: result.signal ?? null,
    error,
  };
}
