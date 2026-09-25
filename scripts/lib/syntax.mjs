/**
 * Source read as a TypeScript syntax tree, for gates that must not be fooled by a comment, a string,
 * or an apostrophe in JSX text the way a regex over raw text is.
 */
import ts from "typescript";

export { ts };

/**
 * @param {string} fileName decides the dialect: .tsx is TSX, .mjs/.js/.jsx are JS, anything else TS
 * @param {string} text
 */
export function parseSource(fileName, text) {
  const kind = /\.(tsx|jsx)$/.test(fileName)
    ? ts.ScriptKind.TSX
    : /\.(mjs|js)$/.test(fileName)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
}

/**
 * Every way code can read `name` off an object: `x.NAME`, `x["NAME"]`, and a destructured
 * `{ NAME }` or `{ NAME: alias }`. An object literal KEY named NAME is a write, not a read.
 *
 * @param {ts.SourceFile} sf
 * @param {ReadonlySet<string>} names
 * @returns {Array<{ name: string, line: number }>}
 */
export function propertyReads(sf, names) {
  /** @type {Array<{ name: string, line: number }>} */
  const out = [];
  /** @param {ts.Node} node @param {string} name */
  const hit = (node, name) =>
    out.push({ name, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  /** @param {ts.Node} n */
  const visit = (n) => {
    if (ts.isPropertyAccessExpression(n) && names.has(n.name.text)) hit(n, n.name.text);
    if (
      ts.isElementAccessExpression(n) &&
      ts.isStringLiteralLike(n.argumentExpression) &&
      names.has(n.argumentExpression.text)
    ) {
      hit(n, n.argumentExpression.text);
    }
    if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
      const key = n.propertyName ?? n.name;
      if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && names.has(key.text)) hit(n, key.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * The member names of every `interface NAME` in the file, merged as TypeScript merges them.
 *
 * @param {ts.SourceFile} sf
 * @param {string} interfaceName
 * @returns {{ found: boolean, members: Set<string> }}
 */
export function interfaceMembers(sf, interfaceName) {
  /** @type {Set<string>} */
  const members = new Set();
  let found = false;
  /** @param {ts.Node} n */
  const visit = (n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === interfaceName) {
      found = true;
      for (const m of n.members) {
        if (m.name && (ts.isIdentifier(m.name) || ts.isStringLiteralLike(m.name))) members.add(m.name.text);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { found, members };
}
