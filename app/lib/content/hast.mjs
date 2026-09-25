// The two hast node builders the chart and diagram renderers write their figures with.

/** @param {string} tagName @param {Record<string, any>} properties @param {any[]} children */
export const h = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
});

/** @param {string} value */
export const text = (value) => ({ type: "text", value });
