import { productsForRows } from "~/lib/registry/align.mjs";
import { primerFacts } from "~/lib/registry/primer.mjs";
import { NEB_TM_CALCULATOR, tmStatement } from "~/lib/registry/tm.mjs";
import type { ProcedureRecord } from "~/lib/procedures/render.mjs";

/**
 * The primers a protocol uses, drawn from the record, which carries the lab registry's facts about each (docs/REGISTRY.md):
 * the sequence is stored once, in the registry, and every page of the protocol prints that one. Each primer is also a page of
 * its own under /research/lab/primers, with the reverse complement and the facts computed from the sequence. The bench
 * sheet prints the same table without the estimate and its note, since it is for working from.
 *
 * The Tm is an estimate for comparing primers, never an annealing temperature (protocols.md, 2026-10-04), and the note
 * says where an annealing temperature for a polymerase comes from.
 */
export function ProcedurePrimers({ record, brief = false }: { record: ProcedureRecord; brief?: boolean }) {
  if (record.primers.length === 0) return null;
  const rows = record.primers.map((p) => ({ ...p, facts: p.sequence ? primerFacts(p.sequence) : null }));
  // A pair's product is computed from where its primers bind the reference they share (docs/REGISTRY.md), never typed.
  const products = productsForRows(record.primers);
  const productOf = (id: string) => {
    const pair = products.get(id);
    if (!pair) return "";
    const sizes = [...new Set(pair.products.map((p) => p.length))].map((n) => `${n} bp`).join(" or ");
    return pair.products.length > 1 && new Set(pair.products.map((p) => p.length)).size === 1 ? `${sizes} at ${pair.products.length} sites` : sizes;
  };
  const references = [...new Set([...products.values()].map((pair) => pair.reference))];
  const showProduct = products.size > 0;
  const showSet = rows.some((p) => p.set);
  const showTm = !brief && rows.some((p) => p.facts?.tm != null);
  return (
    <>
      <div className="table-scroll">
        <table className="procedure-primers">
          <thead>
            <tr>
              <th scope="col">Primer</th>
              {showSet ? <th scope="col">Set</th> : null}
              <th scope="col">Direction</th>
              <th scope="col">Sequence (5′ to 3′)</th>
              {brief ? null : <th scope="col">Length (nt)</th>}
              {showTm ? <th scope="col">Tm estimate (°C)</th> : null}
              {showProduct ? <th scope="col">Product (computed)</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <th scope="row">{brief ? p.name : <a href={`/research/lab/primers/${p.id}`}>{p.name}</a>}</th>
                {showSet ? <td>{p.set ?? ""}</td> : null}
                <td>{p.direction ?? ""}</td>
                <td>{p.sequence ? <code className="registry-seq">{p.sequence}</code> : ""}</td>
                {brief ? null : <td>{p.facts?.length ?? ""}</td>}
                {showTm ? <td>{p.facts?.tm ?? ""}</td> : null}
                {showProduct ? <td>{productOf(p.id)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {references.length > 0 ? (
        <p className="procedure-primers-note">
          Product sizes are computed from where the primers bind{" "}
          {references.map((reference, i) => (
            <span key={reference.id}>
              {i > 0 ? ", " : ""}
              <a href={`https://www.ncbi.nlm.nih.gov/nuccore/${reference.accession}`}>{reference.id}</a>
            </span>
          ))}{" "}
          ({references.map((reference) => reference.description).join("; ")}), in the accession&rsquo;s own coordinates.
        </p>
      ) : null}
      {brief ? null : (
        <p className="procedure-primers-note">
          {tmStatement()} The Tm estimate is not an annealing temperature. For the annealing temperature of a particular polymerase,
          use the <a href={NEB_TM_CALCULATOR.url}>{NEB_TM_CALCULATOR.name}</a>.
        </p>
      )}
    </>
  );
}
