// The preview server check:browser drives: the port preflight, the build, the spawn, the readiness
// probe and its diagnosis, and the cleanup of every child the run started.

import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  ChildRegistry,
  descendantPids,
  killTree,
  normaliseCommand,
  portListeners,
  readProcessTable,
} from "../child-processes.mjs";
import { BASE, DRIVES_PREVIEW, PORT, PUBLIC_ORIGIN, root } from "./harness.mjs";

/** Declared here because the port preflight needs them before any spawn. */
const VITE_NEEDLES = ["vite", "preview", String(PORT)];

/** Gitignored, or `npm run ship` would refuse the dirty tree. */
export const registry = new ChildRegistry(join(root, ".gate-pids", "check-browser.jsonl"));

/** Last run's children, then the port's holders; refuses to start on a stranger. */
export async function preflight() {
  /* A pid whose command line no longer matches is dropped, never killed: pids are reused. */
  {
    const swept = registry.preflight();
    const parts = [`${swept.cleared} cleared`, `${swept.stale} stale`, `${swept.reused} reused`];
    if (swept.failed > 0) parts.push(`${swept.failed} FAILED TO KILL`);
    if (swept.unverifiable > 0) parts.push(`${swept.unverifiable} unverifiable`);
    console.log(`  preflight: last run's children, ${parts.join(", ")}`);
    for (const note of swept.notes) console.log(`    ${note}`);
  }

  /* The OS may know a port holder the registry does not. Kill only a `VITE_NEEDLES` match. */
  if (DRIVES_PREVIEW) {
    const holders = portListeners(PORT);
    if (holders === null) {
      console.log(`  preflight: port ${PORT} could NOT be probed, so a holder would go unseen`);
    } else if (holders.length === 0) {
      console.log(`  preflight: port ${PORT} probed directly, 0 holders`);
    } else {
      const table = readProcessTable();
      /** @type {{ pid: number, command: string }[]} */
      const strangers = [];
      let killed = 0;
      for (const pid of holders) {
        const live = table.get(pid);
        const matches =
          live && VITE_NEEDLES.every((needle) => live.command.includes(normaliseCommand(needle)));
        if (!matches) {
          strangers.push({ pid, command: live?.command ?? "(no command line could be read)" });
          continue;
        }
        if (killTree(pid)) killed += 1;
        else strangers.push({ pid, command: `${live.command} (matched, but the kill reported no success)` });
      }

      if (strangers.length > 0) {
        console.error(
          `\ncheck:browser REFUSES TO START. Port ${PORT} is held by a process this gate did not launch.`,
        );
        for (const stranger of strangers) {
          console.error(`  pid ${stranger.pid}: ${stranger.command}`);
        }
        console.error(
          "  Nothing was killed. Stop it yourself, or run with PUBLIC_ORIGIN set to drive a deployed origin.",
        );
        registry.clear();
        process.exit(1);
      }

      /* `taskkill` returns before the socket is released, so re-probe until clear. A probe that
         FAILED (null) is not a released port: it is a kill this gate could not verify. */
      const releasedBy = Date.now() + 5000;
      let stillHeld = portListeners(PORT);
      while ((stillHeld === null || stillHeld.length > 0) && Date.now() < releasedBy) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        stillHeld = portListeners(PORT);
      }
      if (stillHeld === null) {
        console.error(
          `\ncheck:browser REFUSES TO START. Port ${PORT} could not be re-probed after killing ${killed} ` +
            `leftover(s), so whether it was released is unknown.`,
        );
        registry.clear();
        process.exit(1);
      }
      if (stillHeld.length > 0) {
        console.error(
          `\ncheck:browser REFUSES TO START. Port ${PORT} was still held after killing ${killed} leftover(s): ${stillHeld.join(", ")}`,
        );
        registry.clear();
        process.exit(1);
      }
      console.log(
        `  preflight: port ${PORT} probed directly, ${killed} leftover preview server(s) cleared, port released`,
      );
    }
  }

  /* Registered first: killing its wrappers orphans this process. */
  registry.record(process.pid, "the check:browser gate", ["check-browser.mjs"]);
}

/**
 * A setup step that failed ends the run: nothing after it would measure what it claims. Prints why,
 * then the end of the step's output, where its error is.
 *
 * @param {{ status: number | null }} result
 * @param {string} output
 * @param {string[]} why
 */
