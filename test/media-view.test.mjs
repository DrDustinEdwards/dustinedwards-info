/**
 * The media library's view state, and the parameter that must not evaporate.
 *
 * REPLAYS A DEFECT PAID FOR TWICE. `q` fell off the pagination links once, and
 * `role` fell off the chips once. Both times the page looked correct, one click
 * silently reset the view, and no gate could see it: a dropped query parameter
 * is not a payload difference, so `check:admin-ui`'s tuple for a `GET` link is
 * identical whether it carries eight parameters or one.
 *
 * The property under test is therefore not "hrefWith works" but "hrefWith
 * carries EVERY non-default parameter", asserted over the whole parameter list
 * derived from one source rather than over a hand-written list that could go
 * stale in the same way the links did.
 *
 * @see app/lib/media/view.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULTS,
  DIRS,
  GROUPS,
  PARAM_NAMES,
  SIZES,
  SORTS,
  VIEWS,
  displaySummary,
  folderOf,
  groupRows,
  hrefWith,
  isModified,
  monthOf,
  readView,
} from "../app/lib/media/view.mjs";

/** A stand-in for URLSearchParams with the one method readView uses. */
const params = (entries) => ({ get: (n) => (n in entries ? entries[n] : null) });

/** A state where EVERY field differs from its default. */
const FULLY_SET = {
  view: "grid",
  group: "folder",
  sort: "size",
  dir: "asc",
  size: "l",
  role: "brand",
  q: "logo",
  tag: "icon",
  page: 3,
  trash: true,
  key: "1234abcd5678ef90.png",
};

test("THE DEFECT: every non-default parameter survives a link", () => {
  const href = hrefWith(FULLY_SET);
  const search = new URLSearchParams(href.split("?")[1] ?? "");
  for (const name of PARAM_NAMES) {
    assert.ok(
      search.has(name),
      `${name} evaporated from the link. This is the bug that has been paid for twice.`,
    );
  }
});

test("THE DEFECT, the round trip: a link parses back to the state it came from", () => {
  const href = hrefWith(FULLY_SET);
  const back = readView(new URLSearchParams(href.split("?")[1] ?? ""));
  assert.deepEqual(back, FULLY_SET);
});

test("every override still carries all the others", () => {
  // One at a time, because the real failure was always one link overriding one
  // field and rebuilding the rest by hand.
  for (const name of PARAM_NAMES) {
    const href = hrefWith(FULLY_SET, { [name]: DEFAULTS[name] });
    const search = new URLSearchParams(href.split("?")[1] ?? "");
    for (const other of PARAM_NAMES) {
      if (other === name) continue;
      assert.ok(search.has(other), `overriding ${name} dropped ${other}`);
    }
  }
});

test("a pagination link keeps the whole view", () => {
  const search = new URLSearchParams(hrefWith(FULLY_SET, { page: 4 }).split("?")[1]);
  assert.equal(search.get("page"), "4");
  for (const name of ["view", "group", "sort", "dir", "size", "role", "q", "tag", "trash", "key"]) {
    assert.ok(search.has(name), `pagination dropped ${name}`);
  }
});

test("a chip link keeps the whole view and resets the page", () => {
  // Changing the filter must go back to page one, or the reader lands on an
  // empty page three of a narrower result.
  const search = new URLSearchParams(
    hrefWith(FULLY_SET, { role: "icon", page: 1 }).split("?")[1],
  );
  assert.equal(search.get("role"), "icon");
  assert.ok(!search.has("page"), "page 1 is the default and is omitted");
  assert.ok(search.has("view") && search.has("sort") && search.has("q"));
});

test("PARAM_NAMES is derived from DEFAULTS, so the two cannot disagree", () => {
  // The previous incidents were two lists drifting apart. There is one list.
  assert.deepEqual(PARAM_NAMES, Object.keys(DEFAULTS));
  assert.ok(PARAM_NAMES.length >= 10);
});

test("defaults are omitted, so the bare URL is the default view", () => {
  assert.equal(hrefWith(DEFAULTS), "/admin/media");
  assert.equal(hrefWith({ ...DEFAULTS, view: "grid" }), "/admin/media?view=grid");
});

test("LIST is the default, because most of this library is not images", () => {
  assert.equal(DEFAULTS.view, "list");
  assert.equal(readView(params({})).view, "list");
});

test("readView is total: unrecognised values fall back rather than throwing", () => {
  const s = readView(
    params({
      view: "carousel",
      group: "galaxy",
      sort: "vibes",
      dir: "sideways",
      size: "xxl",
      page: "-4",
    }),
  );
  assert.equal(s.view, DEFAULTS.view);
  assert.equal(s.group, DEFAULTS.group);
  assert.equal(s.sort, DEFAULTS.sort);
  assert.equal(s.dir, DEFAULTS.dir);
  assert.equal(s.size, DEFAULTS.size);
  assert.equal(s.page, 1);
});

test("an absent role is the default and `all` is a real choice", () => {
  // This distinction predates the module and is load-bearing: an empty ?role=
  // is not "no filter", it is the absence of the parameter.
  assert.equal(readView(params({})).role, "content");
  assert.equal(readView(params({ role: "all" })).role, "all");
});

test("q is trimmed and tag is lowercased, once, where everything reads them", () => {
  const s = readView(params({ q: "  Logo  ", tag: "  ICON " }));
  assert.equal(s.q, "Logo");
  assert.equal(s.tag, "icon");
});

