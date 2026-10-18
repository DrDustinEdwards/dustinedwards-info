/**
 * `virtual:system-insides`: every system's inside layer on /systems (scripts/lib/system-layout.mjs), drawn once at
 * build time from data/system-model.json. The drawing is searched for, which takes seconds over the whole model;
 * done here the Worker serves strings and spends nothing on it, and the model's daily refresh redraws it on the
 * build that ships it.
 *
 * The page at rest carries none of them: all of them in the HTML put the page past its LCP budget on a slow phone
 * (2026-10-18, Lighthouse's mobile profile, 2575ms against 2450ms without), and so did the core's alone, its bytes
 * costing the first paint a round trip. So the layers are also one JSON asset, named by the hash of its bytes like
 * the enhancement bundles, which the map's script fetches once the page has loaded (a fetch begun before the first
 * paint lands on its path too); the route inlines the layer a ?system= address asks for, so a shared link opens
 * zoomed in with no script.
 *
 * Both environments import the module (the route module is in the client build too), so the drawing is memoised on
 * the model's bytes and made once per build. Only the server's copy carries the layers: the client never draws one
 * from the module (its script fetches the asset), and the server's map, a ?system= one with its layer inlined, is
 * kept as it is on hydration, since React does not compare dangerouslySetInnerHTML there. With every layer in the
 * route's script, the full model's put /systems past its LCP budget again (2026-10-18, 2576ms).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { insideLayers } from "./system-layout.mjs";
import { loadSystemModel, mapData, summaryOf } from "../../app/lib/systems.mjs";

const MODULE_ID = "virtual:system-insides";
const RESOLVED_ID = `\0${MODULE_ID}`;
const MODEL_FILE = fileURLToPath(new URL("../../data/system-model.json", import.meta.url));

/** @type {{ bytes: string, json: string, fileName: string } | null} */
let memo = null;

/** Every layer, as the asset's JSON, and the asset's file name, for the model as it is on disk. */
export function systemInsides() {
  const bytes = readFileSync(MODEL_FILE, "utf8");
  if (memo?.bytes === bytes) return memo;
  const model = loadSystemModel(JSON.parse(bytes));
  const json = JSON.stringify(insideLayers(model, summaryOf, mapData(model)));
  const hash = createHash("sha256").update(json).digest("base64url").slice(0, 10);
  memo = { bytes, json, fileName: `assets/system-insides-${hash}.json` };
  return memo;
}

/**
 * The module's source: every layer by id for the server, none for the client, and the asset's URL under Vite's base.
 * @param {string} base @param {boolean} [client]
 */
export function systemInsidesSource(base, client = false) {
  const { json, fileName } = systemInsides();
  return `export const INSIDE_LAYERS = ${client ? "{}" : json};\nexport const INSIDES_URL = ${JSON.stringify(`${base}${fileName}`)};\n`;
}

/** @returns {import("vite").Plugin} */
export function systemInsidesPlugin() {
  let base = "/";
  return {
    name: "dustinedwards:system-insides",
    configResolved(config) {
      base = config.base;
    },
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      this.addWatchFile(MODEL_FILE);
      return systemInsidesSource(base, this.environment?.config.consumer === "client");
    },
    generateBundle() {
      // The server build needs the URL only, which is the same in both because it is the bytes' hash.
      if (this.environment.config.consumer !== "client") return;
      const { json, fileName } = systemInsides();
      this.emitFile({ type: "asset", fileName, source: json });
    },
    configureServer(server) {
      // In dev the asset is served from memory, so `react-router dev` needs no prestep.
      server.middlewares.use((req, res, next) => {
        const { json, fileName } = systemInsides();
        if (req.url?.split("?")[0] !== `${base}${fileName}`) return next();
        res.setHeader("content-type", "application/json");
        res.end(json);
      });
    },
  };
}