export function refuseUnlessRan(result, output, why) {
  if (result.status === 0) return;
  for (const line of why) console.error(line);
  console.error(output.slice(-1200));
  // Every caller runs before the server or the browser starts, so clearing the registry is all
  // the cleanup there is.
  registry.clear();
  process.exit(1);
}

/** @param {string} script */
const npmRun = (script) => {
  const r = spawnSync("npm", ["run", script], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status, output: r.stderr || r.stdout || "" };
};

/** Builds before a preview run; a deployed origin is observed as it is. */
export function build() {
  /* Builds rather than trusting build/, which may be stale. */
  if (DRIVES_PREVIEW) {
    console.log("  building ...");
    // Enhancement bundles first: the app build imports them, and this gate runs alone.
    const bundled = npmRun("build:enhance");
    refuseUnlessRan(bundled, bundled.output, [
      "check:browser failed. build:enhance did not succeed, so the build below cannot.",
    ]);
    const built = npmRun("build");
    refuseUnlessRan(built, built.output, [
      "check:browser failed. the build did not succeed, so there is nothing to lay out.",
    ]);
  } else {
    console.log(`  NOT building: the public cases observe ${PUBLIC_ORIGIN}, a deployed site.`);
  }
}

/* A ring buffer of server output, so a startup failure can show its cause. */
/** @type {string[]} */
const serverLog = [];
const SERVER_LOG_LINES = 40;
/** @param {unknown} chunk */
const recordServerOutput = (chunk) => {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.trim()) serverLog.push(line.trimEnd());
  }
  if (serverLog.length > SERVER_LOG_LINES) {
    serverLog.splice(0, serverLog.length - SERVER_LOG_LINES);
  }
};

/** @type {import("node:child_process").ChildProcess | null} */
let server = null;

/* A dead server and a booting one look alike to a fetch, so exit ends the wait. */
let serverExit = /** @type {{ code: number | null, signal: string | null } | null} */ (null);

/** Spawns the preview server when this run drives one; a deployed origin needs none. */
export function startServer() {
  /* Without `--strictPort` vite binds the next port and the gate grades a stale server. */
  server = DRIVES_PREVIEW
    ? spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
        cwd: root,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      })
    : null;
  server?.stdout?.on("data", recordServerOutput);
  server?.stderr?.on("data", recordServerOutput);
  server?.on("error", (error) => recordServerOutput(`spawn failed: ${error.message}`));

  /* This pid is the shell, which dies with the gate; survivors are recorded later. */
  if (server?.pid) registry.record(server.pid, "the vite preview server", VITE_NEEDLES);

  server?.on("exit", (code, signal) => {
    serverExit = { code, signal };
  });
}

let originStatus = /** @type {number | null} */ (null);
/** @type {{ state: string, detail: string }} */
let readiness = { state: "not-started", detail: "the probe has not run" };

let originError = "";

