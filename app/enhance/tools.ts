import { enhance } from "capsomer/behavior/calculator";

import { TOOLS, runTool } from "../lib/phage-tools.mjs";

// An island (devkit ./islands): each <template data-island="tools"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  /*
   * The phage lab calculators, live: Capsomer's calculator behavior (capsomer/behavior/calculator) on the
   * forms app/components/phage-tool.tsx rendered from the query string, recomputing on input with the
   * same run the server used. A calculator with no run here throws, so a form is never silently dead.
   */
  enhance(
    document,
    Object.fromEntries(
      Object.keys(TOOLS).map((id) => [id, (values: Record<string, string>) => runTool(id, values)]),
    ),
  );
}
