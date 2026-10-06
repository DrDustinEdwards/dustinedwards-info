import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { ProcedureView } from "~/components/procedure";
import Lab, { loader as labLoader } from "~/routes/lab";
import LabKind, { loader as kindLoader } from "~/routes/lab.kind";
import { loader as twinLoader } from "~/routes/lab[.md]";
import Protocols, { loader as protocolsLoader } from "~/routes/protocols";
import { loader as sitemapLoader } from "~/routes/sitemap";

import { renderRoute, routeContext, textsOf } from "./route-helpers";
import { seedPages, seedPhages, seedProcedures, seedRegistry } from "./seed";

/* The lab registry's pages (docs/REGISTRY.md), read from the rows build:content compiles: the master inventory with the
 * phages beside the primers, the primers page with its computed columns, one primer with the protocols that use it, the
 * twins, the sitemap and the library's Primers tab. Seeded the way sync:content writes them. */

const ORIGIN = "https://example.com";
const ctx = () => routeContext();
const request = (path: string) => new Request(`${ORIGIN}${path}`);

beforeAll(async () => {
  await env.DB.prepare("DELETE FROM registry").run();
  await seedRegistry();
  await seedPhages();
  await seedProcedures();
  await seedPages();
});

const inventory = async (search = "") => {
  const loaderData = await labLoader({ request: request(`/research/lab${search}`), params: {}, context: ctx() } as never);
  return { loaderData, html: renderRoute("/research/lab", Lab, { loaderData }, `/research/lab${search}`) };
};
const kindPage = async (kind: string, id?: string, search = "") => {
  const path = `/research/lab/${kind}${id ? `/${id}` : ""}`;
  const loaderData = await kindLoader({ request: request(`${path}${search}`), params: { kind, id }, context: ctx() } as never);
  return { loaderData, html: renderRoute(path, LabKind, { loaderData }, `${path}${search}`) };
};
const twin = (params: { kind?: string; id?: string }) => twinLoader({ params, context: ctx() } as never) as Promise<Response>;

describe("the master inventory", () => {
  it("lists every primer and every phage in one catalog, filterable by kind, with nothing copied", async () => {
    const { loaderData, html } = await inventory();
    const kinds = new Map<string, number>();
    for (const row of loaderData.rows) kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
    expect(kinds.get("primer")).toBe(12);
    expect(kinds.get("strain")).toBe(2);
    expect(kinds.get("phage")).toBe(75);
    expect(html).toContain("12 primers, 2 strains, 16 reagents, 75 phages");
    expect(html).toContain('href="/research/lab/strains/foliorum"');
    expect(html).toContain('href="/research/lab/primers/lco1490"');
    // A phage's row links to its own section on the phages page, and the registry holds no phage row of its own.
    expect(html).toContain('href="/research/phages#acorn15"');
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM registry WHERE kind = 'phage'").first<{ n: number }>())?.n).toBe(0);
    // The Kind facet offers both kinds with their counts.
    expect(html).toMatch(/name="kind"[^>]*value="primer"/);
    expect(html).toMatch(/name="kind"[^>]*value="phage"/);
  });

  it("filters by kind through the address, and an address written another way goes to its one address", async () => {
    const { loaderData } = await inventory("?kind=primer");
    const shown = (loaderData as { rows: Array<{ kind: string }> }).rows.filter((row) => row.kind === "primer");
    expect(shown).toHaveLength(12);
    await expect(inventory("?sort=kind")).rejects.toMatchObject({ status: 301 });
  });

  it("says what it does not keep: stock and places are not a registry fact", async () => {
    expect((await inventory()).html).toContain("never how much of it the lab has or where it sits");
  });
});

describe("the primers page", () => {
  it("shows each sequence as stored with its length and melting temperature computed, and states the method and conditions", async () => {
    const { html } = await kindPage("primers");
    expect(html).toContain("<code");
    expect(html).toContain("CATACTGAGCCAATGGTT");
    // Length 18 and the computed Tm (51.7 °C) for the REV 3' LTR forward primer, in its row.
    expect(html).toContain("51.7");
    expect(html).toContain("SantaLucia (1998) unified nearest-neighbour model");
    expect(html).toContain("50 mM monovalent cation and 0.5 µM primer");
    // The direction and target facets are the primers' own.
    expect(html).toMatch(/name="direction"[^>]*value="forward"/);
    expect(html).toMatch(/name="target"/);
  });

  it("answers 404 for a kind with no records or view yet, and for a kind that does not exist", async () => {
    for (const kind of ["equipment", "gadgets"]) {
      await expect(kindPage(kind)).rejects.toMatchObject({ init: { status: 404 } });
    }
  });
});

