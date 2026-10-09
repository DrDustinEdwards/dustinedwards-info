import type { resolveProof } from "~/kb/procedures/proof.mjs";

/**
 * Proof of use: the papers that used the method and the phages it produced, as the protocol's file states them, with the
 * words and addresses read from the publication and phage rows. Plain links, no script. Nothing renders for a protocol
 * that states none.
 */
export function ProtocolProof({ proof }: { proof: ReturnType<typeof resolveProof> }) {
  if (!proof) return null;
  return (
    <section aria-labelledby="proof-of-use">
      <h2 id="proof-of-use">
        Proof of use
        <a className="heading-anchor" aria-label="Link to section: Proof of use" href="#proof-of-use">
          #
        </a>
      </h2>
      {proof.papers.length > 0 ? (
        <>
          <h3>Papers that used this method</h3>
          <ul className="procedure-proof">
            {proof.papers.map((p) => (
              <li key={p.slug}>
                {p.href ? <a href={p.href}>{p.title}</a> : p.title}
                {p.year ? ` (${p.year})` : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {proof.phages.length > 0 ? (
        <>
          <h3>Phages it produced</h3>
          <ul className="procedure-proof">
            {proof.phages.map((p) => (
              <li key={p.key}>{p.href ? <a href={p.href}>{p.name}</a> : p.name}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
