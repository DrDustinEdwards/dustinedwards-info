/* Another academic shares the surname, so structured data may join an author to the owner only
 * through the exact alias table, never a surname-plus-initial rule. */

import test from "node:test";
import assert from "node:assert/strict";

import { isSiteOwner, publicationsJsonLd } from "../app/lib/seo.ts";

test("every spelling of the owner in the corpus is the owner", () => {
  for (const name of ["Dustin Edwards", "Dustin C. Edwards", "Dustin Cole Edwards", " Dustin  Edwards "]) {
    assert.equal(isSiteOwner(name), true, name);
  }
});

test("A CO-AUTHOR WITH A D AND THE SAME SURNAME IS NOT THE OWNER", () => {
  for (const name of ["David Edwards", "D. Edwards", "Dana M. Edwards", "Julie Edwards"]) {
    assert.equal(isSiteOwner(name), false, name);
  }
});

test("a co-author's name reaches JSON-LD decoded, and only the owner becomes an @id", () => {
  const [, article] = publicationsJsonLd("https://example.test", [
    {
      title: "A paper",
      authors: ["Dustin C. Edwards", "David Edwards", "Jo&#233;l Ng", "Tom O&apos;Brien"],
      year: 2024,
      journal: null,
      doi: "10.1000/x",
      pdfPath: null,
    },
  ]);
  assert.deepEqual(article.author, [
    { "@id": "https://example.test/#person" },
    { "@type": "Person", name: "David Edwards" },
    { "@type": "Person", name: "Joél Ng" },
    { "@type": "Person", name: "Tom O'Brien" },
  ]);
});
