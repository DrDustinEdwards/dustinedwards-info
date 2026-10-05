// The reference sequences a primer is placed on (docs/REGISTRY.md): GenBank records, fetched once into data/references/ as
// FASTA files that keep NCBI's own header, and read here. A primer's position, strand and mismatches, and a pair's product,
// are COMPUTED from a reference by align.mjs (the tested code in primers.mjs), never copied from a paper or a database, and
// the page states which accession it used.
//
// A reference is a whole record (`DQ387450.1`) or a region of one (`NC_052532.1:76902320-76906237`, how NCBI names a slice of
// a chromosome). A position is reported in the ACCESSION's own coordinates, so a region's offset is added back and a reader
// can check it against the record at NCBI.

import { parseFasta } from "../primers.mjs";

/** The id a header names: an accession.version, and for a slice of a record its from-to span. */
const HEADER = /^>?\s*([A-Z]{1,2}_?[0-9]+\.[0-9]+)(?::([0-9]+)-([0-9]+))?\s+(.*)$/;

/**
 * @typedef {{
 *   id: string,
 *   accession: string,
 *   from: number,
 *   to: number,
 *   description: string,
 *   sequence: string,
 * }} Reference
 */

/**
 * One FASTA text, parsed. The header must be NCBI's own (`>accession.version[:from-to] description`) and the sequence must
 * be the length that header says, so a truncated or edited file cannot be read as the record it names.
 *
 * @param {string} text
 * @returns {Reference}
 */
export function parseReference(text) {
  const { header, sequence } = parseFasta(text);
  const match = HEADER.exec(header);
  if (!match) throw new Error(`"${header}" is not an NCBI FASTA header: >accession.version[:from-to] description`);
  const [, accession = "", fromText, toText, description = ""] = match;
  const from = fromText === undefined ? 1 : Number(fromText);
  const to = toText === undefined ? sequence.length : Number(toText);
  if (to - from + 1 !== sequence.length) {
    throw new Error(`${accession}: the header spans ${from}-${to} (${to - from + 1} bases) but the sequence is ${sequence.length}`);
  }
  if (!/^[ACGT]+$/.test(sequence)) throw new Error(`${accession}: the sequence has a base other than A, C, G and T, so it cannot be a placement reference`);
  const id = fromText === undefined ? accession : `${accession}:${from}-${to}`;
  return { id, accession, from, to, description, sequence };
}

/**
 * A 1-based position on the reference's own sequence, as the accession numbers it.
 *
 * @param {Reference} reference
 * @param {number} position 1-based on `reference.sequence`
 */
export function accessionPosition(reference, position) {
  return reference.from + position - 1;
}
