/**
 * `virtual:system-insides`: every system's inside layer on /systems (scripts/lib/system-layout.mjs), drawn once at
 * build time from data/system-model.json. The drawing is searched for, which takes seconds over the whole model;
 * done here the Worker serves strings and spends nothing on it, and the model's daily refresh redraws it on the
 * build that ships it.
 *
 * Both environments import it (the route module is in the client build too), so the drawing is memoised on the
 * model's bytes and made once per build.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { insideLayers } from "./system-layout.mjs";
import { loadSystemModel, mapData, summaryOf } from "../../app/lib/systems.mjs";

const MODULE_ID = "virtual:system-insides";
const RESOLVED_ID = `\0${MODULE_ID}`;
const MODEL_FILE = fileURLToPath(new URL("../../data/system-model.json", import.meta.url));

/** @type {{ bytes: string, source: string } | null} */
let memo = null;

/** The module's source for the model as it is on disk. */
export function systemInsidesSource() {
  const bytes = readFileSync(MODEL_FILE, "utf8");
  if (memo?.bytes === bytes) return memo.source;
  const model = loadSystemModel(JSON.parse(bytes));
  const source = `export const INSIDE_LAYERS = ${JSON.stringify(insideLayers(model, summaryOf, mapData(model)))};\n`;
  memo = { bytes, source };
  return source;
}

/** @returns {import("vite").Plugin} */
export function systemInsidesPlugin() {
  return {
    name: "dustinedwards:system-insides",
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      this.addWatchFile(MODEL_FILE);
      return systemInsidesSource();
    },
  };
}
