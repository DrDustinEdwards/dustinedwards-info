/**
 * The display axes: which URL changes are allowed to skip the server.
 *
 * `onlyDisplayChanged` is the whole decision behind `/admin/media`'s
 * `shouldRevalidate`. Getting it wrong in one direction spends a round trip on
 * a CSS class change; getting it wrong in the OTHER direction serves stale rows
 * after a filter, which is a correctness bug wearing a performance fix's
 * clothes. Both directions are asserted here.
 *
 * Standing ruling, 2026-08-16: anything that does not change which data comes
 * back must not touch the server at all.
 *
 * @see app/lib/media/view.mjs
 * @see app/routes/admin.media._index.tsx, the shouldRevalidate export
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULTS,
  DISPLAY_AXES,
  onlyDisplayChanged,
  readDisplayAxes,
} from "../app/lib/media/view.mjs";

const at = (search) => new URL(`https://example.test/admin/media${search}`);

test("a display axis alone skips the server", () => {
  assert.equal(onlyDisplayChanged(at(""), at("?view=grid")), true);
  assert.equal(onlyDisplayChanged(at(""), at("?size=l")), true);
  assert.equal(onlyDisplayChanged(at(""), at("?group=month")), true);
  assert.equal(onlyDisplayChanged(at("?view=grid"), at("?view=grid&size=s")), true);
});

test("a data axis always reaches the server", () => {
  for (const search of ["?sort=size", "?dir=asc", "?page=2", "?q=logo", "?tag=roster", "?lens=large", "?trash=1", "?role=brand", "?key=x.png"]) {
    assert.equal(
      onlyDisplayChanged(at(""), at(search)),
      false,
      `${search} changes which rows come back and must revalidate`,
    );
  }
});

test("a mixed change reaches the server", () => {
  // The display half is irrelevant once a data axis moved: the rows differ.
  assert.equal(onlyDisplayChanged(at(""), at("?view=grid&sort=size")), false);
  assert.equal(onlyDisplayChanged(at(""), at("?size=l&page=3")), false);
});

test("identical URLs do not report a display change", () => {
  // This is the shape an after-action revalidation arrives in. Answering true
  // here would skip the refetch that makes a write visible.
  assert.equal(onlyDisplayChanged(at(""), at("")), false);
  assert.equal(onlyDisplayChanged(at("?view=grid"), at("?view=grid")), false);
});

test("two spellings of one state are not a change", () => {
  // `hrefWith` omits defaults, so the bare URL and the explicit default are the
  // same state. Comparing raw query strings would call this a display change
  // and skip a revalidation that a real navigation needed.
  assert.equal(onlyDisplayChanged(at("?view=list"), at("")), false);
  assert.equal(onlyDisplayChanged(at("?group=folder&size=m"), at("")), false);
});

test("a different path is never a display change", () => {
  const other = new URL("https://example.test/admin/posts?view=grid");
  assert.equal(onlyDisplayChanged(at(""), other), false);
});

test("readDisplayAxes covers exactly the declared display axes", () => {
  // DERIVED, so a fourth axis added to DISPLAY_AXES and forgotten in the reader
  // fails here rather than silently rendering its default forever.
  const got = Object.keys(readDisplayAxes(new URLSearchParams()));
  assert.deepEqual(got.sort(), [...DISPLAY_AXES].sort());
});

test("readDisplayAxes falls back to the default for an unknown value", () => {
  const p = new URLSearchParams("view=sideways&size=xxl&group=hourly");
  const got = readDisplayAxes(p);
  assert.equal(got.view, DEFAULTS.view);
  assert.equal(got.size, DEFAULTS.size);
  assert.equal(got.group, DEFAULTS.group);
});

test("sort and dir are NOT display axes", () => {
  // The page paginates, so reordering changes which 24 rows page one holds.
  // This test exists to make adding them here a deliberate, failing act.
  assert.equal(DISPLAY_AXES.includes("sort"), false);
  assert.equal(DISPLAY_AXES.includes("dir"), false);
});
