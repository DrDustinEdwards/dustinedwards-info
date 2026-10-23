/**
 * YAML dates arrive as Date objects; the record keeps the ISO day the file wrote.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function yamlPlain(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(yamlPlain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, yamlPlain(v)]));
  return value;
}
