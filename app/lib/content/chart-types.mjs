/**
 * Mark types the chart directive accepts. Its own module so a page that lists them does not
 * evaluate Observable Plot and linkedom to read four strings; `chart.mjs` re-exports it.
 */
export const CHART_TYPES = ["bar", "line", "dot", "area"];
