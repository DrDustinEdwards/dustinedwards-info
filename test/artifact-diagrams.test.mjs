/**
 * build:diagrams prunes every committed SVG the artifact does not name, so the artifact read must
 * refuse a shape it does not understand rather than read it as "no diagrams".
 */

import test from "node:test";
import assert from "node:assert/strict";

import { diagramsFrom } from "../scripts/lib/artifact-diagrams.mjs";

const D = { key: "abc", source: "flowchart LR\n  a --> b" };

test("REPLAY: an empty artifact is refused, not read as zero diagrams", () => {
  assert.throws(() => diagramsFrom({ posts: [] }, "posts.json"), /zero posts/);
  assert.throws(() => diagramsFrom({}, "posts.json"), /no posts array/);
});

test("REPLAY: a post whose diagrams key moved is refused", () => {
  assert.throws(
    () => diagramsFrom({ posts: [{ slug: "p", figures: [D] }] }, "posts.json"),
    /p has no diagrams list/,
  );
});

test("a diagram with no key or source is refused", () => {
  for (const bad of [{ source: "x" }, { key: "", source: "x" }, { key: "k" }, null]) {
    assert.throws(
      () => diagramsFrom({ posts: [{ slug: "p", diagrams: [bad] }] }, "posts.json"),
      /no key or source/,
      JSON.stringify(bad),
    );
  }
});

test("posts with no diagrams are fine, and a shared drawing is one asset", () => {
  const diagrams = diagramsFrom(
    {
      posts: [
        { slug: "a", diagrams: [D] },
        { slug: "b", diagrams: [] },
        { slug: "c", diagrams: [D] },
      ],
    },
    "posts.json",
  );
  assert.deepEqual(diagrams, [{ posts: ["a", "c"], key: "abc", source: D.source }]);
});