test("trash is a flag, and only the literal 1 turns it on", () => {
  assert.equal(readView(params({ trash: "1" })).trash, true);
  assert.equal(readView(params({ trash: "true" })).trash, false);
  assert.equal(readView(params({})).trash, false);
  assert.ok(hrefWith({ ...DEFAULTS, trash: true }).includes("trash=1"));
  assert.ok(!hrefWith(DEFAULTS).includes("trash"));
});

test("isModified ignores the page, because paging is navigation not a setting", () => {
  assert.equal(isModified(DEFAULTS), false);
  assert.equal(isModified({ ...DEFAULTS, page: 5 }), false);
  assert.equal(isModified({ ...DEFAULTS, sort: "name" }), true);
  assert.equal(isModified({ ...DEFAULTS, q: "logo" }), true);
});

test("the option lists are non-empty and their defaults are members", () => {
  // A default outside its own list would make every oneOf fall back forever.
  assert.ok(VIEWS.includes(DEFAULTS.view));
  assert.ok(GROUPS.includes(DEFAULTS.group));
  assert.ok(SORTS.includes(DEFAULTS.sort));
  assert.ok(DIRS.includes(DEFAULTS.dir));
  assert.ok(SIZES.includes(DEFAULTS.size));
});

test("the display summary names all three settings it hides", () => {
  assert.equal(displaySummary(DEFAULTS), "Flat · Newest · M");
  assert.equal(
    displaySummary({ ...DEFAULTS, group: "folder", sort: "size", size: "l" }),
    "Folder · Largest · L",
  );
});

test("house style: no wide dash reaches the summary separator", () => {
  // The separator is the one place a dash would be reached for, and the hook
  // that guards house style cannot see a rendered string. Built with
  // fromCharCode so this file does not itself carry what it forbids.
  const WIDE = [0x2014, 0x2013].map((c) => String.fromCharCode(c));
  for (const state of [DEFAULTS, { ...DEFAULTS, group: "month", sort: "usage" }]) {
    for (const dash of WIDE) {
      assert.ok(!displaySummary(state).includes(dash));
    }
  }
});

/* ---------------------------------------------------------------- grouping */

test("GROUPING IS PAGE-LOCAL: it arranges the rows it is given and fetches nothing", () => {
  // The contract, asserted as a property rather than described: every input row
  // appears exactly once across the groups, and no row appears that was not in
  // the input. A grouper that reached for more data would break the first half;
  // one that dropped a row would break the second.
  const rows = [
    { key: "/publications/a.pdf", uploaded: null },
    { key: "aaaa000000000000.png", uploaded: "2026-03-02T10:00:00.000Z" },
    { key: "/publications/b.pdf", uploaded: null },
  ];
  const out = groupRows(rows, "folder");
  const flat = out.flatMap((g) => g.rows);
  assert.equal(flat.length, rows.length);
  assert.deepEqual(new Set(flat.map((r) => r.key)), new Set(rows.map((r) => r.key)));
});

test("flat is one group with no heading, so the component renders no header", () => {
  const rows = [{ key: "a.png", uploaded: null }];
  assert.deepEqual(groupRows(rows, "flat"), [{ label: "", rows }]);
  // An unrecognised value falls back to flat rather than producing no groups,
  // which would render an empty page for a hand-edited URL.
  assert.deepEqual(groupRows(rows, "galaxy"), [{ label: "", rows }]);
});

test("SORT ORDER SURVIVES GROUPING, within a group and between groups", () => {
  // The rows arrive sorted by SQL. Grouping must not resort them, or the
  // reader's chosen sort silently stops applying the moment they group.
  const rows = [
    { key: "/b/3.png", uploaded: null },
    { key: "/a/2.png", uploaded: null },
    { key: "/b/1.png", uploaded: null },
  ];
  const out = groupRows(rows, "folder");
  assert.deepEqual(out.map((g) => g.label), ["/b", "/a"], "groups appear in first-row order");
  assert.deepEqual(out[0].rows.map((r) => r.key), ["/b/3.png", "/b/1.png"], "order within a group");
});

test("folders: a static path has one, a content-addressed key says so", () => {
  assert.equal(folderOf("/publications/a-paper.pdf"), "/publications");
  assert.equal(folderOf("/logo.svg"), "Uploads", "a root-level path has no meaningful folder");
  assert.equal(folderOf("1234abcd5678ef90.png"), "Uploads");
  assert.equal(folderOf("/phage-hunters/2019/x.jpg"), "/phage-hunters/2019");
});

test("months are UTC, so two readers never disagree about the heading", () => {
  // 23:30 UTC on the last day of a month is the case that moves under a local
  // timezone, and two people describing the same library must not disagree.
  assert.equal(monthOf("2026-03-31T23:30:00.000Z"), "March 2026");
  assert.equal(monthOf("2026-01-01T00:00:00.000Z"), "January 2026");
});

test("a row with no upload date gets its own bucket, not the nearest month", () => {
  assert.equal(monthOf(null), "No upload date");
  assert.equal(monthOf(undefined), "No upload date");
  assert.equal(monthOf("not a date"), "No upload date");
  const out = groupRows(
    [{ key: "a.png", uploaded: null }, { key: "b.png", uploaded: "2026-03-02T00:00:00.000Z" }],
    "month",
  );
  assert.equal(out.length, 2);
  assert.ok(out.some((g) => g.label === "No upload date"));
});

test("an empty page groups to nothing rather than to one empty heading", () => {
  assert.deepEqual(groupRows([], "folder"), []);
  assert.deepEqual(groupRows([], "month"), []);
});
