import test from "node:test";
import assert from "node:assert/strict";

import { PUBLICATIONS, legacyAddress, publicationListing, soleTopic, venue } from "../app/lib/publications/listing.mjs";

/* The publication index's pure half (app/lib/publications/listing.mjs): what the catalog shows for an address, what
 * the old parameters become, and which addresses canonicalise to themselves. Papers here are minimal. */

/** @param {Record<string, unknown>} over */
function paper(over) {
  return {
    id: "x",
    slug: "x",
    title: "A paper",
    authors: ["A Author"],
    journal: "Journal of Tests",
    volume: "3",
    pages: "10-20",
    year: 2024,
    type: "article",
    topics: [],
    selected: false,
    isOpenAccess: false,
    ...over,
  };
}

const PAPERS = [
  paper({ id: "a", title: "Phage genomes", year: 2025, topics: ["bacteriophages"], selected: true, isOpenAccess: true }),
  paper({ id: "b", title: "REV in turkeys", year: 2025, topics: ["avian-retroviruses"] }),
  paper({ id: "c", title: "HTLV-1 p12", year: 2020, topics: ["human-simian-retroviruses"], selected: true }),
  paper({ id: "d", title: "A meeting abstract", year: 2023, type: "abstract" }),
  paper({ id: "e", title: "Teaching phage discovery", year: 2019, type: "teaching-resource", topics: ["science-education", "bacteriophages"] }),
];

const at = (query) => new URLSearchParams(query);
const ids = (rows) => rows.map((p) => p.id);

test("conference abstracts stay out of the index, and the rest come newest first under a heading for each year", () => {
  const { items, result, total } = publicationListing(at(""), PAPERS);
  assert.equal(total, 4);
  assert.deepEqual(ids(items), ["a", "b", "c", "e"]);
  assert.deepEqual(result.groups.map((g) => [g.label, ids(g.rows)]), [["2025", ["a", "b"]], ["2020", ["c"]], ["2019", ["e"]]]);
});

test("a search or another sort is a flat table, and a topic filter keeps the headings", () => {
  assert.equal(publicationListing(at("q=phage"), PAPERS).result.groups, null);
  assert.equal(publicationListing(at("sort=year"), PAPERS).result.groups, null);
  assert.equal(publicationListing(at("sort=title"), PAPERS).result.groups, null);
  const byTopic = publicationListing(at("topic=bacteriophages"), PAPERS);
  assert.deepEqual(byTopic.result.groups.map((g) => g.label), ["2025", "2019"]);
  assert.deepEqual(ids(publicationListing(at("sort=year"), PAPERS).items), ["e", "c", "a", "b"], "oldest first");
});

test("topic facets count what choosing them would give, and topics combine with or", () => {
  const topic = publicationListing(at(""), PAPERS).result.facets.find((f) => f.key === "topic");
  assert.deepEqual(topic.options.map((o) => [o.value, o.count]), [
    ["human-simian-retroviruses", 1],
    ["avian-retroviruses", 1],
    ["bacteriophages", 2],
    ["science-education", 1],
  ], "in the order the topics are declared");
  assert.deepEqual(ids(publicationListing(at("topic=avian-retroviruses&topic=science-education"), PAPERS).items), ["b", "e"]);
});

test("?selected=1 keeps the papers marked selected, as the page's Selected filter always did", () => {
  assert.deepEqual(ids(publicationListing(at("selected=1"), PAPERS).items), ["a", "c"]);
});

test("search ranks a title match first and finds an author or a journal", () => {
  const authors = [paper({ id: "p", title: "Alpha", authors: ["Zed Quill"] }), paper({ id: "q", title: "Quill methods", authors: ["Someone Else"] })];
  assert.deepEqual(ids(publicationListing(at("q=quill"), authors).items), ["q", "p"]);
  assert.deepEqual(ids(publicationListing(at("q=tests"), PAPERS).items).sort(), ["a", "b", "c", "e"], "the journal is searched");
});

test("the old parameters are sent once to the same view at the catalog's address, and nothing else is moved", () => {
  const move = (query) => legacyAddress(new URL(`https://example.test/research/publications${query}`));
  assert.equal(move("?sort=year-asc"), "/research/publications?sort=year");
  assert.equal(move("?sort=year-desc"), "/research/publications");
  assert.equal(move("?selected=true&topic=bacteriophages"), "/research/publications?topic=bacteriophages&selected=1");
  assert.equal(move("?q=phage&sort=year-asc"), "/research/publications?q=phage&sort=year");
  assert.equal(move(""), null);
  assert.equal(move("?sort=title"), null, "a spelling the catalog also uses is left alone");
  assert.equal(move("?topic=bacteriophages"), null);
  assert.equal(move("?selected=1"), null);
});

test("exactly the bare single-topic addresses canonicalise to themselves", () => {
  assert.equal(soleTopic(at("topic=bacteriophages")), "bacteriophages");
  assert.equal(soleTopic(at("")), null);
  assert.equal(soleTopic(at("topic=bacteriophages&topic=avian-retroviruses")), null, "two topics are a subset");
  assert.equal(soleTopic(at("topic=bacteriophages&q=x")), null);
  assert.equal(soleTopic(at("topic=bacteriophages&sort=title")), null);
  assert.equal(soleTopic(at("topic=bacteriophages&selected=1")), null);
  assert.equal(soleTopic(at("topic=bacteriophages&utm_source=x")), null, "an unknown parameter is never canonical");
  assert.equal(soleTopic(at("topic=not-a-topic")), null);
});

test("the venue is the journal, volume and pages with entities decoded, and the year is its own column", () => {
  assert.equal(venue(paper({ journal: "Smith &amp; Sons Journal", volume: "7", pages: "1-2" })), "Smith & Sons Journal, 7, 1-2");
  assert.equal(venue(paper({ journal: null, volume: null, pages: null })), "");
  assert.ok(PUBLICATIONS.fields.find((f) => f.key === "year").column.hideWhenGrouped);
});

test("the span the header states is counted over the papers shown", () => {
  const { span } = publicationListing(at("topic=bacteriophages"), PAPERS);
  assert.deepEqual(span, { papers: 2, firstYear: 2019, lastYear: 2025, venues: 1 });
});
