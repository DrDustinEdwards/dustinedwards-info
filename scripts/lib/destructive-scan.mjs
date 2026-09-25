/**
 * The parsing half of check:destructive. It reads the TypeScript syntax tree rather than the raw
 * text, so a comment naming the predicate cannot satisfy a guard, an apostrophe in JSX text cannot
 * blank the code after it, and `form.get("intent") === "x"` is seen as well as `intent === "x"`.
 */
import { parseSource, ts } from "./syntax.mjs";

export { parseSource };

/** @param {ts.Node} node */
function isExported(node) {
  return (ts.getModifiers(/** @type {any} */ (node)) ?? []).some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  );
}

/**
 * The exported `action`, as a function declaration or an exported const.
 *
 * @param {ts.SourceFile} sf
 * @returns {ts.Node | null}
 */
export function findAction(sf) {
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === "action" && isExported(stmt)) {
      return stmt;
    }
    if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === "action") return decl;
      }
    }
  }
  return null;
}

/**
 * `intent`, or `<anything>.get("intent")`.
 *
 * @param {ts.Node} node
 */
function isIntentRead(node) {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isIdentifier(node)) return node.text === "intent";
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "get" &&
    node.arguments.length === 1 &&
    ts.isStringLiteralLike(node.arguments[0]) &&
    node.arguments[0].text === "intent"
  );
}

const EQUAL = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken]);
const UNEQUAL = new Set([
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/**
 * A call to `predicate(...)` anywhere under `node`. Comments are not nodes, so prose cannot count.
 *
 * @param {ts.Node} node
 * @param {string} predicate
 */
function hasGuardCall(node, predicate) {
  let found = false;
  /** @param {ts.Node} n */
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === predicate) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** @param {ts.Statement} stmt @returns {boolean} */
function exits(stmt) {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isBlock(stmt)) {
    const last = stmt.statements.at(-1);
    return last !== undefined && exits(last);
  }
  return false;
}

/**
 * The statements a comparison selects, or the reason it cannot say.
 *
 * `=== "x"` in an if condition (through parentheses, && and ||) selects the then-branch.
 * `!== "x"` as the whole condition of an if whose then-branch exits selects the statements after it.
 * `case "x":` selects that clause. Anything else is a shape this scan does not understand, which
 * fails closed for a destructive intent rather than reading as guarded.
 *
 * @param {ts.Node} comparison
 * @param {boolean} negated
 * @returns {{ nodes: ts.Node[] } | { reason: string }}
 */
function branchOf(comparison, negated) {
  let child = comparison;
  let parent = comparison.parent;
  while (
    ts.isParenthesizedExpression(parent) ||
    (!negated &&
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        parent.operatorToken.kind === ts.SyntaxKind.BarBarToken))
  ) {
    child = parent;
    parent = parent.parent;
  }
  if (!ts.isIfStatement(parent) || parent.expression !== child) {
    return { reason: "the comparison is not the condition of an if statement" };
  }
  if (!negated) return { nodes: [parent.thenStatement] };
  if (!exits(parent.thenStatement)) {
    return { reason: "a !== comparison whose if branch does not return or throw" };
  }
  const block = parent.parent;
  if (!ts.isBlock(block) && !ts.isSourceFile(block)) {
    return { reason: "a !== comparison outside a statement list" };
  }
  const index = block.statements.indexOf(/** @type {ts.Statement} */ (parent));
  return { nodes: block.statements.slice(index + 1) };
}

/**
 * Every intent the action branches on, each with the code its comparison selects.
 *
 * @param {ts.Node} action
 * @param {string} predicate the confirmation function a destructive branch must call
 * @returns {Array<{ intent: string, guarded: boolean, reason?: string }>}
 */
