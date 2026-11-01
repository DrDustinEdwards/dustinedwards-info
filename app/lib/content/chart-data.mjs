// A chart's data from the media library (checklist E3). A post cites a CSV the media library stores,
// `:::chart{src="/media/<key>.csv"}`, and Prelum's editorialPack calls `chartData(src)` for the text at render time
// (Prelum fetches nothing itself). The Worker's publish reads the MEDIA bucket; the Node build reads the live site.
// Must stay loadable by node:test: no binding, no `.server` module.

/**
 * The media key a chart's src names, or null when it is not a CSV in the media library.
 *
 * @param {string} src
 * @returns {string | null}
 */
export function chartSourceKey(src) {
  const match = /^\/media\/([a-z0-9][a-z0-9-]*\.csv)$/.exec(src.trim());
  return match?.[1] ?? null;
}

/**
 * Prelum's `chartData` hook over a reader of the media library. Each key it reads is added to `cited`, so the post
 * records the file as used (`mediaRefs`).
 *
 * @param {(key: string) => Promise<string | null>} read the stored text, or null when there is no such file
 * @param {Set<string>} [cited]
 * @returns {(src: string) => Promise<string>}
 */
export function makeChartData(read, cited = new Set()) {
  return async (src) => {
    const key = chartSourceKey(src);
    if (!key) throw new Error(`"${src}" is not a CSV in the media library; upload the file and cite it as /media/<key>.csv`);
    const text = await read(key);
    if (text === null) throw new Error(`/media/${key} is not in the media library`);
    cited.add(key);
    return text;
  };
}
