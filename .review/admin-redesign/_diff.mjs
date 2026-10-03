import sharp from "sharp";
const dir = new URL("./public/", import.meta.url).pathname;
for (const f of process.argv.slice(2)) {
  const a = await sharp(dir + "before/" + f).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(dir + "after/" + f).raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) { console.log(f, "SIZE", a.info.height, b.info.height); continue; }
  let n = 0, minY = 1e9, maxY = 0, maxD = 0; const w = a.info.width, c = a.info.channels;
  for (let i = 0; i < a.data.length; i += c) {
    let d = 0; for (let k = 0; k < 3; k++) d += Math.abs(a.data[i + k] - b.data[i + k]);
    if (d > 0) { n++; maxD = Math.max(maxD, d); const y = Math.floor(i / c / w); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  console.log(f, "differing pixels:", n, n ? `rows ${minY}-${maxY}, max channel-sum delta ${maxD}` : "");
}
