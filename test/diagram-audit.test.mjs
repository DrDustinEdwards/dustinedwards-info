import test from "node:test";
import assert from "node:assert/strict";

import { auditDiagramSvg, cssRules } from "../scripts/lib/diagram-audit.mjs";

const PALETTE = ["#111111", "#EEEEEE"];

test("the root svg's own attributes are audited", () => {
  const audit = auditDiagramSvg('<svg style="background-color: #FF0000"><rect fill="#111111"/></svg>', PALETTE);
  assert.equal(audit.problems.length, 1);
  assert.match(audit.problems[0], /<svg style> background-color: #FF0000/);
});

test("rules inside @media are audited, not skipped", () => {
  const svg =
    "<svg><style>@media (prefers-color-scheme: dark) { rect { fill: #FF0000; } }</style><rect/></svg>";
  const audit = auditDiagramSvg(svg, PALETTE);
  assert.equal(audit.skippedRules, 0);
  assert.equal(audit.problems.length, 1);
});

test("@keyframes colors are audited", () => {
  const svg = "<svg><style>@keyframes pulse { from { fill: #FF0000; } }</style><rect/></svg>";
  assert.equal(auditDiagramSvg(svg, PALETTE).problems.length, 1);
});

test("a defs child referenced by <use href> is live and audited", () => {
  const svg =
    '<svg><defs><g id="box"><rect fill="#FF0000"/></g></defs><use href="#box"/></svg>';
  assert.equal(auditDiagramSvg(svg, PALETTE).problems.length, 1);
});

test("an unreferenced defs child is still skipped", () => {
  const svg = '<svg><defs><g id="unused"><rect fill="#FF0000"/></g></defs><rect fill="#111111"/></svg>';
  assert.equal(auditDiagramSvg(svg, PALETTE).problems.length, 0);
});

test("unbalanced braces throw rather than dropping the rules after them", () => {
  assert.throws(() => cssRules("a { fill: red; } } b { fill: blue; }"), /closes nothing/);
  assert.throws(() => cssRules("a { fill: red;"), /never closed/);
});
