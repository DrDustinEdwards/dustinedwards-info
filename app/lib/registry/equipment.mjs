// The equipment kind of the lab registry (docs/REGISTRY.md): the instruments and labware the lab's protocols list under
// Equipment. Like the reagents, the equipment is one table with no page for an item (the library's Equipment tab), and each
// protocol's own Equipment table is drawn from these records beside the protocol's own words for the item.
//
// A record states what the lab's own pages state about one item: its name and who makes it, which is `MISSING: <why>` where no
// record in the repository says and is listed for Dustin. A centrifuge also carries the rotor its speeds are read for, which is
// Dustin's to name (core.md: the ZnCl2 rotor), so it is recorded as a gap and the protocols' rpm cannot yet be given as x g.
//
// What the protocols do with an item is the PROTOCOLS' and is never stored here: a protocol lists it under its own words (55 °C
// water bath for molten top agar, plate incubator at 29 °C for M. foliorum) and names the record with `equipment: <id>`, so the
// setting is the protocol's own and the table lists the protocols that name it.

const LINE = /^[^\r\n]+$/;

/** @param {unknown} value @param {number} max */
const oneLine = (value, max) =>
  typeof value === "string" && LINE.test(value) && value === value.trim() && value.length <= max ? null : `is one line of at most ${max} characters`;

/** @type {import("./kinds.mjs").KindSpec} */
export const EQUIPMENT = {
  singular: "equipment",
  plural: "equipment",
  // The equipment is one table, not a page each.
  itemPages: false,
  fields: {
    manufacturer: { required: true, check: (value) => oneLine(value, 80) },
    // The rotor a centrifuge's speeds are read for: a protocol gives rpm, and x g needs the rotor (core.md: waiting on Dustin).
    rotor: { check: (value) => oneLine(value, 120) },
  },
};

/**
 * An equipment item as a protocol carries it (`StoredEquipment` in app/lib/procedures/render.mjs): the registry's stated facts, none
 * computed, so the protocol's Equipment table, twin and frozen versions say who makes each as it was when the protocol was published.
 * `rotorGap` is whether a rotor is recorded as missing, so a centrifuge's table says so rather than leaving it blank.
 *
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render.mjs").StoredEquipment}
 */
export function storedEquipment(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  const text = (/** @type {unknown} */ value) => (typeof value === "string" && value !== "" && !value.startsWith("MISSING") ? value : null);
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    manufacturer: text(f.manufacturer),
    rotor: text(f.rotor),
    rotorGap: typeof f.rotor === "string" && f.rotor.startsWith("MISSING"),
  };
}
