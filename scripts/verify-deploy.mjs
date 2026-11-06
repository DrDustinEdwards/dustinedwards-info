// The live gate's verify command (deploy.yml, devkit's worker-deploy `verify-command`), run once /health reports this
// run's commit. It decides one thing: whether the new version is broken enough to roll back. Exit 0 passes, 1 refuses
// (worker-deploy rolls the Worker back), 3 could not run (the job fails and production is left as it is).
//
// A refusal is a page that does not render (the home page or a stored page is not a 200) or a /health whose status is
// `fail`, which only the D1 ping can cause (app/routes/health.ts, LEVELS). A warn-level check (a drift check before the
// sync, a binding the pages do without) is not a reason to roll back: the converge job reads those and refuses to sync
// over one (scripts/converge.mjs), which is what ship did.

// site-origin.mjs, not seo.ts: the live gate installs nothing, and seo.ts imports packages.
import { SITE_ORIGIN } from "../app/lib/site-origin.mjs";

/** The home page and a stored page: the two ways a request is answered (render and the stored-page read). */
const PAGES = ["/", "/colophon"];

/**
 * @param {string} path
 * @returns {Promise<{ status: number, text: string, error: string }>}
 */
async function read(path) {
  try {
    const res = await fetch(
      `${SITE_ORIGIN}${path}${path.includes("?") ? "&" : "?"}verify=${Date.now()}`,
      {
        headers: { "user-agent": "deploy-verify", "cache-control": "no-cache" },
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      },
    );
    return { status: res.status, text: await res.text(), error: "" };
  } catch (error) {
    return { status: 0, text: "", error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The verdict from what was read.
 * @param {{ path: string, status: number, text: string, error: string }[]} pages
 * @param {{ status: number, text: string, error: string }} health
 * @returns {{ code: 0 | 1 | 3, lines: string[] }}
 */
function verdict(pages, health) {
  const lines = [];
  const unreachable = [...pages, { ...health, path: "/health" }].filter((r) => r.error);
  if (unreachable.length > 0) {
    return { code: 3, lines: unreachable.map((r) => `${r.path} could not be read: ${r.error}`) };
  }
  let code = /** @type {0 | 1} */ (0);
  for (const page of pages) {
    lines.push(`${page.path} answered ${page.status}`);
    if (page.status !== 200) code = 1;
  }
  let status = "";
  try {
    status = String(JSON.parse(health.text)?.status ?? "");
  } catch {
    status = "";
  }
  lines.push(`/health answered ${health.status} with status ${status || "(none)"}`);
  if (status === "fail" || !status) code = 1;
  return { code, lines };
}

if (import.meta.main) {
  const pages = await Promise.all(PAGES.map(async (path) => ({ path, ...(await read(path)) })));
  const result = verdict(pages, await read("/health"));
  for (const line of result.lines) console.log(line);
  if (result.code === 1) console.log("REFUSED: the new version does not serve the site.");
  if (result.code === 3)
    console.log("COULD NOT RUN: nothing was decided, and production is left as it is.");
  process.exit(result.code);
}
