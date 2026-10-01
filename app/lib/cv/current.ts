// The CV the page and its charts draw: app/data/cv.ts joined to the published publication records the
// build wrote (content/generated/publication-records.json). Resolved once per isolate, at load.
//
// The build's snapshot, not D1, on purpose: the page's script hydrates from the same entries, so the server
// and the browser must hold one copy, and a record read per request would reach the server alone. A paper
// edited through Carrel therefore reaches the CV page with the next deploy, as the CV's PDF and markdown do.
import records from "../../../content/generated/publication-records.json";

import { buildCv } from "./entries.mjs";
import type { Publication } from "../publications/types";

export const CV = buildCv(records.records as unknown as Publication[]);
