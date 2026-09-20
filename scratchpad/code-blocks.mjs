// Ruling 115, wave 1: find every comment block in a JS or TS file.
//
// The tokenizer is a copy of scan() in scripts/lib/strip-comments.mjs that
// records comment spans, because the original emits none. code-measure.mjs
// proves the copy agrees: cutting these spans reproduces stripComments exactly
// on every tracked code file.
//
// A BLOCK is one /* */ comment, or a run of // comments on consecutive lines
// with nothing but whitespace before them on each line. A trailing // after
// code is its own block.

/** Comment spans as [start, end) offsets, recovered by a parallel tokenizer. */
export function commentSpans(source) {
  const spans = [];
  let out = "";
  let i = 0;
  const lastSignificant = () => {
    for (let k = out.length - 1; k >= 0; k -= 1) if (!/\s/.test(out[k])) return out[k];
    return "";
  };
  const opensRegex = () => {
    const prev = lastSignificant();
    if (prev === "") return true;
    return "(,=:[!&|?{};+-*%~^<>".includes(prev);
  };
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let closed = false;
      while (j < source.length) {
        if (source[j] === "\\") { j += 2; continue; }
        if (source[j] === c) { j += 1; closed = true; break; }
        j += 1;
      }
      if (!closed) { out += source.slice(i); break; }
      out += source.slice(i, j);
      i = j;
      continue;
    }
    if (c === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && opensRegex()) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < source.length) {
        const d = source[j];
        if (d === "\\") { j += 2; continue; }
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) { j += 1; closed = true; break; }
        j += 1;
      }
      if (closed) { out += source.slice(i, j); i = j; continue; }
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      spans.push({ kind: "block", start: i, end: stop });
      out += " ";
      i = stop;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      spans.push({ kind: "line", start: i, end: stop });
      out += " ";
      i = stop;
      continue;
    }
    out += c;
    i += 1;
  }
  return spans;
}

const lineOf = (source, offset) => {
  let n = 1;
  for (let k = source.indexOf("\n"); k !== -1 && k < offset; k = source.indexOf("\n", k + 1)) n += 1;
  return n;
};

/** Group spans into blocks. Returns {start, end, line, endLine, text, ownLine}. */
export function commentBlocks(source) {
  const spans = commentSpans(source);
  const blocks = [];
  const ownLine = (s) => {
    const ls = source.lastIndexOf("\n", s.start - 1) + 1;
    return /^[ \t]*$/.test(source.slice(ls, s.start));
  };
  for (const s of spans) {
    const prev = blocks[blocks.length - 1];
    const own = ownLine(s);
    if (
      prev && s.kind === "line" && prev.kind === "line" && own && prev.ownLine &&
      /^[ \t]*\r?\n[ \t]*$/.test(source.slice(prev.end, s.start))
    ) {
      prev.end = s.end;
      continue;
    }
    blocks.push({ kind: s.kind, start: s.start, end: s.end, ownLine: own });
  }
  // Line numbers in one pass.
  const nl = [];
  for (let k = source.indexOf("\n"); k !== -1; k = source.indexOf("\n", k + 1)) nl.push(k);
  const lineAt = (off) => {
    let lo = 0, hi = nl.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (nl[mid] < off) lo = mid + 1; else hi = mid; }
    return lo + 1;
  };
  for (const b of blocks) {
    b.text = source.slice(b.start, b.end);
    b.line = lineAt(b.start);
    b.endLine = lineAt(b.end);
  }
  return blocks;
}

export { lineOf };
