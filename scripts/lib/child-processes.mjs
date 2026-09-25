// Windows reuses pids, so nothing here kills on a pid alone: the live command line must still match.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const isWindows = process.platform === "win32";

/**
 * @param {string | null | undefined} command
 * @returns {string}
 */
export function normaliseCommand(command) {
  return String(command ?? "").replace(/\\/g, "/").toLowerCase();
}

/**
 * PowerShell, not `wmic` (absent on newer builds) or `tasklist` (no command line).
 * An empty map means "cannot verify", never "nothing running".
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
 * Killing the gate kills the wrapper `spawn()` returned but not its grandchildren, so record those.
 *
 * @param {number} rootPid
 * @param {Map<number, { ppid: number, command: string }>} table
 * @returns {number[]}
 */
export function descendantPids(rootPid, table) {
  /** @type {number[]} */
  const found = [];
  let frontier = [rootPid];
  // Bounded: a reused pid can manufacture a parentage cycle.
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
 * Signal 0 checks existence without delivering anything; `EPERM` means it exists.
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
 * Unfiltered listing: the IPv4 flag misses the holder, which binds an IPv6 loopback.
 * `null` means no listing could be taken, never "nobody is listening".
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
      // Last colon, so an IPv6 address that merely contains the digits cannot match.
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
  // lsof exits 1 when it matched nothing, which is an answer, not an error.
  if (listed.error) return null;
  if (listed.status !== 0 && listed.status !== 1) return null;
  for (const line of String(listed.stdout ?? "").split("\n")) {
    const parsed = Number(line.trim());
    if (Number.isInteger(parsed) && parsed > 0) pids.add(parsed);
  }
  return [...pids];
}

/**
 * The tree flag is load-bearing: the interesting processes are always grandchildren.
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
    // Needs the child spawned into its own process group, which a negative pid addresses.
    process.kill(-pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

// Appended per spawn, so a gate killed between two spawns still leaves a record of the first.
export class ChildRegistry {
  /** @param {string} filePath */
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * `needles` must be specific enough that a process inheriting the pid cannot match them.
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
    } catch (error) {
      // An unwritable registry costs the next run its cleanup, never this run its gate result,
      // but it is said out loud: the next run's preflight will not know about this child.
      process.stderr.write(
        `  registry: could not record pid ${pid} (${kind}) in ${this.filePath}: ` +
          `${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  /**
   * Per line: a run killed mid-append leaves one torn line, and it must not hide the others.
   *
   * @returns {{ entries: { pid: number, kind: string, needles: string[] }[], torn: number }}
   */
  readAll() {
    if (!existsSync(this.filePath)) return { entries: [], torn: 0 };
    const entries = [];
    let torn = 0;
    for (const line of readFileSync(this.filePath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        torn += 1;
        continue;
      }
      if (entry && Number.isInteger(entry.pid) && Array.isArray(entry.needles) && entry.needles.length > 0) {
        entries.push(entry);
      } else {
        torn += 1;
      }
    }
    return { entries, torn };
  }

  /** @returns {{ pid: number, kind: string, needles: string[] }[]} */
  read() {
    return this.readAll().entries;
  }

  clear() {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, "");
    } catch (error) {
      // Safe to carry on: the next preflight re-checks every entry's command line before a kill.
      process.stderr.write(
        `  registry: could not clear ${this.filePath}: ` +
          `${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  /**
   * `reused` (alive, command line no longer matches) kills nothing: that pid now belongs to
   * something else, such as Dustin's own Chrome.
   *
   * @param {{ excludePid?: number }} [options]
   * @returns {{ cleared: number, stale: number, reused: number, failed: number, unverifiable: number, notes: string[] }}
   */
  preflight(options = {}) {
    const exclude = options.excludePid ?? process.pid;
    const { entries: recorded, torn } = this.readAll();
    const entries = recorded.filter((entry) => entry.pid !== exclude);
    const result = {
      cleared: 0,
      stale: 0,
      reused: 0,
      failed: 0,
      unverifiable: 0,
      notes: /** @type {string[]} */ ([]),
    };
    if (torn > 0) {
      result.notes.push(
        `${torn} registry line(s) could not be read (a run killed mid-write), so any child they named was not swept`,
      );
    }

    if (entries.length === 0) {
      this.clear();
      return result;
    }

    const table = readProcessTable();
    if (table.size === 0) {
      result.unverifiable = entries.length;
      result.notes.push(
        `could not read a process table, so ${entries.length} recorded pid(s) were left alone rather than killed on the pid alone`,
      );
      return result;
    }

    for (const entry of entries) {
      const live = table.get(entry.pid);
      // Re-checked live: an earlier entry's tree kill may have taken this one since the table was read.
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
 * By command line, never by process name: every one of them is `node`. Self's ANCESTORS are
 * excused with it, because the ship needle matches ship's own launchers (the tee parent, and
 * on Windows the `cmd /c node scripts/ship.mjs` shell).
 *
 * @param {Map<number, { ppid: number, command: string }>} table
 * @param {Array<{ needle: string, what: string }>} needles
 * @param {number} [self]
 * @returns {Array<{ pid: number, what: string }>}
 */
export function busyProcesses(table, needles, self = 0) {
  const excused = new Set([self]);
  // Bounded: a reused pid can manufacture a parentage cycle.
  for (let pid = table.get(self)?.ppid; pid && !excused.has(pid) && excused.size <= table.size; ) {
    excused.add(pid);
    pid = table.get(pid)?.ppid;
  }
  /** @type {Array<{ pid: number, what: string }>} */
  const found = [];
  for (const [pid, entry] of table) {
    if (excused.has(pid)) continue;
    for (const { needle, what } of needles) {
      if (entry.command.includes(normaliseCommand(needle))) {
        found.push({ pid, what });
        break;
      }
    }
  }
  return found;
}

// Here rather than in ship.mjs so a test can import the real list: importing ship.mjs runs a ship.
export const SHIP_BUSY_NEEDLES = [
  { needle: "scripts/check-all.mjs", what: "a check:all run" },
  { needle: "scripts/check-browser.mjs", what: "a check:browser run" },
  { needle: "preview --port 4173", what: "an orphaned preview server" },
  // Two ships on one checkout run two builds into one build/ (2026-09-24: one wiped the other's manifest).
  { needle: "scripts/ship.mjs", what: "another ship" },
];
