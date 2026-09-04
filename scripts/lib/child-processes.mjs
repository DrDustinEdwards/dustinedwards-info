/**
 * Killing a gate's long-running children, and clearing the ones a kill left
 * behind last time.
 *
 * ## THE DEFECT THIS IS FOR, measured 2026-08-31 rather than reasoned about
 *
 * `check:browser` starts two long-running children: a `vite preview` server and
 * a Puppeteer browser. Both are cleaned up on every ORDERLY exit. Neither is
 * cleaned up when the gate process is killed, because a hard kill on Windows is
 * not deliverable as a signal and no `finally` runs.
 *
 * Two kill shapes were replayed, and they leave DIFFERENT wreckage. Both
 * numbers below are dated observations, not properties:
 *
 *   Kill the gate node itself. Puppeteer's Chromes all exit within seconds,
 *   because they die with the parent that holds their DevTools pipe. What
 *   survives is the vite side: three processes, holding port 4173 with no
 *   owner, indefinitely. The next run then cannot bind the port.
 *
 *   Kill the npm and cmd wrappers ABOVE the gate node and leave the gate node
 *   orphaned. Eighteen processes stand: nine Chromes, four vite, two workerd,
 *   two esbuild, and the stranded gate. This one self-clears IF the orphan is
 *   allowed to finish, because its own `finally` still runs. It becomes
 *   permanent when the orphan is killed too, which is what a supervisor
 *   retrying a kill does.
 *
 * ## WHY A REGISTRY AND NOT A SWEEP
 *
 * The obvious repair is to hunt for leftovers by scanning every process on the
 * machine and killing what looks like ours. That is the approach pnpm MOVED
 * AWAY FROM in June 2026, because on Windows the scan is too slow to finish,
 * and it is the approach with the worst failure mode available here: Dustin
 * runs his own Chrome, and "looks like ours" is a guess that gets to close his
 * tabs when it is wrong.
 *
 * So the gate records what it STARTED, by pid, at the moment it started it, and
 * the next run reads that list. `taskkill /F /T` walks the tree from a pid we
 * know rather than from a pattern we hope is specific.
 *
 * ## THE PORT PROBE IS NOT A REVERSAL OF THAT, AND IT IS THE HALF THE REGISTRY
 * CANNOT HAVE
 *
 * `portListeners` below asks the OS who is listening on ONE port. That is not
 * the scan this file rejects: it names a single number the gate is about to
 * bind rather than pattern-matching every process on the machine, and it is
 * still not permitted to kill on the strength of the answer. The command line
 * check is the same one the registry uses, applied to the pid the OS named.
 * What it buys is the case the registry is structurally blind to, because the
 * registry is written by the process that dies.
 *
 * ## PID REUSE IS THE WHOLE SAFETY PROBLEM
 *
 * A pid in the file is not a claim that the process is ours. It is a claim that
 * it WAS ours, and Windows reuses pids freely. So no entry is ever killed on
 * the strength of its pid: the live process's command line is read first and
 * must still match what the gate launches. A pid that has been reused by
 * something else fails that match, is dropped, and is not killed. That check is
 * the reason this module reads a process table at all.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const isWindows = process.platform === "win32";

/**
 * Command lines are compared in ONE normalised form, because the same process
 * is spelled differently by the two things that report it. Windows hands back
 * backslashes and mixed case; the needles below are written lowercase with
 * forward slashes so a needle cannot fail to match for a reason that has
 * nothing to do with identity.
 *
 * @param {string | null | undefined} command
 * @returns {string}
 */
export function normaliseCommand(command) {
  return String(command ?? "").replace(/\\/g, "/").toLowerCase();
}

/**
 * Every live process, as `pid -> { ppid, command }`.
 *
 * Windows goes through PowerShell rather than `wmic`, which is deprecated and
 * absent on newer builds, and rather than `tasklist`, which does not report a
 * command line at all. A missing command line is fatal to this module's whole
 * safety story, so a source that cannot supply one is not a fallback.
 *
 * Returns an EMPTY MAP if the listing cannot be taken. Callers treat that as
 * "cannot verify", and the only thing they do with an unverifiable entry is
 * leave it alone.
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
        // A process with no readable command line still gets an entry, so it can
        // be seen to EXIST. It just can never satisfy a needle, which is the
        // fail-closed direction.
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
 * Every descendant pid of `rootPid`, from a table already read.
 *
 * Used at ONE moment: once the preview server has answered, to record the
 * wrapper chain npx puts between the gate and the actual vite process. That
 * capture is the difference between a registry that works and one that does
 * not, and the reason is measured: when the gate node is killed, the wrapper
 * the gate itself spawned DIES with it (its stdio pipe breaks) and the
 * grandchildren survive. Recording only the pid `spawn()` handed back records
 * the one process guaranteed to be gone by the time anybody looks.
 *
 * @param {number} rootPid
 * @param {Map<number, { ppid: number, command: string }>} table
 * @returns {number[]}
 */