export function intentBranches(action, predicate) {
  /** @type {Array<{ intent: string, guarded: boolean, reason?: string }>} */
  const out = [];
  /** @param {string} intent @param {{ nodes: ts.Node[] } | { reason: string }} branch */
  const record = (intent, branch) => {
    if ("reason" in branch) {
      out.push({ intent, guarded: false, reason: branch.reason });
      return;
    }
    out.push({ intent, guarded: branch.nodes.some((n) => hasGuardCall(n, predicate)) });
  };
  /** @param {ts.Node} n */
  const visit = (n) => {
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (EQUAL.has(op) || UNEQUAL.has(op)) {
        const [read, literal] = isIntentRead(n.left) ? [n.left, n.right] : [n.right, n.left];
        if (isIntentRead(read)) {
          if (ts.isStringLiteralLike(literal)) {
            record(literal.text, branchOf(n, UNEQUAL.has(op)));
          } else {
            out.push({
              intent: `<${literal.getText()}>`,
              guarded: false,
              reason: "the intent is compared to something that is not a string literal",
            });
          }
        }
      }
    }
    if (ts.isSwitchStatement(n) && isIntentRead(n.expression)) {
      for (const clause of n.caseBlock.clauses) {
        if (!ts.isCaseClause(clause)) continue;
        if (ts.isStringLiteralLike(clause.expression)) {
          record(clause.expression.text, { nodes: [...clause.statements] });
        } else {
          out.push({
            intent: `<${clause.expression.getText()}>`,
            guarded: false,
            reason: "a case label that is not a string literal",
          });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(action);
  return out;
}

/**
 * The initializer of a property in an exported object literal, e.g. `TOOL_DESCRIPTORS.delete_post`.
 *
 * @param {ts.SourceFile} sf
 * @param {string} constName
 * @returns {ts.ObjectLiteralExpression | null}
 */
export function objectConst(sf, constName) {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== constName || !decl.initializer) continue;
      let init = decl.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)) {
        init = init.expression;
      }
      return ts.isObjectLiteralExpression(init) ? init : null;
    }
  }
  return null;
}

/**
 * The string elements of `const NAME = [ ... ] as const`.
 *
 * @param {ts.SourceFile} sf
 * @param {string} constName
 * @returns {string[] | null}
 */
export function stringArrayConst(sf, constName) {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== constName || !decl.initializer) continue;
      let init = decl.initializer;
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
      if (!ts.isArrayLiteralExpression(init)) return null;
      return init.elements.filter(ts.isStringLiteralLike).map((e) => e.text);
    }
  }
  return null;
}

/**
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} key
 * @returns {ts.Expression | null}
 */
export function propertyValue(obj, key) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name;
    const text = ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;
    if (text === key) return prop.initializer;
  }
  return null;
}

/**
 * A non-empty string built from literals: "a", `a`, or "a" + "b".
 *
 * @param {ts.Expression | null} expr
 * @returns {boolean}
 */
export function isLiteralString(expr) {
  if (!expr) return false;
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  if (ts.isStringLiteralLike(expr)) return expr.text.length > 0;
  return (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    isLiteralString(expr.left) &&
    isLiteralString(expr.right)
  );
}

/**
 * Every way code reaches a binding: `x.NAME`, `x["NAME"]`, a local alias of either, or a
 * destructured `{ NAME }` / `{ NAME: alias }`.
 *
 * Returns the `.delete(` calls on it, and every call it is passed into as an argument, since a
 * helper can delete from what it is handed.
 *
 * @param {ts.SourceFile} sf
 * @param {string} binding
 * @returns {{ mentions: number, deletes: string[], passedTo: string[] }}
 */
export function bindingUses(sf, binding) {
  /** @type {Set<string>} */
  const aliases = new Set();
  let mentions = 0;

  /** @param {ts.Node} n */
  const refersTo = (n) => {
    while (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n)) {
      n = n.expression;
    }
    if (ts.isPropertyAccessExpression(n)) return n.name.text === binding;
    if (ts.isElementAccessExpression(n)) {
      return ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === binding;
    }
    if (ts.isIdentifier(n)) return aliases.has(n.text);
    return false;
  };

  // Aliases first, in one pass, so a use before its textual declaration is still resolved.
  /** @param {ts.Node} n */
  const collect = (n) => {
    if (ts.isVariableDeclaration(n)) {
      if (ts.isIdentifier(n.name) && n.initializer && refersTo(n.initializer)) {
        aliases.add(n.name.text);
      }
      if (ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
          const key = el.propertyName ?? el.name;
          if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && key.text === binding && ts.isIdentifier(el.name)) {
            aliases.add(el.name.text);
          }
        }
      }
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);

  /** @type {string[]} */
  const deletes = [];
  /** @type {string[]} */
  const passedTo = [];
  /** @param {ts.Node} n */
  const visit = (n) => {
    if (
      (ts.isPropertyAccessExpression(n) && n.name.text === binding) ||
      (ts.isElementAccessExpression(n) && refersTo(n)) ||
      (ts.isBindingElement(n) && ((n.propertyName ?? n.name).getText() === binding))
    ) {
      mentions += 1;
    }
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "delete" && refersTo(callee.expression)) {
        deletes.push(n.getText().replace(/\s+/g, " ").slice(0, 100));
      }
      if (n.arguments.some((a) => refersTo(a))) {
        passedTo.push(callee.getText());
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { mentions, deletes, passedTo };
}
