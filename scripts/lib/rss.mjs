/**
 * PEAK RESIDENT MEMORY OF A PROCESS TREE, sampled from outside it.
 *
 * `check:all` runs its gates with a BLOCKING `spawnSync`, so while a gate runs
 * this process cannot execute a timer, read a pipe, or do anything else. Any
 * sampler living in this event loop would therefore record nothing for exactly
 * the span it exists to measure. So the sampler is a separate process that
 * writes to a FILE, and the runner reads that file afterwards and attributes
 * each sample to whichever gate owned the clock when it was taken.
 *
 * ## WHY THIS EXISTS
 *
 * Five `check:all` runs were killed by the OS for low memory between 2026-09-05
 * and 2026-09-09, one of them taking the machine down with it. Every diagnosis
 * of those runs was an inference from which gate happened to be printing when
 * the run died. A gate that is merely SLOW and a gate that is holding a
 * gigabyte look identical in a log of gate names and durations, and the tier
 * had no instrument that could tell them apart.
 *
 * ## WHAT IS COUNTED, STATED PLAINLY
 *
 * The whole descendant tree of `rootPid`, plus `rootPid` itself, summed. That
 * includes the runner's own resident set (roughly 60 MB), so a gate's figure is
 * the tier's total while that gate ran, not the gate in isolation. Reporting
 * the total is the honest form: the number that matters for an out-of-memory
 * kill is what the machine was holding, and subtracting a baseline would invent
 * a figure nothing measured.
 *
 * WorkingSetSize is what Windows reports as resident, which is the quantity the
 * memory manager acts on. It is not the same as committed or virtual size, and
 * a process paged out shrinks here without having freed anything.
 *
 * ## FAILS SOFT, ALWAYS
 *
 * A sampler that cannot start, or a PowerShell that is not where it should be,
 * reports "not measured" and the tier runs exactly as before. This is an
 * instrument, not a gate: it must never be the reason a check run fails.
 * `command -v` is deliberately not consulted (presence is not capability); the
 * binary is resolved by absolute path and its absence is simply a null reading.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Windows only. Everything here degrades to "not measured" elsewhere. */
const isWindows = process.platform === "win32";

/**
 * PowerShell BY ABSOLUTE PATH, never by bare name.
 *
 * `FAILURES.md`: a gate that spawns a tool by bare name is green in the shell
 * it was written in and absent in the one that ships. `check:hook-scope`
 * spawned `bash`, passed every session under the agent's git bash, and refused
 * six times at a ship step under PowerShell. The same trap is available here in
 * the other direction, so the interpreter is resolved from `SystemRoot`.
 */
function powershellPath() {
  const root = process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows";
  const path = join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(path) ? path : null;
}

/**
 * The sampling loop, as a PowerShell program.
 *
 * One `Get-CimInstance` per sample gives every process with its parent, and the
 * descendants of the root are collected by walking that map. Doing the walk in
 * the sampler rather than in node means the file already holds the answer, so a
 * reader that starts late still gets correct history.
 *
 * Appends `epochMilliseconds,bytes` per line and never truncates: a sample lost
 * to a crash is a gap, and a gap is visible, whereas a rewritten file would be
 * empty in exactly the case worth reading.
 */
const sampler = (
  /** @type {number} */ rootPid,
  /** @type {string} */ outPath,
  /** @type {number} */ intervalMs,
) => `
$RootPid = ${rootPid}
$Out = '${outPath.replace(/'/g, "''")}'
$IntervalMs = ${intervalMs}
while ($true) {
  try {
    $all = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize
    $byParent = @{}
    foreach ($p in $all) {
      $parent = [int]$p.ParentProcessId
      if (-not $byParent.ContainsKey($parent)) { $byParent[$parent] = @() }
      $byParent[$parent] += $p
    }
    $size = @{}
    foreach ($p in $all) { $size[[int]$p.ProcessId] = [long]$p.WorkingSetSize }
    $total = 0
    $stack = New-Object System.Collections.Stack
    $stack.Push($RootPid)
    $seen = @{}
    while ($stack.Count -gt 0) {
      $current = [int]$stack.Pop()
      if ($seen.ContainsKey($current)) { continue }
      $seen[$current] = $true
      if ($size.ContainsKey($current)) { $total += $size[$current] }
      if ($byParent.ContainsKey($current)) {
        foreach ($child in $byParent[$current]) { $stack.Push([int]$child.ProcessId) }
      }
    }
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $kids = ($seen.Keys | Where-Object { $_ -ne $RootPid }) -join " "
    Add-Content -Path $Out -Value "$stamp,$total,$kids" -ErrorAction SilentlyContinue
  } catch { }
  Start-Sleep -Milliseconds $IntervalMs
}
`;

/**
 * Starts sampling the tree rooted at this process.
 *
 * @param {string} outPath file the samples are appended to
 * @param {number} intervalMs how often to sample
 * @returns {{ stop: () => void, available: boolean, pid: number | null }}
 */
export function startRssSampler(outPath, intervalMs = 400) {
  const shell = isWindows ? powershellPath() : null;
  if (!shell) return { stop: () => {}, available: false, pid: null };

  let child = null;
  try {
    child = spawn(
      shell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        /*
         * THE VALUES ARE SUBSTITUTED INTO THE SCRIPT, not passed after it.
         * `powershell -Command "<script>" -RootPid 123` does NOT bind those
         * into a `param()` block: they are consumed as arguments to
         * powershell.exe itself and the script sees nothing. Measured here on
         * the first run of this file, which started cleanly and wrote zero
         * samples, which is the shape a silent no-op takes.
         */
        "-Command",
        sampler(process.pid, outPath, intervalMs),
      ],
      {
        // DETACHED IS WRONG HERE and the reason is the bug this file is part of:
        // a detached sampler outlives a killed runner and becomes exactly the
        // orphan the memory work exists to remove. It stays a child, so the
        // runner's own tree kill takes it too.
        detached: false,
        stdio: "ignore",
      },
    );
  } catch {
    return { stop: () => {}, available: false, pid: null };
  }

  return {
    available: true,
    stop: () => {
      try {
        child?.kill();
      } catch {
        // A sampler that will not die is not worth failing a check run over.
      }
    },
    pid: child?.pid ?? null,
  };
}

