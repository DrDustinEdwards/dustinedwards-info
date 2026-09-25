// Ship's transcript. Ship runs itself again as a child and tees the child's output to a dated log, so
// a failed run can be read back after the terminal has scrolled past it.

import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Gitignored: an untracked log would make the next ship refuse a dirty tree, and the log
 * carries account-scoped ids.
 */
const LOG_DIR = join(root, ".ship-logs");

/** Pruned by age, never by count: ship's write rate varies, so a count is no fixed duration. */
const LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Children run with inherited stdio, so wrapping `console` would miss their output.
 * @param {string} script ship's own path, which the child runs with the same arguments
 * @returns {Promise<number>}
 */
export async function teeSelfToLog(script) {
  mkdirSync(LOG_DIR, { recursive: true });

  const now = Date.now();
  for (const entry of readdirSync(LOG_DIR)) {
    if (!entry.startsWith("ship-") || !entry.endsWith(".log")) continue;
    const full = join(LOG_DIR, entry);
    try {
      if (now - statSync(full).mtimeMs > LOG_MAX_AGE_MS) rmSync(full, { force: true });
    } catch {
      /* a log that vanished under us needs no pruning */
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = join(LOG_DIR, `ship-${stamp}.log`);
  const handle = openSync(logPath, "a");

  const child = spawn(process.execPath, [script, ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, SHIP_TRANSCRIPT: logPath, SHIP_TEE_PARENT: String(process.pid) },
    stdio: ["inherit", "pipe", "pipe"],
  });

  /** @param {import("node:stream").Readable} source @param {NodeJS.WriteStream} sink */
  const forward = (source, sink) => {
    source.on("data", (chunk) => {
      sink.write(chunk);
      writeSync(handle, chunk);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  for (const signal of /** @type {NodeJS.Signals[]} */ (["SIGINT", "SIGTERM"])) {
    process.on(signal, () => {
      try {
        child.kill(signal);
      } catch {
        /* already gone */
      }
    });
  }

  /*
   * On close, not exit: stdio can still be open at exit, and the tail is the MISSED/REFUSED summary.
   * Bounded after exit, because a leftover descendant that inherited the pipe (a workerd, a wrangler
   * child) holds it open and close never fires; the ship itself has finished and its code is known.
   */
  const CLOSE_GRACE_MS = 15_000;
  const code = await new Promise((resolve) => {
    /** @type {NodeJS.Timeout | undefined} */
    let grace;
    child.on("exit", (status) => {
      grace = setTimeout(() => {
        const line =
          `\n  ship exited ${status ?? "on a signal"}, but a process it started still holds its output ` +
          `open after ${CLOSE_GRACE_MS / 1000}s, so the transcript may be missing that process's last lines.\n`;
        process.stderr.write(line);
        writeSync(handle, line);
        resolve(status ?? 1);
      }, CLOSE_GRACE_MS);
    });
    child.on("close", (status) => {
      clearTimeout(grace);
      resolve(status ?? 1);
    });
    child.on("error", (error) => {
      const line = `\n  ship could not start its logged child: ${error.message}\n`;
      process.stderr.write(line);
      writeSync(handle, line);
      resolve(1);
    });
  });

  /* Printed last and only on failure, where a reader scrolling back finds it first. */
  if (code !== 0) {
    const line = `\n  transcript: ${logPath}\n`;
    process.stderr.write(line);
    writeSync(handle, line);
  }
  closeSync(handle);
  return code;
}
