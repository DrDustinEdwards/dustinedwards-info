/**
 * PEAK RESIDENT MEMORY OF A PROCESS TREE, sampled from outside it.
 *
 * The tier runs its gates with a BLOCKING spawn, so any sampler living in this event loop would
 * record nothing for exactly the span it exists to measure. The sampler is a separate process
 * writing to a FILE, and the runner attributes each sample to whichever gate owned the clock.
 *
 * WHY IT EXISTS: tier runs were killed by the OS for low memory, and every diagnosis was an
 * inference from which gate happened to be printing. WHAT IS COUNTED, STATED PLAINLY: the whole
 * descendant tree plus the root, summed, the runner's own resident set included, because the
 * number that matters for an OOM kill is what the machine was holding. FAILS SOFT, ALWAYS: this
 * is an instrument, not a gate.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Windows only. Everything here degrades to "not measured" elsewhere. */
const isWindows = process.platform === "win32";

/**
 * BY ABSOLUTE PATH, never by bare name: a gate that spawns a tool by bare name is green in the
 * shell it was written in and absent in the one that ships, which a sibling gate paid for.
 */
function powershellPath() {
  const root = process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows";
  const path = join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(path) ? path : null;
}

/**
 * The sampling loop. The descendant walk happens in the SAMPLER, so the file already holds the
 * answer and a reader that starts late still gets correct history. Appends per line and never
 * truncates: a gap is visible, whereas a rewritten file would be empty in the case worth reading.
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
         * THE VALUES ARE SUBSTITUTED INTO THE SCRIPT, not passed after it, where they are consumed as
         * arguments to the interpreter. Measured on the first run, which started cleanly and wrote zero
         * samples.
         */
        "-Command",
        sampler(process.pid, outPath, intervalMs),
      ],
      {
        // DETACHED IS WRONG HERE: a detached sampler outlives a killed runner and becomes exactly the
        // orphan the memory work exists to remove. It stays a child, so the tree kill takes it too.
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
 * The peak sample inside a window, or null when nothing was sampled: zero is a measurement and
 * "nobody looked" is not, a gate faster than the sampling interval landing here legitimately.
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
 * THE PIDS OF THE MOST RECENT SAMPLED TREE: the sampler already walks the tree every tick, so it
 * writes the membership beside the total and becomes the tree ORACLE as well as the meter, which
 * matters because the blocking spawn leaves this process unable to enumerate anything. PIDS,
 * NEVER NAMES: a sweep matching a process name would reach the user's own browser and editor.
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
 * EVERY PID SEEN IN THE LAST WINDOW OF SAMPLING, as one set. A single sample is right for "what
 * is the tree right now" and WRONG for cleaning up after a run that died, whose heavy processes
 * were spawned minutes earlier. WHY A WINDOW RATHER THAN THE WHOLE FILE: WINDOWS REUSES PIDS and
 * this list is fed to a KILL. The window bounds the risk rather than proving against it, and the
 * residual is accepted and stated; matching on NAMES is worse by a wide margin.
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
