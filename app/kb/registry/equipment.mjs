/*
 * The equipment kind of the lab registry (docs/REGISTRY.md): the instruments and labware protocols list under
 * Equipment. One table with a page per item listing the protocols that use it; each protocol's own Equipment table
 * is drawn from these records beside the protocol's own words for the item.
 * A record states its name and maker (`MISSING: <why>` where no record says). A centrifuge also carries the rotor
 * its speeds are read for, Dustin's to name (core.md: the ZnCl2 rotor), so it is a gap and rpm cannot yet be x g.
 * What a protocol does with an item (55 C water bath) is the PROTOCOL's and never stored here: it names the record
 * with `equipment: <id>`.
 */

import { oneLine, stated } from "./primer.mjs";

/** @type {import("./kinds.mjs").KindSpec} */
export const EQUIPMENT = {
  singular: "equipment",
  plural: "equipment",
  fields: {
    manufacturer: { required: true, check: (value) => oneLine(value, 80) },
    // The rotor a centrifuge's speeds are read for: a protocol gives rpm, and x g needs the rotor (core.md: waiting on Dustin).
    rotor: { check: (value) => oneLine(value, 120) },
  },
};

/**
 * @param {import("./kinds.mjs").RegistryItem} item
 * @returns {import("../procedures/render-stored.mjs").StoredEquipment}
 */
export function storedEquipment(item) {
  const f = /** @type {Record<string, unknown>} */ (item.fields);
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    manufacturer: stated(f.manufacturer),
    rotor: stated(f.rotor),
    rotorGap: typeof f.rotor === "string" && f.rotor.startsWith("MISSING"),
  };
}
