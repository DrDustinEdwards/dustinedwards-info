import { spawnSyncBounded } from "./retry.mjs";

/**
 * The one way scripts run wrangler. One command string, because an args array alongside
 * `shell: true` concatenates without quoting and npx needs a shell on Windows. Bounded, so a hung
 * wrangler fails its caller instead of hanging it, and buffered for a whole-database export.
 *
 * `stdout` alone is where `--json` writes: stderr appended after it (a deprecation warning, an
 * update notice) made the text from the first `[` unparseable. `output` adds stderr and a spawn
 * failure, which is where an error is.
 *
 * @param {string} args
 * @param {{ timeoutMs?: number, cwd?: string }} [options]
 * @returns {{ status: number, stdout: string, output: string }}
 */
export function runWrangler(args, { timeoutMs = 15 * 60_000, cwd } = {}) {
  const result = spawnSyncBounded(`npx wrangler ${args}`, [], {
    cwd,
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
    timeoutMs,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    output: `${result.stdout}${result.stderr}${result.error ? `\n${result.error}` : ""}`,
  };
}

/**
 * The END of wrangler's output, which is where its error is: a head slice reported the banner.
 *
 * @param {string} text
 * @param {number} [max]
 */
export function wranglerTail(text, max = 400) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && /\w/.test(l) && !/^[⛅🌀]/u.test(l));
  return lines.join(" | ").slice(-max) || "no output";
}