/**
 * The peak sample inside a window, in bytes, or null when nothing was sampled.
 *
 * A window with NO samples returns null rather than 0, because zero is a
 * measurement and "nobody looked" is not. A gate faster than the sampling
 * interval legitimately lands here, and reporting 0 MB for it would be a
 * plausible number with nothing behind it.
 *
 * @param {string} outPath
 * @param {number} fromMs inclusive, epoch milliseconds
 * @param {number} toMs inclusive, epoch milliseconds
 * @returns {number | null}
 */
export function peakBetween(outPath, fromMs, toMs) {
  let text = "";
  try {
    text = readFileSync(outPath, "utf8");
  } catch {
    return null;
  }

  let peak = null;
  for (const line of text.split("\n")) {
    const comma = line.indexOf(",");
    if (comma === -1) continue;
    const stamp = Number(line.slice(0, comma));
    // Three fields since the tree membership was added; the pid list is read
    // by `lastTree` and is not part of the total.
    const rest = line.slice(comma + 1);
    const second = rest.indexOf(",");
    const bytes = Number(second === -1 ? rest : rest.slice(0, second));
    if (!Number.isFinite(stamp) || !Number.isFinite(bytes)) continue;
    if (stamp < fromMs || stamp > toMs) continue;
    if (peak === null || bytes > peak) peak = bytes;
  }
  return peak;
}

/** Bytes as whole megabytes, or a dash when nothing was measured. */
export function mb(/** @type {number | null | undefined} */ bytes) {
  return bytes === null || bytes === undefined ? "-" : `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * THE PIDS OF THE MOST RECENT SAMPLED TREE, excluding the runner itself.
 *
 * The sampler already walks the descendant tree every tick to sum it, so it
 * writes the membership beside the total and this reads it back. That makes the
 * sampler the tree ORACLE as well as the meter, which matters because
 * `spawnSync` blocks the runner: while a gate runs, this process cannot
 * enumerate anything, and after the gate returns its grandchildren are exactly
 * the processes nobody recorded.
 *
 * PIDS, NEVER NAMES. A sweep matching `node` or `chrome` by name on this
 * machine would reach Dustin's own browser and editor, which is not a cleanup,
 * it is an outage. Measured 2026-09-09: a bare name match over this host
 * selects 18 Chrome processes belonging to the user's own session.
 *
 * A pid is only meaningful while it is alive, and Windows reuses them, so a
 * caller kills only what it can still see and treats an absent pid as done.
 *
 * @param {string} outPath
 * @returns {number[]}
 */
export function lastTree(outPath) {
  let text = "";
  try {
    text = readFileSync(outPath, "utf8");
  } catch {
    return [];
  }

  const lines = text.split("\n").filter((line) => line.includes(","));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parts = lines[i].split(",");
    if (parts.length < 3) continue;
    const pids = parts[2]
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    if (pids.length > 0) return pids;
  }
  return [];
}

/**
 * EVERY PID SEEN IN THE LAST `windowMs` OF SAMPLING, as one set.
 *
 * `lastTree` reads a single sample, which is right for "what is the tree right
 * now" and WRONG for cleaning up after a run that died. Measured 2026-09-09,
 * and it is why this function exists: a `check:all` run exhausted the machine,
 * 14 processes holding 1678 MB survived it, and the final sample named two of
 * them. The heavy ones had been spawned by `check:head` minutes earlier and
 * were still resident; they were simply not in the last row.
 *
 * ## WHY A WINDOW RATHER THAN THE WHOLE FILE
 *
 * WINDOWS REUSES PIDS. A pid seen at the start of a twenty minute run may
 * belong to something else entirely by the end, and this list is fed to a
 * KILL. The window is anchored to the LAST sample rather than to the clock,
 * because the interesting case is a file written by a run that died a while
 * ago: what matters is what was alive as that run ended, not how long ago the
 * ending was.
 *
 * The window is a bound on the risk, not a proof against it. A caller kills
 * only pids that are still alive, and the residual case, a pid reused inside
 * the window by an unrelated process, is accepted and stated rather than
 * hidden. The alternative, matching on process NAMES, is worse by a wide
 * margin: on this machine it selects the user's own browser and editor.
 *
 * @param {string} outPath
 * @param {number} windowMs how far back from the last sample to gather
 * @returns {number[]}
 */
export function treeSince(outPath, windowMs = 90000) {
  let text = "";
  try {
    text = readFileSync(outPath, "utf8");
  } catch {
    return [];
  }

  const rows = [];
  for (const line of text.split("\n")) {
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const stamp = Number(parts[0]);
    if (!Number.isFinite(stamp)) continue;
    const pids = parts[2]
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    rows.push({ stamp, pids });
  }
  if (rows.length === 0) return [];

  const newest = rows[rows.length - 1].stamp;
  const seen = new Set();
  for (const row of rows) {
    if (newest - row.stamp > windowMs) continue;
    for (const pid of row.pids) seen.add(pid);
  }
  return [...seen];
}
