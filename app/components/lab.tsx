import { Catalog } from "capsomer/react/catalog";
import type { CatalogResult } from "capsomer/behaviour/catalog";

import {
  INVENTORY,
  PRIMERS,
  REAGENTS,
  STRAINS,
  kindLabel,
  mateOf,
  pairProduct,
  phageYearsText,
  productSpanText,
  productText,
  siteText,
  reagentLabel,
  reagentSource,
  tmNote,
  type InventoryRow,
  type PrimerListRow,
  type PrimerRow,
  type ReagentRow,
  type StrainRow,
} from "~/lib/registry/catalog.mjs";
import { MAX_MISMATCHES } from "~/lib/registry/align.mjs";

/**
 * The registry's pages (docs/REGISTRY.md): the master inventory, a kind's own catalog and one item. Each reads the same
 * rows the markdown twin does, and each fact it prints is the record's or is computed from it, so no page types a
 * number the record could contradict.
 */

/** One sentence under the inventory's title: how many of what, counted from the rows. */
export function inventorySentence(rows: InventoryRow[]) {
  if (rows.length === 0) return "Nothing is recorded yet.";
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  const parts = [...counts].map(([kind, n]) => `${n} ${n === 1 ? kindLabel(kind).toLowerCase() : `${kindLabel(kind).toLowerCase()}s`}`);
  return `${parts.join(", ")}.`;
}

export function LabInventory({ rows, result }: { rows: InventoryRow[]; result: CatalogResult<InventoryRow> }) {
  return (
    <>
      <p className="registry-lede">
        The lab&rsquo;s reference catalog: its primers, the bacterial strains its phages grow on and the reagents its protocols use, with the phages it has isolated. It records what a thing is,
        never how much of it the lab has or where it sits. {inventorySentence(rows)}
      </p>
      <div className="registry site-catalog site-catalog-wide">
        <Catalog
          definition={INVENTORY}
          result={result}
          labelledBy="registry-title"
          title={(row) => (
            <a className="cap-table-open" href={row.path}>
              {row.name}
            </a>
          )}
        />
      </div>
    </>
  );
}

const sequenceCell = (p: PrimerListRow) => (p.sequence ? <code className="registry-seq">{p.sequence}</code> : "");