describe("one primer", () => {
  it("states its sequence, its reverse complement, its pair, the pair's product and where it came from, all from its record", async () => {
    const { html } = await kindPage("primers", "rev-3-ltr-forward");
    expect(html).toContain("<h1");
    expect(html).toContain("REV 3′ LTR forward");
    expect(html).toContain("CATACTGAGCCAATGGTT");
    // The reverse complement is computed, not stored.
    expect(html).toContain("AACCATTGGCTCAGTATG");
    expect(html).toContain('href="/research/lab/primers/rev-3-ltr-reverse"');
    expect(html).toContain("281 bp");
    expect(html).toContain("18 nt");
    // Position and product are computed on the named reference, and a paper that could not be read says so.
    expect(html).toContain("DQ387450.1");
    expect(html).toContain("258 to 275");
    expect(html).toContain("Not found:");
  });

  it("shows the pair's product on the reverse primer too, though it is stated once, on the forward", async () => {
    const { html } = await kindPage("primers", "rev-3-ltr-reverse");
    expect(html).toContain("281 bp");
    const stored = await env.DB.prepare("SELECT record FROM registry WHERE kind = 'primer' AND id = 'rev-3-ltr-reverse'").first<{ record: string }>();
    expect(JSON.parse(stored?.record ?? "{}").product).toBeUndefined();
  });

  it("links the protocols that use it, found by its sequence and listed nowhere on the primer", async () => {
    const { html } = await kindPage("primers", "lco1490");
    expect(html).toContain('href="/research/protocols/coi-primers"');
    expect(html).toContain("710 bp");
    expect(html).toContain("709 bp");
    const stored = await env.DB.prepare("SELECT record FROM registry WHERE kind = 'primer' AND id = 'lco1490'").first<{ record: string }>();
    expect(Object.keys(JSON.parse(stored?.record ?? "{}"))).not.toContain("protocols");
  });

  it("answers 404 for an item that does not exist, and a draft is the admin's alone", async () => {
    await expect(kindPage("primers", "no-such-primer")).rejects.toMatchObject({ init: { status: 404 } });
    await env.DB.prepare("UPDATE registry SET status = 'draft' WHERE kind = 'primer' AND id = 'hco2198'").run();
    try {
      await expect(kindPage("primers", "hco2198")).rejects.toMatchObject({ init: { status: 404 } });
      expect((await inventory()).html).not.toContain("/research/lab/primers/hco2198");
    } finally {
      await env.DB.prepare("UPDATE registry SET status = 'published' WHERE kind = 'primer' AND id = 'hco2198'").run();
    }
  });
});

const phagesOn = async (host: string) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM phages WHERE json_extract(record, '$.host') = ?1").bind(host).first<{ n: number }>())?.n ?? 0;

describe("the strains page", () => {
  it("lists the two strains with their collection numbers and the phages counted from the phages table", async () => {
    const { html } = await kindPage("strains");
    expect(html).toContain("Microbacterium foliorum NRRL B-24224");
    expect(html).toContain("Mycobacterium smegmatis mc²155");
    expect(html).toContain("ATCC");
    expect(html).toContain("700084");
    expect(html).toContain(String(await phagesOn("foliorum")));
    await expect(kindPage("strains", undefined, "?sort=name")).rejects.toMatchObject({ status: 301 });
  });
});

describe("one strain", () => {
  it("states the organism, the collection, the Guide's page and the biosafety level, and lists its phages and its protocols, all computed", async () => {
    const { html } = await kindPage("strains", "foliorum");
    expect(html).toContain("<h1");
    expect(html).toContain("Microbacterium foliorum");
    expect(html).toContain("NRRL B-24224");
    expect(html).toContain('href="https://seaphagesphagediscoveryguide.helpdocsonline.com/4-1-mfoliorum"');
    expect(html).toContain("BSL-1");
    expect(html).toContain(`${await phagesOn("foliorum")} phages, found `);
    expect(html).toContain('href="/research/protocols/phage-isolation"');
    const stored = await env.DB.prepare("SELECT record FROM registry WHERE kind = 'strain' AND id = 'foliorum'").first<{ record: string }>();
    for (const field of ["phages", "protocols", "designation"]) expect(Object.keys(JSON.parse(stored?.record ?? "{}"))).not.toContain(field);
  });

  it("answers 404 for a strain that does not exist, and serves its twin", async () => {
    await expect(kindPage("strains", "no-such-strain")).rejects.toMatchObject({ init: { status: 404 } });
    const text = await (await twin({ kind: "strains", id: "smegmatis" })).text();
    expect(text).toContain("# Mycobacterium smegmatis mc²155");
    expect(text).toContain("- Collection: ATCC 700084");
    expect(text).toContain("- Biosafety level: BSL-1");
    expect(text).toContain("/research/protocols/phage-isolation");
    expect(await (await twin({ kind: "strains" })).text()).toContain("| Strain | Organism | Collection | Collection number | Phages isolated |");
  });

  it("is on the protocol that uses it, as a link from its Host strain fact", async () => {
    const stored = await env.DB.prepare("SELECT record FROM procedures WHERE slug = 'phage-isolation'").first<{ record: string }>();
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: JSON.parse(stored?.record ?? "{}"), count: 1, factor: 1 }));
    expect(html).toContain('<a href="/research/lab/strains/foliorum">Microbacterium foliorum NRRL B-24224</a>');
  });
});

