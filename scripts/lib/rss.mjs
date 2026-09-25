/**
 * Sampled by a separate process because the tier's blocking spawn leaves no event loop here. Fails
 * soft always: an instrument, not a gate.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const isWindows = process.platform === "win32";

/** By absolute path: a bare name resolves in one shell and is absent in another. */
function powershellPath() {
  const root = process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows";
  const path = join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(path) ? path : null;
}

/** Appends and never truncates: a rewritten file would be empty in the case worth reading. */
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
 * @param {string} outPath
 * @param {number} intervalMs
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
        // Values are substituted into the script: arguments after it go to the interpreter instead.
        "-Command",
        sampler(process.pid, outPath, intervalMs),
      ],
      {
        // Not detached: a detached sampler outlives a killed runner as an orphan.
        detached: false,
        stdio: "ignore",
      },
    );
  } catch (error) {
    // Soft, as the header says, but said: an instrument that silently is not running reads as idle.
    console.error(`rss sampler not started: ${error instanceof Error ? error.message : String(error)}`);
    return { stop: () => {}, available: false, pid: null };
  }
  // A spawn that fails after returning (the binary vanished, access denied) emits 'error'. With no
  // listener that event is thrown, and the sampler would take the check run down with it.
  child.on("error", (error) => {
    console.error(`rss sampler failed: ${error.message}`);
  });

  return {
    available: true,
    stop: () => {
      try {
        child?.kill();
      } catch (error) {
        // A sampler that will not die is not worth failing a check run over, but it is worth a line.
        console.error(`rss sampler did not stop: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    pid: child?.pid ?? null,
  };
}

/**
 * The sampler's rows, `stamp,bytes,pids` as it writes them, split once for both readers. Null when
 * the file cannot be read, which a gate faster than the interval does legitimately.
 *
 * @param {string} outPath
 * @returns {Array<{ stamp: number, bytes: number, pids: number[], columns: number }> | null}
 */
function readSamples(outPath) {
  let text = "";
  try {
    text = readFileSync(outPath, "utf8");
  } catch {
    return null;
  }
  const rows = [];
  for (const line of text.split("\n")) {
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const stamp = Number(parts[0]);
    if (!Number.isFinite(stamp)) continue;
    const pids = (parts[2] ?? "")
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    rows.push({ stamp, bytes: Number(parts[1]), pids, columns: parts.length });
  }
  return rows;
}

/**
 * Null, not zero, when nothing was sampled: a gate faster than the interval lands here legitimately.
 *
 * @param {string} outPath
 * @param {number} fromMs
 * @param {number} toMs
 * @returns {number | null}
 */
export function peakBetween(outPath, fromMs, toMs) {
  let peak = null;
  for (const { stamp, bytes } of readSamples(outPath) ?? []) {
    if (!Number.isFinite(bytes)) continue;
    if (stamp < fromMs || stamp > toMs) continue;
    if (peak === null || bytes > peak) peak = bytes;
  }
  return peak;
}

export function mb(/** @type {number | null | undefined} */ bytes) {
  return bytes === null || bytes === undefined ? "-" : `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * A window, not one sample, because a dead run's heavy processes were spawned minutes earlier; not
 * the whole file, because Windows reuses pids and this list is fed to a kill.
 *
 * @param {string} outPath
 * @param {number} windowMs
 * @returns {number[]}
 */
export function treeSince(outPath, windowMs = 90000) {
  const rows = (readSamples(outPath) ?? []).filter((row) => row.columns >= 3);
  if (rows.length === 0) return [];

  const newest = rows[rows.length - 1].stamp;
  const seen = new Set();
  for (const row of rows) {
    if (newest - row.stamp > windowMs) continue;
    for (const pid of row.pids) seen.add(pid);
  }
  return [...seen];
}
