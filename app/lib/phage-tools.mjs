/**
 * The phage lab calculators at /research/tools: serial dilution, webbed plate, MOI, efficiency of
 * plating and lysate volume. One pure module,
 * imported by the server-rendered calculator (app/components/phage-tool.tsx), which renders the worked
 * example with script off, and by the browser module that recomputes on input (app/enhance/tools.ts).
 * test/phage-tools.test.mjs holds it against hand arithmetic and the numbers on the FAQ and the
 * isolation protocol, and holds each page's worked example to what this module prints.
 *
 * Every lab default here names the page that states it (`source`), and the page shows that source.
 * Volumes are in µl and titers in pfu/ml throughout, as on the FAQ.
 */

import { LAB, SOURCES } from "./phage-tools-base.mjs";
import { runDilution, runTiter } from "./phage-tools-dilution.mjs";
import {
  runEop,
  runEopCounts,
  runFlood,
  runLysateVolume,
  runMoi,
  runWebbedPlate,
} from "./phage-tools-lysate.mjs";

/** @typedef {import("./phage-tools-base.mjs").ToolField} ToolField */
/** @typedef {import("./phage-tools-base.mjs").ToolResult} ToolResult */

/**
 * @typedef {object} ToolDefinition
 * @property {string} path the page it is on
 * @property {string} title the form's accessible name
 * @property {ToolField[]} fields
 * @property {(values: Record<string, string | undefined>) => ToolResult} run
 */