describe("the twins", () => {
  it("serve the inventory, the primers and one primer as markdown with the registry's cache tags and a canonical link", async () => {
    const inv = await twin({});
    expect(inv.status).toBe(200);
    expect(inv.headers.get("content-type")).toContain("text/markdown");
    expect(inv.headers.get("cache-tag")).toContain("registry");
    expect(inv.headers.get("link")).toBe(`<https://dustinedwards.info/research/lab>; rel="canonical"`);
    const invText = await inv.text();
    expect(invText).toContain("# Lab registry");
    expect(invText).toContain("[LCO1490](https://dustinedwards.info/research/lab/primers/lco1490)");
    expect(invText).toContain("Phage");

    const list = await (await twin({ kind: "primers" })).text();
    expect(list).toContain("`CATACTGAGCCAATGGTT`");
    expect(list).toContain("SantaLucia (1998)");

    const one = await twin({ kind: "primers", id: "rev-3-ltr-forward" });
    expect(one.headers.get("link")).toBe(`<https://dustinedwards.info/research/lab/primers/rev-3-ltr-forward>; rel="canonical"`);
    const text = await one.text();
    expect(text).toContain("281 bp");
    expect(text).toContain("DQ387450.1");
    expect(text).toContain("- Reverse complement (5′ to 3′): `AACCATTGGCTCAGTATG`");
  });

  it("answer 404 for what has no page", async () => {
    expect((await twin({ kind: "equipment" })).status).toBe(404);
    expect((await twin({ kind: "strains", id: "nothing" })).status).toBe(404);
    expect((await twin({ kind: "primers", id: "nothing" })).status).toBe(404);
  });
});

describe("the rest of the site finds it", () => {
  it("lists the inventory, the primers page and every primer in the sitemap", async () => {
    const response = (await sitemapLoader({ context: ctx(), params: {}, request: request("/sitemap.xml") } as never)) as Response;
    const xml = await response.text();
    expect(xml).toContain("<loc>https://dustinedwards.info/research/lab</loc>");
    expect(xml).toContain("<loc>https://dustinedwards.info/research/lab/primers</loc>");
    expect(xml).toContain("<loc>https://dustinedwards.info/research/lab/primers/lco1490</loc>");
    expect(response.headers.get("cache-tag")).toContain("registry");
  });

  it("gives the protocol library a Primers tab with its count, beside the calculators", async () => {
    const loaderData = await protocolsLoader({ request: request("/research/protocols"), params: {}, context: ctx() } as never);
    const html = renderRoute("/research/protocols", Protocols, { loaderData });
    const tabs = await textsOf(html, ".cap-tabs a, [role=tablist] a, nav a");
    expect(html).toContain('href="/research/lab/primers"');
    expect(tabs.some((t) => /Primers/.test(t) && /12/.test(t))).toBe(true);
    expect(html.indexOf("Calculators")).toBeLessThan(html.indexOf('href="/research/lab/primers"'));
  });
});

