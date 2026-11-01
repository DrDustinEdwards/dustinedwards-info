import { enhanceCharts } from "@drdustinedwards/site-helpers/render/chart-enhance";

// An island (devkit ./islands): each <template data-island="charts"> on the page calls this, and the first one runs it.
// A post or page whose HTML holds a `:::chart` places one (app/routes/blog.$slug.tsx, app/routes/content-page.tsx), so pages without a chart never load
// Enarratio. Prelum's chart-enhance redraws each chart to its column and adds Enarratio's enhancement layer (keyboard walk,
// tooltips, legend filters, downloads). Same-origin and no inline script, so the hash CSP holds.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  enhanceCharts();
}
