/**
 * Killing a gate's long-running children, and clearing the ones a kill left behind last time.
 *
 * BOUNDARY: a pid in the registry is a claim that the process WAS ours, and Windows reuses pids,
 * so the live command line is read first and must still match. Nothing here kills on a pid alone,
 * and a listing that cannot be taken leaves every entry untouched.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const isWindows = process.platform === "win32";

/**
 * Command lines are compared in ONE normalized form: the same process is spelled differently by
 * the two things that report it, and a needle must not miss for a reason unrelated to identity.
 *
 * @param {string | null | undefined} command
 * @returns {string}
 */
export function normaliseCommand(command) {
  return String(command ?? "").replace(/\\/g, "/").toLowerCase();
}

/**
 * Every live process, as `pid -> { ppid, command }`, through PowerShell rather than `wmic`, which
 * is absent on newer builds, or `tasklist`, which reports no command line: a source that cannot
 * supply one is not a fallback. An EMPTY MAP means "cannot verify", and the only thing callers do
 * with an unverifiable entry is leave it alone.
 *
 * @returns {Map<number, { ppid: number, command: string }>}
 */
export function readProcessTable() {
  /** @type {Map<number, { ppid: number, command: string }>} */
  const table = new Map();

  if (isWindows) {
    const listed = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine,ExecutablePath | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (listed.status !== 0 || !listed.stdout) return table;
    let rows;
    try {
      rows = JSON.parse(listed.stdout);
    } catch {
      return table;
    }
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      if (!row || typeof row.ProcessId !== "number") continue;
      table.set(row.ProcessId, {
        ppid: typeof row.ParentProcessId === "number" ? row.ParentProcessId : 0,
        // A process with no readable command line still gets an entry, so it can be seen to EXIST, and it
        // can never satisfy a needle.
        command: normaliseCommand(`${row.CommandLine ?? ""} ${row.ExecutablePath ?? ""}`),
      });
    }
    return table;
  }

  const listed = spawnSync("ps", ["-eo", "pid=,ppid=,args="], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (listed.status !== 0 || !listed.stdout) return table;
  for (const line of listed.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    table.set(Number(match[1]), { ppid: Number(match[2]), command: normaliseCommand(match[3]) });
  }
  return table;
}

/**
 * Every descendant pid of `rootPid`, from a table already read. Used at ONE moment: recording the
 * wrapper chain, because when the gate node is killed the wrapper DIES with it and the
 * grandchildren survive, so recording only what `spawn()` returned records the one process
 * guaranteed to be gone.
 *
 * @param {number} rootPid
 * @param {Map<number, { ppid: number, command: string }>} table
 * @returns {number[]}
 */
export function descendantPids(rootPid, table) {
  /** @type {number[]} */
  const found = [];
  let frontier = [rootPid];
  // Bounded by the table size: a cycle in reported parentage, which a reused pid can manufacture,
  // would spin here forever.
  for (let depth = 0; depth < table.size && frontier.length > 0; depth += 1) {
    /** @type {number[]} */
    const next = [];
    for (const [pid, row] of table) {
      if (pid === rootPid || found.includes(pid)) continue;
      if (frontier.includes(row.ppid)) {
        found.push(pid);
        next.push(pid);
      }
    }
    frontier = next;
  }
  return found;
}

/**
 * Whether a pid is live RIGHT NOW rather than when a table was read. Signal 0 checks existence
 * without delivering anything and `EPERM` is a positive answer. This exists because the preflight
 * loop invalidates its own snapshot: killing one tree removes processes further down the list,
 * and entries already gone were reported as FAILED TO KILL.
 *
 * @param {number} pid
 * @returns {boolean}
 */
export function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM";
  }
}