export function LabPrimers({ result }: { result: CatalogResult<PrimerListRow> }) {
  const note = tmNote();
  return (
    <>
      <p className="registry-lede">
        The primers the lab&rsquo;s protocols use, with each sequence as stored. Length, GC content and melting temperature are
        computed from the sequence, and a pair&rsquo;s product is computed from where its primers bind a reference sequence.
      </p>
      <div className="registry site-catalog site-catalog-wide">
        <Catalog
          definition={PRIMERS}
          result={result}
          labelledBy="registry-title"
          title={(p) => (
            <a className="cap-table-open" href={p.path}>
              {p.name}
            </a>
          )}
          cells={{ sequence: sequenceCell, product: (p) => productText(p.product) ?? "" }}
        />
      </div>
      <p className="registry-note">
        {note.statement} The Tm estimate is not an annealing temperature. For the annealing temperature of a particular polymerase, use the{" "}
        <a href={note.calculator.url}>{note.calculator.name}</a>.
      </p>
    </>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** A fact that could not be found, with the reason it could not, so it is listed rather than left out. */
function NotFound({ reason }: { reason: string | null }) {
  return <span className="registry-missing">Not found: {reason ?? "not recorded"}</span>;
}

/** The size a paper states, compared with the one computed, only where the paper states an exact size. */
function publishedVersusComputed(published: string, computed: Array<{ length: number }>) {
  const exact = /^([0-9]+) bp$/.exec(published);
  const sizes = [...new Set(computed.map((p) => p.length))];
  if (!exact || sizes.length !== 1) return null;
  return Number(exact[1]) === sizes[0] ? "equal to the computed size" : `different from the computed size, ${sizes[0]} bp`;
}

export function LabPrimer({
  primer,
  primers,
  usedBy,
}: {
  primer: PrimerRow;
  primers: PrimerRow[];
  usedBy: Array<{ path: string; title: string }>;
}) {
  const mate = mateOf(primer, primers);
  const pair = pairProduct(primer, primers);
  const note = tmNote();
  return (
    <>
      <dl className="registry-facts">
        {primer.sequence ? (
          <Fact term="Sequence (5′ to 3′)">
            <code className="registry-seq">{primer.sequence}</code>
          </Fact>
        ) : null}
        {primer.reverseComplement ? (
          <Fact term="Reverse complement (5′ to 3′)">
            <code className="registry-seq">{primer.reverseComplement}</code>
          </Fact>
        ) : null}
        {primer.direction ? <Fact term="Direction">{primer.direction}</Fact> : null}
        {primer.target ? <Fact term="Target">{primer.target}</Fact> : null}
        {primer.set ? <Fact term="Set">{primer.set}</Fact> : null}
        {mate ? (
          <Fact term="Pairs with">
            <a href={mate.path}>{mate.name}</a>
          </Fact>
        ) : null}
        {primer.length ? <Fact term="Length">{primer.length} nt</Fact> : null}
        {primer.gcPercent !== null ? <Fact term="GC content">{primer.gcPercent}%</Fact> : null}
        {primer.tm !== null ? <Fact term="Melting temperature estimate (Tm)">{primer.tm} °C</Fact> : null}
        <Fact term="Annealing temperature">
          Depends on the polymerase: <a href={note.calculator.url}>{note.calculator.name}</a>
        </Fact>
        {usedBy.length > 0 ? (
          <Fact term={usedBy.length === 1 ? "Used in" : "Used in these protocols"}>
            <ul className="registry-used">
              {usedBy.map((protocol) => (
                <li key={protocol.path}>
                  <a href={protocol.path}>{protocol.title}</a>
                </li>
              ))}
            </ul>
          </Fact>
        ) : null}
      </dl>
      {primer.tm !== null ? (
        <p className="registry-note">
          {note.statement} The Tm estimate is not an annealing temperature. For the annealing temperature of a particular polymerase, use the{" "}
          <a href={note.calculator.url}>{note.calculator.name}</a>.
        </p>
      ) : null}

      <h2 id="literature">In the literature</h2>
      <dl className="registry-facts">
        <Fact term="Published in">
          {primer.publishedIn ? (
            primer.publishedDoi ? (
              <a href={`https://doi.org/${primer.publishedDoi}`}>{primer.publishedIn}</a>
            ) : primer.publishedUrl ? (
              <a href={primer.publishedUrl}>{primer.publishedIn}</a>
            ) : (
              primer.publishedIn
            )
          ) : (
            <NotFound reason={primer.publishedInMissing} />
          )}
        </Fact>
        <Fact term="Name in the paper">{primer.publishedName ?? <NotFound reason={primer.publishedNameMissing} />}</Fact>
        <Fact term="Sequence in the paper">
          {primer.publishedSequence ? (
            <>
              <code className="registry-seq">{primer.publishedSequence}</code>{" "}
              {primer.matchesPublished ? (
                <span>Identical to the stored sequence.</span>
              ) : (
                <strong className="registry-differs">Differs from the stored sequence.</strong>
              )}
            </>
          ) : (
            <NotFound reason={primer.publishedSequenceMissing} />
          )}
        </Fact>
        {primer.publishedProduct || primer.direction === "forward" ? (
          <Fact term="Product in the paper">
            {primer.publishedProduct ? (
              <>
                {primer.publishedProduct}
                {pair && publishedVersusComputed(primer.publishedProduct, pair.products)
                  ? `, ${publishedVersusComputed(primer.publishedProduct, pair.products)}`
                  : null}
              </>
            ) : (
              <NotFound reason={primer.publishedProductMissing} />
            )}
          </Fact>
        ) : null}
      </dl>

      <h2 id="reference">On the reference</h2>
      <dl className="registry-facts">
        {primer.placement ? (
          <>
            <Fact term="Reference">
              <a href={`https://www.ncbi.nlm.nih.gov/nuccore/${primer.placement.reference.accession}`}>{primer.placement.reference.id}</a>:{" "}
              {primer.placement.reference.description}
            </Fact>
            <Fact term={primer.placement.sites.length === 1 ? "Position" : "Positions"}>
              <ul className="registry-used">
                {primer.placement.sites.map((site) => (
                  <li key={`${site.start}-${site.strand}`}>{siteText(site)}</li>
                ))}
              </ul>
            </Fact>
          </>
        ) : (
          <Fact term="Reference">
            {primer.reference
              ? `${primer.reference}: the primer binds it nowhere within ${MAX_MISMATCHES} mismatches.`
              : "None recorded."}
          </Fact>
        )}
        {pair ? (
          <Fact term={`Product with ${mate?.name ?? "its pair"}`}>
            <ul className="registry-used">
              {pair.products.map((product) => (
                <li key={product.start}>{productSpanText(product)}</li>
              ))}
            </ul>
          </Fact>
        ) : null}
      </dl>
      <p className="registry-note">
        Positions and product sizes are computed from the sequence and the reference by the site&rsquo;s own tested primer code, in
        the accession&rsquo;s own coordinates, and are not copied from a paper. A primer is looked for exactly first, then with
        more mismatches up to {MAX_MISMATCHES}, and any mismatch is shown.
      </p>
    </>
  );
}

export function LabStrains({ result }: { result: CatalogResult<StrainRow> }) {
  return (
    <>
      <p className="registry-lede">
        The bacterial hosts the lab&rsquo;s phages are isolated on. Each strain&rsquo;s phages are counted from the phages table,
        so a phage added there is counted here with no edit to the strain.
      </p>
      <div className="registry site-catalog site-catalog-wide">
        <Catalog
          definition={STRAINS}
          result={result}
          labelledBy="registry-title"
          title={(s) => (
            <a className="cap-table-open" href={s.path}>
              {s.name}
            </a>
          )}
        />
      </div>
    </>
  );
}

export function LabStrain({ strain, usedBy }: { strain: StrainRow; usedBy: Array<{ path: string; title: string }> }) {
  const years = phageYearsText(strain);
  return (
    <>
      <dl className="registry-facts">
        {strain.organism ? <Fact term="Organism">{strain.organism}</Fact> : null}
        {strain.strain ? <Fact term="Strain">{strain.strain}</Fact> : null}
        {strain.collection && strain.collectionNumber ? (
          <Fact term="Culture collection">
            {strain.collection} {strain.collectionNumber}
          </Fact>
        ) : null}
        {strain.guideUrl ? (
          <Fact term="SEA-PHAGES Guide page">
            <a href={strain.guideUrl}>{strain.guideUrl.replace(/^https:\/\//, "")}</a>
          </Fact>
        ) : null}
        <Fact term="Biosafety level">{strain.biosafetyLevel ?? <NotFound reason={strain.biosafetyLevelMissing} />}</Fact>
        {usedBy.length > 0 ? (
          <Fact term={usedBy.length === 1 ? "Used in" : "Used in these protocols"}>
            <ul className="registry-used">
              {usedBy.map((protocol) => (
                <li key={protocol.path}>
                  <a href={protocol.path}>{protocol.title}</a>
                </li>
              ))}
            </ul>
          </Fact>
        ) : null}
      </dl>

      <h2 id="phages">Phages isolated on it</h2>
      {strain.phages.length === 0 ? (
        <p>No phage in the lab&rsquo;s table names this host.</p>
      ) : (
        <>
          <p>
            {strain.phages.length} phage{strain.phages.length === 1 ? "" : "s"}, found {years}, counted from the phages table.
          </p>
          <ul className="registry-used registry-phages">
            {strain.phages.map((phage) => (
              <li key={phage.name}>
                <a href={phage.path}>{phage.name}</a>, {phage.year}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function LabReagents({ result }: { result: CatalogResult<ReagentRow> }) {
  return (
    <>
      <p className="registry-lede">
        The substances the lab&rsquo;s protocols use, apart from the samples they work on, in one table. A reagent is bought (a supplier
        and a catalog number, where a record in the repository states them) or prepared in the lab (a link to its recipe). Each row
        lists the protocols that use it, and each protocol&rsquo;s own table has its amount, stock and final concentration.
      </p>
      <div className="registry site-catalog site-catalog-wide">
        <Catalog
          definition={REAGENTS}
          result={result}
          labelledBy="registry-title"
          title={(r) => reagentLabel(r)}
          cells={{
            supplier: (r) => (reagentSource(r) ?? <NotFound reason={r.supplierMissing} />),
            number: (r) => (r.preparedInLab ? "" : (r.catalogNumber ?? <NotFound reason={r.catalogNumberMissing} />)),
            link: (r) =>
              r.productUrl ? (
                <a href={r.productUrl}>Product page</a>
              ) : r.recipePath ? (
                <a href={r.recipePath}>Recipe</a>
              ) : r.preparedInLab ? (
                <NotFound reason={r.recipeMissing} />
              ) : (
                ""
              ),
            protocols: (r) => (
              <>
                {r.uses.map((u, i) => (
                  <span key={u.path}>
                    {i > 0 ? "; " : null}
                    <a href={u.path}>{u.title}</a>
                  </span>
                ))}
              </>
            ),
          }}
        />
      </div>
    </>
  );
}