export async function waitForServer(timeoutMs = 180_000) {
  const started = Date.now();

  /* A deployed origin is not booting: one attempt, status reported, no retry. */
  if (!DRIVES_PREVIEW) {
    try {
      const res = await fetch(`${BASE}/blog`, { signal: AbortSignal.timeout(10_000) });
      originStatus = res.status;
      if (res.ok) {
        console.log(`  ${BASE} answered in ${Date.now() - started}ms`);
        return true;
      }
    } catch (error) {
      originError = error instanceof Error ? error.message : String(error);
    }
    return false;
  }

  const deadline = started + timeoutMs;
  /* A kill during startup is the case the registry exists for. Throttled: reading the process table is expensive. */
  let lastCapture = 0;
  const CAPTURE_INTERVAL_MS = 2000;
  while (Date.now() < deadline) {
    if (Date.now() - lastCapture >= CAPTURE_INTERVAL_MS) {
      recordServerSurvivors();
      lastCapture = Date.now();
    }
    try {
      const res = await fetch(`${BASE}/blog`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        console.log(`  preview server answered in ${Date.now() - started}ms`);
        recordServerSurvivors();
        return true;
      }
      // Answered and said no: a wrong probe path, not a slow boot.
      readiness = { state: "answered-not-ok", detail: `HTTP ${res.status} on ${BASE}/blog` };
    } catch (error) {
      const cause = /** @type {any} */ (error);
      const code = cause?.cause?.code ?? cause?.name ?? String(error);
      readiness =
        code === "ECONNREFUSED"
          ? { state: "no-listener", detail: "connection refused: nothing is bound yet" }
          : code === "TimeoutError" || code === "HeadersTimeoutError"
            ? { state: "bound-silent", detail: "a listener accepted the connection and did not reply" }
            : { state: "unreachable", detail: String(code) };
    }
    if (serverExit) {
      readiness = {
        state: "exited",
        detail: `the server process exited with code ${serverExit.code}, signal ${serverExit.signal}`,
      };
      return false;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

export function serverDiagnosis() {
  const verdict =
    readiness.state === "no-listener"
      ? "STILL BOOTING when the ceiling expired: nothing had bound the port yet. MEASURED on a " +
        "clear machine this boot takes about 51s and prints its Local URL 25s before it serves; " +
        "on a loaded one it has run past the 180s ceiling. That is the machine, not a defect."
      : readiness.state === "bound-silent"
        ? "WEDGED: a listener accepted the connection and never replied. That is the server, not the ceiling."
        : readiness.state === "answered-not-ok"
          ? "ANSWERING AND REFUSING: the probe path is reachable and returned a non-ok status, which " +
            "is a wrong probe path rather than a dead server."
          : readiness.state === "exited"
            ? "DEAD: the process exited before it served anything."
            : `UNCLASSIFIED (${readiness.state}).`;
  const stateLine = `  readiness: ${verdict}\n  last observation: ${readiness.detail}\n`;

  if (!DRIVES_PREVIEW) {
    if (originStatus !== null) {
      return (
        `${BASE}/blog answered ${originStatus}, not 200. PUBLIC_ORIGIN names a DEPLOYED site ` +
        `and this run starts no server of its own, so this is the origin ANSWERING and ` +
        `refusing the path, not a server that failed to come up. Check PUBLIC_ORIGIN: a ` +
        `404 here means the host is serving something that is not this site.`
      );
    }
    return (
      `${BASE}/blog could not be reached at all: ${originError || "no response and no error"}. ` +
      `PUBLIC_ORIGIN names a DEPLOYED site, so the host is down, the name does not resolve, ` +
      `or the network from here cannot reach it.`
    );
  }
  const how = serverExit
    ? `The preview server EXITED before answering (code ${serverExit.code}, signal ${serverExit.signal}).`
    : `The preview server process was still alive and never answered on ${BASE}.`;
  const tail = serverLog.length
    ? `Its last ${serverLog.length} line(s):\n    ${serverLog.join("\n    ")}`
    : `It produced NO output at all, on either stream, which usually means the ` +
      `spawn itself never ran the command.`;
  return `${stateLine}  ${how}\n  ${tail}`;
}

/** Held in memory because the registry is append-only. */
const recorded = new Set();
let survivorsUnverifiable = false;

function recordServerSurvivors() {
  if (!server?.pid) return;
  const table = readProcessTable();
  /* An empty table means "cannot verify", not "no descendants": said once, so an orphan the next
     preflight cannot identify has a cause on record. */
  if (table.size === 0) {
    if (!survivorsUnverifiable) {
      console.log(
        "  NOTE  the process table could not be read, so the preview server's descendants were " +
          "not recorded; if this run is killed hard, the next preflight cannot identify them",
      );
      survivorsUnverifiable = true;
    }
    return;
  }
  for (const pid of descendantPids(server.pid, table)) {
    if (recorded.has(pid)) continue;
    const live = table.get(pid);
    if (!live) continue;
    // The same matcher the port preflight uses, so one needle set has one meaning.
    if (!VITE_NEEDLES.every((needle) => live.command.includes(normaliseCommand(needle)))) continue;
    registry.record(pid, "the vite preview server", VITE_NEEDLES);
    recorded.add(pid);
  }
}

/**
 * The synchronous half of cleanup, which a signal handler can still run: Chrome's tree, the
 * server's tree (`/T`, because the spawned pid is a shell above vite), then the registry. With
 * `--keep` nothing is killed and the entries stay, so the next preflight frees the port.
 *
 * @param {import("puppeteer").Browser | undefined} openBrowser
 */
export function killChildren(openBrowser) {
  if (process.argv.includes("--keep")) return;
  const chrome = openBrowser?.process();
  if (chrome?.pid) killTree(chrome.pid);
  if (server?.pid) killTree(server.pid);
  registry.clear();
}

/** @param {import("puppeteer").Browser | undefined} openBrowser */
export async function cleanupChildren(openBrowser) {
  await openBrowser?.close().catch(() => {});
  killChildren(openBrowser);
}