describe("the melting temperature is an estimate, never an annealing temperature", () => {
  const ALLOWED = [
    "The Tm estimate is not an annealing temperature.",
    "For the annealing temperature of a particular polymerase, use the",
    "Annealing temperature",
    "Depends on the polymerase:",
  ];
  const stripped = (html: string) => ALLOWED.reduce((text, phrase) => text.replaceAll(phrase, ""), html);

  it("every primer page links NEB's calculator for the polymerase-specific annealing temperature", async () => {
    for (const id of ["lco1490", "hco2198", "rev-3-ltr-forward", "gapdh-reverse", "lpdv-p31-ca-reverse"]) {
      const { html } = await kindPage("primers", id);
      expect(html, id).toContain('href="https://tmcalculator.neb.com/"');
      expect(html, id).toContain("NEB Tm Calculator");
      expect(html, id).toContain("Melting temperature estimate (Tm)");
    }
  });

  it("the primers page and each primer page say it is an estimate and say nothing else about annealing", async () => {
    for (const html of [(await kindPage("primers")).html, (await kindPage("primers", "rev-3-ltr-forward")).html]) {
      expect(html).toContain("is an estimate for comparing primers");
      expect(html).toContain("The Tm estimate is not an annealing temperature.");
      const body = /<main[\s\S]*<\/main>/.exec(stripped(html))?.[0] ?? stripped(html);
      expect(body).not.toMatch(/annealing/i);
    }
  });

  it("the twins carry the same sentences and the markdown link", async () => {
    for (const text of [await (await twin({ kind: "primers" })).text(), await (await twin({ kind: "primers", id: "lco1490" })).text()]) {
      expect(text).toContain("The Tm estimate is not an annealing temperature.");
      expect(text).toContain("https://tmcalculator.neb.com/");
    }
    expect(await (await twin({ kind: "primers", id: "lco1490" })).text()).toContain("- Annealing temperature: depends on the polymerase; use the [NEB Tm Calculator](https://tmcalculator.neb.com/)");
  });
});

describe("the reagents table", () => {
  it("is one table: name, supplier, catalog number, a link, and the protocols that use each", async () => {
    const { html } = await kindPage("reagents");
    expect(html).toContain("GoTaq® Flexi DNA polymerase");
    expect(html).toContain("Promega");
    expect(html).toContain("M8296");
    expect(html).toContain('href="https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296"');
    expect(html).toContain("New England Biolabs");
    expect(html).toContain("100 bp DNA ladder");
    expect(html).toContain("Zinc chloride (ZnCl2)");
    expect(html).toContain('href="/research/protocols/phage-dna-extraction"');
    expect(html).toContain('href="/research/protocols/coi-primers"');
    await expect(kindPage("reagents", undefined, "?sort=name")).rejects.toMatchObject({ status: 301 });
    expect((await inventory()).html).toContain("12 primers, 2 strains, 16 reagents, 75 phages");
  });

  it("says Prepared in lab for what the lab makes, with the recipe link as a gap that says why, and says what no record states", async () => {
    const { html } = await kindPage("reagents");
    expect(html).toContain("Prepared in lab");
    expect(html).toContain("No procedure with the recipe profile exists yet for the lab&#x27;s PYCa");
    expect(html).toContain("Not found:");
    expect(html).toContain("who supplies the lab&#x27;s zinc chloride");
  });

  it("has no page for a reagent, no twin for one, and none in the sitemap: no redirect either", async () => {
    await expect(kindPage("reagents", "zinc-chloride")).rejects.toMatchObject({ init: { status: 404 } });
    await expect(kindPage("reagents", "no-such-reagent")).rejects.toMatchObject({ init: { status: 404 } });
    expect((await twin({ kind: "reagents", id: "zinc-chloride" })).status).toBe(404);
    const xml = await ((await sitemapLoader({ context: ctx(), params: {}, request: request("/sitemap.xml") } as never)) as Response).text();
    expect(xml).toContain("<loc>https://dustinedwards.info/research/lab/reagents</loc>");
    expect(xml).not.toContain("/research/lab/reagents/");
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM search_docs WHERE doc_uid LIKE 'registry:reagent/%'").first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  it("serves the table as markdown, with every gap and its reason listed", async () => {
    const text = await (await twin({ kind: "reagents" })).text();
    expect(text).toContain("| Reagent | Supplier | Catalog number | Link | Protocols |");
    expect(text).toContain("| GoTaq® Flexi DNA polymerase | Promega | M8296 |");
    expect(text).toContain("Not found:");
    expect(text).toContain("- PYCa, recipe: No procedure with the recipe profile exists yet");
  });

  it("is on the protocol that uses it, in its Reagents table, with where each comes from", async () => {
    const stored = await env.DB.prepare("SELECT record FROM procedures WHERE slug = 'phage-dna-extraction'").first<{ record: string }>();
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: JSON.parse(stored?.record ?? "{}"), count: 1, factor: 1 }));
    expect(html).toContain('<th scope="col">Source</th>');
    expect(html).toContain("Not recorded");
    expect(html).toContain("Prepared in the lab");
    expect(html).not.toContain("/research/lab/reagents/");
  });
});
