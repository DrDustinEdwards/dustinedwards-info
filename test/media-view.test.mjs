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
  confirmationSatisfied,
  DEFAULTS,
  DIRS,
  GROUPS,
  PARAM_NAMES,
  SIZES,
  SORTS,
  VIEWS,
  SORT_DEFAULT_DIR,
  displaySummary,
  docTitle,
  folderOf,
  groupRows,
  hrefWith,
  isModified,
  monthOf,
  readView,
  sortHref,
} from "../app/lib/media/view.mjs";

/** A stand-in for URLSearchParams with the one method readView uses. */
const params = (entries) => ({ get: (n) => (n in entries ? entries[n] : null) });

/** A state where EVERY field differs from its default. */
const FULLY_SET = {
  view: "grid",
  group: "month",
  sort: "size",
  dir: "asc",
  size: "l",
  role: "brand",
  q: "logo",
  tag: "icon",
  lens: "unattached",
  page: 3,
  trash: true,
  key: "1234abcd5678ef90.png",
  /* The confirmation modal is a URL like everything else here, so it has to
     survive a link like everything else. Added when `confirm` landed, and the
     three evaporation tests above are what demanded it. */
  confirm: "empty-trash",
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
  for (const name of ["view", "group", "sort", "dir", "size", "role", "q", "tag", "lens", "trash", "key"]) {
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
  assert.equal(displaySummary(DEFAULTS), "Folder · Newest · M");
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
  assert.deepEqual(groupRows(rows, "flat"), [{ label: "", note: "", rows }]);
  // An unrecognised value falls back to flat rather than producing no groups,
  // which would render an empty page for a hand-edited URL.
  assert.deepEqual(groupRows(rows, "galaxy"), [{ label: "", note: "", rows }]);
});

test("SORT ORDER SURVIVES GROUPING, within a group", () => {
  // The rows arrive sorted by SQL. Grouping must not resort them WITHIN a
  // section, or the reader's chosen sort silently stops applying.
  const rows = [
    { key: "/b/3.png", uploaded: null },
    { key: "/a/2.png", uploaded: null },
    { key: "/b/1.png", uploaded: null },
  ];
  const out = groupRows(rows, "folder");
  assert.deepEqual(out.map((g) => g.label), ["B", "A"], "derived titles, sentence case");
  assert.deepEqual(out[0].rows.map((r) => r.key), ["/b/3.png", "/b/1.png"], "order within a group");
});

test("FOLDER SECTIONS CARRY THE NOTE, which is the whole point of the grouping", () => {
  const out = groupRows(
    [
      { key: "/publications/a.pdf", uploaded: null },
      { key: "/phage-hunters/x.jpg", uploaded: null },
    ],
    "folder",
  );
  const roster = out.find((g) => g.label === "Cohort photographs");
  assert.ok(roster, "the roster section is titled from the table");
  assert.equal(roster.note, "Placed by the roster page template");
  // The sentence that stops somebody deleting nine photographs.
  assert.ok(roster.note.length > 0);
});

test("folder sections render in TABLE order, roster before publications", () => {
  // Not first-row order: the table is written so the sections a reader wants
  // most come first, and the render honours that.
  const out = groupRows(
    [
      { key: "/publications/a.pdf", uploaded: null },
      { key: "/phage-hunters/x.jpg", uploaded: null },
    ],
    "folder",
  );
  assert.deepEqual(out.map((g) => g.label), ["Cohort photographs", "Publications"]);
});

