import { Catalog } from "capsomer/react/catalog";
import type { CatalogResult } from "capsomer/behaviour/catalog";

import {
  INVENTORY,
  PRIMERS,
  kindLabel,
  mateOf,
  pairProduct,
  tmNote,
  type InventoryRow,
  type PrimerRow,
} from "~/lib/registry/catalog.mjs";

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
        The lab&rsquo;s reference catalog: what each primer is, with the phages it has isolated. It records what a thing is,
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

const sequenceCell = (p: PrimerRow) => (p.sequence ? <code className="registry-seq">{p.sequence}</code> : "");

export function LabPrimers({ result }: { result: CatalogResult<PrimerRow> }) {
  const note = tmNote();
  return (
    <>
      <p className="registry-lede">
        The primers the lab&rsquo;s protocols use, with each sequence as stored. Length, GC content and melting temperature
        are computed from the sequence. A product size is shown only where a protocol states one.
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
          cells={{ sequence: sequenceCell }}
        />
      </div>
      <p className="registry-note">{note.statement}</p>
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
  const product = pairProduct(primer, primers);
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
        {product ? <Fact term="Product">{product}</Fact> : null}
        {primer.length ? <Fact term="Length">{primer.length} nt</Fact> : null}
        {primer.gcPercent !== null ? <Fact term="GC content">{primer.gcPercent}%</Fact> : null}
        {primer.tm !== null ? <Fact term="Melting temperature (Tm)">{primer.tm} °C</Fact> : null}
        {primer.source ? (
          <Fact term="Source">
            {primer.sourceUrl ? <a href={primer.sourceUrl}>{primer.source}</a> : primer.source}
            {primer.paper ? (
              <>
                {" "}
                (<a href={`/research/publications/${primer.paper}/`}>on this site</a>)
              </>
            ) : null}
          </Fact>
        ) : null}
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
      {primer.tm !== null ? <p className="registry-note">{note.statement}</p> : null}
    </>
  );
}