export function descendantPids(rootPid, table) {
  /** @type {number[]} */
  const found = [];
  let frontier = [rootPid];
  // Bounded by the table size: a cycle in reported parentage (a reused pid can
  // manufacture one) would otherwise spin here forever.
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
 * Whether a pid is live RIGHT NOW, as opposed to when a table was read.
 *
 * Signal 0 checks for existence without delivering anything, and `EPERM` is a
 * positive answer: the process is there and simply not ours to signal.
 *
 * This exists because a process table is a SNAPSHOT and the preflight loop
 * invalidates it as it goes. Killing one recorded tree removes the processes
 * further down the same list, and asking the snapshot about them afterwards
 * says they are alive. Measured on the first replay 2026-08-31: two entries
 * that a sibling's tree kill had already removed were reported as FAILED TO
 * KILL, which is an instrument announcing a problem that did not exist.
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
 * The pids LISTENING on a TCP port, asked of the OPERATING SYSTEM.
 *
 * ## WHY THIS EXISTS ALONGSIDE THE REGISTRY ABOVE
 *
 * The registry is written by the process that dies, so it cannot record the one
 * thing that outlives a hard kill. Measured 2026-09-03: a killed run left a
 * `vite preview` holding 4173, the registry file was empty because the kill took
 * the gate before anything was appended, and the next run's preflight reported
 * `0 cleared, 0 stale, 0 reused` while the port was occupied the whole time. A
 * cleanup that reads only its own bookkeeping is blind to exactly the case that
 * bookkeeping was for.
 *
 * The port is the fact that does not depend on this repo having written
 * anything down, which is why the probe goes to the OS and not to a file.
 *
 * ## THE MEASURED GOTCHA, AND IT IS THE WHOLE REASON THIS IS NOT A ONE-LINER
 *
 * `netstat -ano -p tcp` DOES NOT LIST THE HOLDER. On Windows that flag selects
 * IPv4 TCP only, and vite binds `[::1]:4173`, which netstat reports under the
 * separate `TCPv6` protocol. The first version of this probe used `-p tcp`,
 * found nothing, and reported a free port while pid 21108 was listening on it.
 * So the listing is taken UNFILTERED and the protocol is matched here.
 *
 * ## THE RETURN VALUE HAS THREE STATES, NOT TWO
 *
 * An array is an answer. `null` means the listing could not be taken at all,
 * which is NOT the same as "nobody is listening" and must never be collapsed
 * into it: that collapse is how a probe reports a clean sweep of nothing.
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
      // Anchored on the LAST colon, so `[::1]:4173` cannot be satisfied by an
      // address that merely contains the digits, and `:41730` cannot match.
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
  // lsof exits 1 when it simply matched nothing, which is an ANSWER. Only a
  // missing or erroring binary is the unverifiable state, and that is what an
  // absent stdout with a nonzero status that is not 1 looks like.
  if (listed.error) return null;
  if (listed.status !== 0 && listed.status !== 1) return null;
  for (const line of String(listed.stdout ?? "").split("\n")) {
    const parsed = Number(line.trim());
    if (Number.isInteger(parsed) && parsed > 0) pids.add(parsed);
  }
  return [...pids];
}

/**
 * Kill a process AND everything under it.
 *
 * `taskkill /F /T` is what npm does and what pnpm moved to in June 2026. The
 * `/T` is the load-bearing flag: the interesting processes here are always
 * grandchildren (vite's workerd and esbuild, Chrome's renderers), and killing
 * the root alone reproduces the defect rather than fixing it.
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
 * The on-disk record of what this gate started.
 *
 * One JSON object per line, appended as each child is launched, so a gate that
 * is killed between two spawns still leaves a usable record of the first. A
 * rewritten-at-exit file would be empty in exactly the case it exists for.
 */
export class ChildRegistry {
  /** @param {string} filePath */
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * Record a child. `needles` are what the live command line must STILL contain
   * for a later run to be allowed to kill this pid, so they name the process
   * rather than merely describing it: normalised (lowercase, forward slashes),
   * and specific enough that an unrelated process which inherits the pid cannot
   * satisfy them by accident.
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
      // A registry that cannot be written costs the NEXT run its cleanup. It
      // must never cost THIS run its gate result, which is the only thing
      // anybody is waiting on.
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
      // No listing means no way to tell ours from a stranger's. Killing on the
      // pid alone is the one thing this module refuses to do, so the entries
      // are KEPT for a later run that can read a table.
      result.unverifiable = entries.length;
      result.notes.push(
        `could not read a process table, so ${entries.length} recorded pid(s) were left alone rather than killed on the pid alone`,
      );
      return result;
    }

    for (const entry of entries) {
      const live = table.get(entry.pid);
      // Gone when the table was read, or gone since: an earlier entry's tree
      // kill takes its whole subtree, and the rest of this list is full of that
      // subtree. Both are the same fact, so they get the same label.
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