test("an unknown folder is titled from its own directory, never mislabelled", () => {
  // Sweeping unknown folders into the root section would be the design's own
  // failure mode: a confident wrong label over files it does not describe.
  const out = groupRows([{ key: "/case-studies/x.png", uploaded: null }], "folder");
  assert.equal(out[0].label, "Case studies");
  assert.equal(out[0].note, "", "no invented explanation");
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

/* -------------------------------------------------------------------------
 * SORT DIRECTION, and the two controls that must not disagree about it.
 *
 * The list header and the Display popover are two link builders aimed at one
 * destination. They agreed by accident before there was a header at all; the
 * moment there are two, "they agree" is a property that needs asserting rather
 * than assuming, and it is asserted HERE on the pure function and again in
 * check:admin-ui over the rendered hrefs. Two instruments, because this one
 * cannot see whether the component actually calls it.
 * ---------------------------------------------------------------------- */

test("every sort key declares a default direction, and no key is invented", () => {
  // BOTH DIRECTIONS. A missing entry would silently fall back to the state's
  // current direction, which is the defect this table exists to remove, and an
  // orphaned entry would be a column nobody can reach.
  assert.deepEqual(
    Object.keys(SORT_DEFAULT_DIR).sort(),
    [...SORTS].sort(),
    "SORT_DEFAULT_DIR and SORTS must name the same set, both ways",
  );
  for (const [key, dir] of Object.entries(SORT_DEFAULT_DIR)) {
    assert.ok(DIRS.includes(dir), `${key} declares ${dir}, which is not a direction`);
  }
});

test("the mockup's directions, verified in its source, are the ones shipped", () => {
  // Read out of the mockup's own `column(key, label, align, dir)` calls and its
  // sortOpts table, not from the prompt describing them.
  assert.equal(SORT_DEFAULT_DIR.name, "asc");
  assert.equal(SORT_DEFAULT_DIR.usage, "asc");
  assert.equal(SORT_DEFAULT_DIR.size, "desc");
  assert.equal(SORT_DEFAULT_DIR.added, "desc");
});

/**
 * READ THE URL BACK THROUGH `readView`, never off the query string.
 *
 * `hrefWith` OMITS a parameter equal to its default, deliberately, so the bare
 * `/admin/media` stays meaningful as "the default view". `dir=desc` IS the
 * default and is therefore absent from a descending link. Asserting on the
 * spelling would have made a correct URL fail; this test found that, which is
 * the right way round.
 *
 * So the property is the direction the link MEANS, which is what the loader
 * will see, and the round trip is the only honest way to ask.
 *
 * @param {string} href
 */
const resolve = (href) => readView(new URLSearchParams(href.split("?")[1] ?? ""));

test("a sort choice carries its direction, so Largest is never the smallest", () => {
  // The state is ASCENDING and sorted by name. Asking for size must not inherit
  // that ascending, or the reader presses Largest and gets the smallest file.
  const state = { ...DEFAULTS, sort: "name", dir: "asc", q: "bio" };
  const got = resolve(sortHref(state, "size"));
  assert.equal(got.sort, "size");
  assert.equal(got.dir, "desc", "Largest must mean descending");
  assert.equal(got.q, "bio", "and the search still travels");
});

test("the header toggles the column already sorted, and only that one", () => {
  const state = { ...DEFAULTS, sort: "size", dir: "desc" };
  assert.equal(
    resolve(sortHref(state, "size", { toggle: true })).dir,
    "asc",
    "pressing the active column reverses it",
  );

  // A DIFFERENT column ignores the toggle and takes its own default, because
  // "reverse it" is meaningless for a column you are not sorted by.
  const other = resolve(sortHref(state, "name", { toggle: true }));
  assert.equal(other.dir, "asc", "name's own default, not size's reversal");
  assert.equal(other.sort, "name");

  // And the reverse toggle, so the assertion above cannot pass on a function
  // that always returns "asc".
  const ascending = { ...DEFAULTS, sort: "size", dir: "asc" };
  assert.equal(resolve(sortHref(ascending, "size", { toggle: true })).dir, "desc");
});

test("header and popover produce IDENTICAL urls for any column not sorted", () => {
  // This is the property the prompt names, asserted mechanically over every
  // key rather than spot-checked on one. The popover does not toggle; the
  // header does, so they can only differ on the ACTIVE key.
  const state = { ...DEFAULTS, sort: "added", dir: "desc", q: "phage", tag: "roster", page: 4 };
  let compared = 0;
  for (const key of SORTS) {
    if (key === state.sort) continue;
    assert.equal(
      sortHref(state, key, { toggle: true }),
      sortHref(state, key),
      `${key}: the header and the popover must land on one url`,
    );
    compared += 1;
  }
  // SCOPE, so a SORTS that shrank to one entry cannot make this pass by
  // comparing nothing.
  assert.ok(compared >= 3, `only ${compared} column(s) compared`);
});

test("a sort choice always returns to page one", () => {
  const state = { ...DEFAULTS, sort: "name", page: 7 };
  for (const key of SORTS) {
    const got = new URLSearchParams(sortHref(state, key).split("?")[1]);
    assert.equal(got.has("page"), false, `${key} kept a page number from another sort`);
  }
});

/* -------------------------------------------------------------------------
 * THE DOCUMENT TITLE. 31 of 70 rows are PDFs and they currently read as
 * damage: five cards showing `edw...omics.pdf`, `edw...lysis.pdf` and so on,
 * which is the middle-elision doing its job on a string that should never have
 * been shown whole in the first place.
 * ---------------------------------------------------------------------- */

test("a document title is the words, without the slug punctuation or extension", () => {
  assert.equal(docTitle("edwards-2024-phage-genomics.pdf"), "edwards 2024 phage genomics");
  assert.equal(docTitle("syllabus-fall-2026.pdf"), "syllabus fall 2026");
  assert.equal(docTitle("poster_rubric.pdf"), "poster rubric");
});

test("the title is NOT capitalised, because casing a filename asserts authorship", () => {
  const out = docTitle("edwards-2024-phage-genomics.pdf");
  assert.equal(out, out.toLowerCase(), "title casing would guess at proper nouns");
});

test("a document title survives the shapes a real key comes in", () => {
  // No extension at all.
  assert.equal(docTitle("readme"), "readme");
  // Repeated separators collapse rather than leaving a double space.
  assert.equal(docTitle("a--b__c.pdf"), "a b c");
  // A dotted name keeps its interior dots: only the trailing extension goes.
  assert.equal(docTitle("v1.2-notes.pdf"), "v1.2 notes");
  // Empty in, empty out, and no crash: a row with a pathological key must
  // render a card rather than throw the page away.
  assert.equal(docTitle(""), "");
  assert.equal(docTitle(".pdf"), "");
});

/* -------------------------------------------------------------------------
 * THE TYPED-COUNT LADDER.
 *
 * The guard in front of the one irreversible action this page has. It lived
 * inside the route action, where no gate could reach it: the admin-ui harness
 * renders markup and compares submissions, it never runs an action, so deleting
 * the check left every gate green. These are the assertions that were missing.
 * ---------------------------------------------------------------------- */
test("the confirmation passes only on an exact match", () => {
  assert.equal(confirmationSatisfied("3", 3), true);
  assert.equal(confirmationSatisfied(" 3 ", 3), true, "surrounding space is trimmed");
});

test("the confirmation rejects everything adjacent to the count", () => {
  for (const typed of ["", "  ", "03", "3.0", "+3", "3 files", "2", "4", "three", null, undefined]) {
    assert.equal(
      confirmationSatisfied(typed, 3),
      false,
      `expected ${JSON.stringify(typed)} to be rejected for a count of 3`,
    );
  }
});

test("the confirmation refuses a count that is not a positive whole number", () => {
  // A blank confirmation against an empty trash must not read as agreement,
  // which `String(typed) === String(count)` alone would have allowed for "".
  assert.equal(confirmationSatisfied("0", 0), false);
  assert.equal(confirmationSatisfied("", 0), false);
  assert.equal(confirmationSatisfied("-1", -1), false);
  assert.equal(confirmationSatisfied("1.5", 1.5), false);
});