/**
 * The pids LISTENING on a TCP port, asked of the OPERATING SYSTEM, because the registry is
 * written by the process that dies and cannot record what outlives a hard kill. THE MEASURED
 * GOTCHA: the IPv4 flag DOES NOT LIST THE HOLDER, the server binding an IPv6 loopback, so the
 * listing is taken UNFILTERED and the protocol matched here. THREE STATES, NOT TWO: `null` means
 * no listing could be taken and must never collapse into "nobody is listening".
 *
 * @param {number} port
 * @returns {number[] | null} listening pids, or null if no listing could be taken
 */
export function portListeners(port) {
  if (!Number.isInteger(port) || port <= 0) return null;
  /** @type {Set<number>} */
  const pids = new Set();

  if (isWindows) {
    const listed = spawnSync("netstat", ["-ano"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (listed.status !== 0 || !listed.stdout) return null;
    for (const line of listed.stdout.split("\n")) {
      // "  TCP    [::1]:4173    [::]:0    LISTENING    21108"
      const columns = line.trim().split(/\s+/);
      if (columns.length < 5) continue;
      const [protocol, local, , state, pid] = columns;
      if (!/^TCP/i.test(protocol) || state.toUpperCase() !== "LISTENING") continue;
      // Anchored on the LAST colon, so a bracketed IPv6 address cannot be satisfied by one that merely
      // contains the digits.
      if (local.slice(local.lastIndexOf(":") + 1) !== String(port)) continue;
      const parsed = Number(pid);
      if (Number.isInteger(parsed) && parsed > 0) pids.add(parsed);
    }
    return [...pids];
  }

  const listed = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  // lsof exits 1 when it matched nothing, which is an ANSWER. Only a missing binary is unverifiable.
  if (listed.error) return null;
  if (listed.status !== 0 && listed.status !== 1) return null;
  for (const line of String(listed.stdout ?? "").split("\n")) {
    const parsed = Number(line.trim());
    if (Number.isInteger(parsed) && parsed > 0) pids.add(parsed);
  }
  return [...pids];
}

/**
 * Kill a process AND everything under it. The tree flag is load-bearing: the interesting
 * processes are always grandchildren.
 *
 * @param {number} pid
 * @returns {boolean} whether the kill reported success
 */
export function killTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    if (isWindows) {
      return spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" }).status === 0;
    }
    // The POSIX equivalent needs the child to have been spawned into its own
    // process group, which is what a negative pid addresses.
    process.kill(-pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

/**
 * The on-disk record of what this gate started, one JSON object per line appended at each spawn,
 * so a gate killed between two spawns still leaves a usable record of the first.
 */
export class ChildRegistry {
  /** @param {string} filePath */
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * Record a child. `needles` are what the live command line must STILL contain for a later run to
   * kill this pid, so they name the process rather than describing it: normalized, and specific
   * enough that a process inheriting the pid cannot satisfy them by accident.
   *
   * @param {number | undefined} pid
   * @param {string} kind
   * @param {string[]} needles
   */
  record(pid, kind, needles) {
    if (!Number.isInteger(pid) || Number(pid) <= 0 || needles.length === 0) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      appendFileSync(this.filePath, `${JSON.stringify({ pid, kind, needles })}\n`);
    } catch {
      // A registry that cannot be written costs the NEXT run its cleanup. It must never cost THIS run
      // its gate result.
    }
  }

  /** @returns {{ pid: number, kind: string, needles: string[] }[]} */
  read() {
    if (!existsSync(this.filePath)) return [];
    try {
      return readFileSync(this.filePath, "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
        .filter(
          (entry) =>
            entry && Number.isInteger(entry.pid) && Array.isArray(entry.needles) && entry.needles.length > 0,
        );
    } catch {
      return [];
    }
  }

  clear() {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, "");
    } catch {
      /* nothing to clear */
    }
  }

  /**
   * Clear last run's leftovers, then start this run's record from empty.
   *
   * THE THREE OUTCOMES ARE ALL REPORTED, including zero, because a cleanup
   * nobody can see teaches nobody anything and is indistinguishable from one
   * that silently does not run.
   *
   *   cleared  alive, command line still matches, tree killed
   *   stale    the pid is gone. Dropped. Nothing killed
   *   reused   alive, command line does NOT match. Dropped. NOTHING KILLED,
   *            and this is the branch that protects Dustin's own Chrome
   *   failed   matched, and the kill did not report success. Counted
   *            SEPARATELY from cleared, because a cleanup that reports a
   *            success it did not have is the failure mode this whole file is
   *            about
   *
   * @param {{ excludePid?: number }} [options]
   * @returns {{ cleared: number, stale: number, reused: number, failed: number, unverifiable: number, notes: string[] }}
   */
  preflight(options = {}) {
    const exclude = options.excludePid ?? process.pid;
    const entries = this.read().filter((entry) => entry.pid !== exclude);
    const result = {
      cleared: 0,
      stale: 0,
      reused: 0,
      failed: 0,
      unverifiable: 0,
      notes: /** @type {string[]} */ ([]),
    };

    if (entries.length === 0) {
      this.clear();
      return result;
    }

    const table = readProcessTable();
    if (table.size === 0) {
      // No listing means no way to tell ours from a stranger's, and killing on the pid alone is the one
      // thing this module refuses to do, so the entries are KEPT.
      result.unverifiable = entries.length;
      result.notes.push(
        `could not read a process table, so ${entries.length} recorded pid(s) were left alone rather than killed on the pid alone`,
      );
      return result;
    }

    for (const entry of entries) {
      const live = table.get(entry.pid);
      // Gone when the table was read, or gone since: an earlier entry's tree kill takes its whole
      // subtree. Both are the same fact.
      if (!live || !processExists(entry.pid)) {
        result.stale += 1;
        continue;
      }
      const matches = entry.needles.every((needle) => live.command.includes(normaliseCommand(needle)));
      if (!matches) {
        result.reused += 1;
        result.notes.push(
          `pid ${entry.pid} is alive but is no longer ${entry.kind}, so it was dropped and NOT killed`,
        );
        continue;
      }
      if (killTree(entry.pid)) {
        result.cleared += 1;
      } else {
        result.failed += 1;
        result.notes.push(`pid ${entry.pid} (${entry.kind}) matched but the kill reported no success`);
      }
    }

    this.clear();
    return result;
  }
}

/**
 * Processes matching any of `needles`, by COMMAND LINE. Ship's preflight refuses when a tier run,
 * a browser run or an orphaned preview server is alive, all three writing the build directory or
 * the database underneath it. BY COMMAND LINE, BY PID, NEVER BY NAME: every one is `node` or a
 * child of it. AN UNREADABLE COMMAND LINE CAN NEVER MATCH.
 *
 * @param {Map<number, { ppid: number, command: string }>} table
 * @param {Array<{ needle: string, what: string }>} needles
 * @param {number} [self] a pid to exclude, normally `process.pid`
 * @returns {Array<{ pid: number, what: string }>}
 */
export function busyProcesses(table, needles, self = 0) {
  /** @type {Array<{ pid: number, what: string }>} */
  const found = [];
  for (const [pid, entry] of table) {
    if (pid === self) continue;
    for (const { needle, what } of needles) {
      if (entry.command.includes(normaliseCommand(needle))) {
        found.push({ pid, what });
        break;
      }
    }
  }
  return found;
}

/**
 * What ship's preflight refuses to run alongside. HERE RATHER THAN IN `ship.mjs` so the test can
 * import the real list: a copy would keep passing after somebody removed a needle, and `ship.mjs`
 * cannot be imported by a test because importing it RUNS a ship. The needle is the SHORTER
 * spelling, the process that binds the port being the resolved binary.
 */
export const SHIP_BUSY_NEEDLES = [
  { needle: "scripts/check-all.mjs", what: "a check:all run" },
  { needle: "scripts/check-browser.mjs", what: "a check:browser run" },
  { needle: "preview --port 4173", what: "an orphaned preview server" },
];