/** @type {Record<string, ToolDefinition>} */
export const TOOLS = {
  titer: {
    path: "/research/tools/titer",
    title: "Titer calculator",
    fields: [
      {
        name: "plaques",
        label: "Plaques counted",
        value: "111",
      },
      {
        name: "volume",
        label: "Volume plated or spotted",
        unit: "µl",
        value: String(LAB.ulPlated),
        hint: `The lab plates ${LAB.ulPlated} µl for a full plate titer and spots ${LAB.ulSpot} µl for a spot titer; enter 10 for a 10 µl spot.`,
        source: SOURCES.fullPlate,
      },
      {
        name: "dilution",
        label: "Dilution, 10 to the minus",
        value: "6",
        hint: "6 for the 10^-6 tube, 0 if undiluted.",
      },
    ],
    run: runTiter,
  },
  dilution: {
    path: "/research/tools/dilution",
    title: "Serial dilution planner",
    fields: [
      {
        name: "start",
        label: "Starting titer",
        unit: "pfu/ml",
        value: "1.11e10",
        hint: "1.11e10 or 1.11 x 10^10.",
      },
      { name: "target", label: "Target concentration", unit: "pfu/ml", value: "1.11e6" },
      {
        name: "transfer",
        label: "Volume carried into each tube",
        unit: "µl",
        value: String(LAB.transferUl),
        hint: "Each 10-fold tube gets 9 times this of phage buffer: 10 µl + 90 µl.",
        source: SOURCES.tenfold,
      },
      {
        name: "needed",
        label: "Volume needed from the last tube (optional)",
        unit: "µl",
        value: "",
        hint: "Plates x µl per plate. Earlier tubes are scaled up to supply it.",
      },
    ],
    run: runDilution,
  },
  "webbed-plate": {
    path: "/research/tools/webbed-plate",
    title: "Webbed plate calculator",
    fields: [
      {
        name: "titer",
        label: "Lysate titer",
        unit: "pfu/ml",
        value: "1.11e10",
        hint: "1.11e10 or 1.11 x 10^10.",
      },
      {
        name: "pfu",
        label: "pfu wanted per plate",
        value: "11100",
      },
      {
        name: "volume",
        label: "Volume plated per plate",
        unit: "µl",
        value: String(LAB.ulPlated),
        source: SOURCES.fullPlate,
      },
      {
        name: "plates",
        label: "Plates to pour",
        value: String(LAB.plates),
        source: SOURCES.yields,
      },
    ],
    run: runWebbedPlate,
  },
  flood: {
    path: "/research/tools/webbed-plate",
    title: "Plates for a lysate volume",
    fields: [
      {
        name: "ml",
        label: "Lysate wanted",
        unit: "ml",
        value: "20",
        hint: "10 ml to archive plus 10 ml for DNA extraction is 20 ml.",
      },
    ],
    run: runFlood,
  },
  moi: {
    path: "/research/tools/moi",
    title: "MOI calculator",
    fields: [
      {
        name: "titer",
        label: "Phage titer",
        unit: "pfu/ml",
        value: "1e9",
        hint: "1e9 or 1 x 10^9.",
      },
      {
        name: "phage",
        label: "Phage volume added",
        unit: "µl",
        value: String(LAB.ulPlated),
        source: SOURCES.fullPlate,
      },
      {
        name: "cells",
        label: "Host cells",
        unit: "cells/ml",
        value: "1e8",
        hint: "Counted, not read off an OD: the site gives no OD-to-cells factor for the lab's hosts. 1e8 is only the worked example's number.",
      },
      {
        name: "host",
        label: "Host culture volume",
        unit: "µl",
        value: "250",
        source: SOURCES.fullPlate,
      },
    ],
    run: runMoi,
  },
  eop: {
    path: "/research/tools/eop",
    title: "EOP from titers",
    fields: [
      {
        name: "test",
        label: "Titer on the test host",
        unit: "pfu/ml",
        value: "2e8",
        hint: "2e8 or 2 x 10^8.",
      },
      {
        name: "reference",
        label: "Titer on the reference host",
        unit: "pfu/ml",
        value: "1e10",
      },
    ],
    run: runEop,
  },
  "eop-counts": {
    path: "/research/tools/eop",
    title: "EOP from plaque counts",
    fields: [
      { name: "testPlaques", label: "Plaques on the test host", value: "20" },
      {
        name: "testVolume",
        label: "Volume plated on the test host",
        unit: "µl",
        value: String(LAB.ulPlated),
        source: SOURCES.fullPlate,
      },
      {
        name: "testDilution",
        label: "Test host dilution, 10 to the minus",
        value: "5",
        hint: "5 for the 10^-5 tube, 0 if undiluted.",
      },
      { name: "refPlaques", label: "Plaques on the reference host", value: "100" },
      {
        name: "refVolume",
        label: "Volume plated on the reference host",
        unit: "µl",
        value: String(LAB.ulPlated),
        source: SOURCES.fullPlate,
      },
      {
        name: "refDilution",
        label: "Reference host dilution, 10 to the minus",
        value: "6",
        hint: "6 for the 10^-6 tube, 0 if undiluted.",
      },
    ],
    run: runEopCounts,
  },
  "lysate-volume": {
    path: "/research/tools/lysate-volume",
    title: "Lysate volume planner",
    fields: [
      {
        name: "titer",
        label: "Lysate titer",
        unit: "pfu/ml",
        value: "1e7",
        hint: "1e7 or 1 x 10^7.",
      },
      {
        name: "pfu",
        label: "pfu wanted per plate",
        value: "10000",
      },
      {
        name: "plates",
        label: "Plates to pour",
        value: String(LAB.plates),
        source: SOURCES.yields,
      },
      {
        name: "volume",
        label: "Volume plated per plate",
        unit: "µl",
        value: String(LAB.ulPlated),
        source: SOURCES.fullPlate,
      },
    ],
    run: runLysateVolume,
  },
};

/** The calculators on a page, in page order. @param {string} path */
export function toolsOnPage(path) {
  return Object.keys(TOOLS).filter((id) => TOOLS[id]?.path === path);
}

/**
 * A tool's values: the query string's where it has them, the field's opening value where not.
 *
 * @param {string} id
 * @param {URLSearchParams} [params]
 * @returns {Record<string, string>}
 */
export function toolValues(id, params) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`No calculator named ${id}.`);
  /** @type {Record<string, string>} */
  const values = {};
  for (const field of tool.fields) {
    const given = params?.get(field.name);
    values[field.name] = given === null || given === undefined ? field.value : given.slice(0, 40);
  }
  return values;
}

/** @param {string} id @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runTool(id, values) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`No calculator named ${id}.`);
  return tool.run(values);
}
