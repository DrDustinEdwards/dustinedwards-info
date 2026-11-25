/** Running one gate as a child process and reading its result; check:all and check:changed both spawn gates through here. */

import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WINDOWS_CRASH_CODES } from "./windows-crash-codes.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Exported so `check:changed` spawns a gate exactly as this does: the shell behavior is
 * Windows-specific and measured, and a second copy would be a second thing to get wrong.
 * @param {string} name @param {string[]} args
 */
export function runGate(name, args) {
  const started = Date.now();
  const result = spawnSync(gateCommand(name, args), {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return gateResult(name, started, result);
}

/** @param {string} name @param {string[]} args */
const gateCommand = (name, args) => `npm run ${name}${args.length ? ` -- ${args.join(" ")}` : ""}`;

/** @type {Set<import("node:child_process").ChildProcess>} */
export const running = new Set();

/**
 * runGate without blocking, so several gates run at once. The same command, shell and result.
 * @param {string} name @param {string[]} args @returns {Promise<ReturnType<typeof runGate>>}
 */
export function runGateAsync(name, args) {
  const started = Date.now();
  return new Promise((resolve) => {
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    /** @type {Error | undefined} */
    let error;
    const child = spawn(gateCommand(name, args), {
      cwd: root,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    running.add(child);
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (e) => (error = e));
    child.on("close", (status, signal) => {
      running.delete(child);
      resolve(
        gateResult(name, started, {
          stdout: Buffer.concat(out).toString("utf8"),
          stderr: Buffer.concat(err).toString("utf8"),
          status,
          signal,
          error,
        }),
      );
    });
  });
}

/**
 * @param {string} name @param {number} started
 * @param {{ stdout?: string | null, stderr?: string | null, status: number | null, signal?: NodeJS.Signals | null, error?: Error }} result
 */
function gateResult(name, started, result) {
  /* A gate that could not run is not a gate that failed. Both streams empty is the test, because every
     gate here prints on a pass. */
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const errored = stdout.length === 0 && stderr.length === 0;

  const seen = [
    `status ${result.status === null ? "null" : result.status}`,
    result.signal ? `signal ${result.signal}` : null,
    result.error ? `spawn error: ${result.error.message}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name,
    ok: !errored && result.status === 0,
    errored,
    status: typeof result.status === "number" ? result.status : null,
    reason: errored
      ? `wrote nothing to either stream (${seen})`
      : result.status !== 0 || result.error
        ? seen
        : "",
    ms: Date.now() - started,
    output: `${stdout}${stderr}`,
    /*
     * Null means not sampled, not zero.
     * @type {number | null}
     */
    peakRss: /** @type {number | null} */ (null),
  };
}

/*
 * Environment failure needs all four: both streams empty (the condition that keeps a real failure out),
 * an NTSTATUS-range status, under one second, and more than one gate with that status.
 */
const NTSTATUS_FAILURE_FLOOR = 0xc0000000;
const ENVIRONMENT_MAX_MS = 1000;

/** @param {number} status */
export function ntstatusName(status) {
  // The one table of crash codes, so a crash is never named as a red gate.
  const name = WINDOWS_CRASH_CODES.get(status);
  return `0x${status.toString(16).toUpperCase()}${name ? ` ${name}` : ""}`;
}

/**
 * @param {Array<{name: string, errored: boolean, status: number | null, ms: number}>} results
 * @returns {{status: number, names: string[]} | null}
 */
export function classifyEnvironmentFailure(results) {
  const candidates = results.filter(
    (r) =>
      r.errored === true &&
      typeof r.status === "number" &&
      r.status >= NTSTATUS_FAILURE_FLOOR &&
      typeof r.ms === "number" &&
      r.ms < ENVIRONMENT_MAX_MS,
  );

  /** @type {Map<number, string[]>} */
  const byStatus = new Map();
  for (const r of candidates) {
    const status = /** @type {number} */ (r.status);
    if (!byStatus.has(status)) byStatus.set(status, []);
    /** @type {string[]} */ (byStatus.get(status)).push(r.name);
  }

  /** @type {{status: number, names: string[]} | null} */
  let group = null;
  for (const [status, names] of byStatus) {
    if (names.length < 2) continue;
    if (group === null || names.length > group.names.length) group = { status, names };
  }
  return group;
}
