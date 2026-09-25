// The contrast lab and the search anatomy demo, run through the modules the page renders with.

import { apca, contrast } from "../../../../app/lib/contrast.mjs";
import { RRF_K, fuse } from "../../../../app/lib/search/query.mjs";

/** @param {import("./index.mjs").PlaygroundContext} p */
export function checkContrastSearch({ ok, swatches, playgroundSource }) {
  for (const swatch of swatches) {
    const actual = contrast(swatch.fg, swatch.bg);
    ok(
      `contrast lab: ${swatch.label} computes ${swatch.ratio} to 1`,
      Math.abs(actual - swatch.ratio) < 0.05,
      `app/lib/contrast.mjs returned ${actual.toFixed(2)}, content/playground.json records ${swatch.ratio}`,
    );
    const expectedVerdict = swatch.ratio >= 4.5;
    ok(
      `contrast lab: ${swatch.label} AA normal-text verdict is ${expectedVerdict ? "Pass" : "Fail"}`,
      (actual >= 4.5) === expectedVerdict,
      "the module and the recorded ratio disagree across the 4.5 to 1 threshold",
    );
  }
  // Lc is signed, so polarity is asserted both ways.
  ok(
    "contrast lab: APCA is positive for dark text on a light ground",
    apca("#2B2320", "#FAF7F2") > 0,
    "polarity dropped; the sign is the only thing distinguishing the two cases",
  );
  ok(
    "contrast lab: APCA is negative for light text on a dark ground",
    apca("#E3DBD0", "#1A1614") < 0,
    "polarity reversed or dropped",
  );

  // Fixture lists, real fuse(). "a" ranks 1 in both layers, "c" ranks 2 in one.
  const fusionFixture = fuse([
    [{ uid: "a" }, { uid: "b" }],
    [{ uid: "a" }, { uid: "c" }],
  ]);
  ok("search anatomy: k is 60", RRF_K === 60, `RRF_K is ${RRF_K}`);
  const rowA = fusionFixture.find((/** @type {any} */ r) => r.item.uid === "a");
  const rowC = fusionFixture.find((/** @type {any} */ r) => r.item.uid === "c");
  ok("search anatomy: the fixture produces a row for the doc in both layers", Boolean(rowA));
  ok("search anatomy: the fixture produces a row for the doc in one layer", Boolean(rowC));
  if (rowA && rowC) {
    const oneOverSixtyOne = 1 / 61;
    ok(
      "search anatomy: rank 1 contributes 1/61",
      Math.abs(rowA.contributions[0] - oneOverSixtyOne) < 1e-12,
      `got ${rowA.contributions[0]}`,
    );
    ok(
      "search anatomy: a doc in both layers records both ranks",
      rowA.ranks.length === 2 && rowA.ranks[0] === 1 && rowA.ranks[1] === 1,
      `ranks ${JSON.stringify(rowA.ranks)}`,
    );
    ok(
      "search anatomy: the fused total is the sum of the contributions",
      Math.abs(rowA.score - oneOverSixtyOne * 2) < 1e-12,
      `score ${rowA.score}`,
    );
    ok(
      "search anatomy: sources, ranks and contributions stay parallel",
      rowC.sources.length === 1 && rowC.ranks.length === 1 && rowC.contributions.length === 1,
      "a length mismatch would render a value against the wrong layer",
    );
    // The exact strings toFixed(5) renders.
    ok(
      "search anatomy: rank 1 renders as 0.01639",
      rowA.contributions[0].toFixed(5) === "0.01639",
      `renders ${rowA.contributions[0].toFixed(5)}`,
    );
    ok(
      "search anatomy: the two-layer fused total renders as 0.03279",
      rowA.score.toFixed(5) === "0.03279",
      `renders ${rowA.score.toFixed(5)}`,
    );
    ok(
      "search anatomy: rank 2 in one layer renders as 0.01613",
      rowC.score.toFixed(5) === "0.01613",
      `renders ${rowC.score.toFixed(5)}`,
    );
  }
  /* The page reads the decomposition, never computes it; asserted on code, not JSX text. */
  ok(
    "search anatomy: the page reads the per-layer contribution",
    /identityContribution/.test(playgroundSource),
    "the table must render what fuse() recorded",
  );
  ok(
    "search anatomy: the page does not own the fusion constant",
    !/RRF_K/.test(playgroundSource),
    "app/routes/playground.tsx imports RRF_K, so it holds a second copy of k",
  );
  ok(
    "search anatomy: the page does not divide by a literal k",
    !/1\s*\/\s*\(\s*60/.test(playgroundSource),
    "a literal 1/(60 + ...) in the route is the fusion rule implemented twice",
  );
  ok(
    "search anatomy: k is rendered from the payload",
    /explain\.k/.test(playgroundSource),
    "the caption's k must come from the fused result, not from a number typed here",
  );
  ok(
    "search anatomy: the page requests the decomposition explicitly",
    /explain:\s*true/.test(playgroundSource),
    "without the flag the table would have nothing to render",
  );
  ok(
    "search anatomy: the caption states that cross-index values are not comparable",
    /not\s+comparable/.test(playgroundSource) && /bm25/.test(playgroundSource),
    "the sentence explaining why fusion is over ranks is the answer to why there is no score column",
  );
}
