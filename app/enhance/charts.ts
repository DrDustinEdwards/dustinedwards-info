import { redrawCharts } from "enarratio/redraw";

// An island (devkit ./islands): each <template data-island="charts"> on the page calls this, and the first one runs it.
// A post or page whose HTML holds a `:::chart` places one (app/routes/blog.$slug.tsx, app/routes/content-page.tsx), so pages without a chart never load
// Enarratio. Enarratio's own redraw (the call Capsomer's chart-enhance makes too) redraws each chart to its column and adds its
// enhancement layer (keyboard walk, tooltips, legend filters, downloads). Same-origin and no inline script, so the hash CSP holds.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  redrawCharts();
}
