import { errorMessage } from "~/lib/error-message.mjs";
import {
  classify,
  cropSafe,
  digestFromKey,
  dimensionsFromKey,
  excludedFromAssets,
  isContentKey,
  isRaster,
  roleOf,
  storageOf,
} from "~/lib/media/classify.mjs";
import { KEY_CAP } from "~/lib/playground/limits";

/** The media key demo's share of the playground loader: every reader of the key grammar, over one string. */
export function mediaKeyDemo(params: URLSearchParams) {
  const keyRaw = params.get("key") ?? "";
  const keyTrimmed = keyRaw.trim();
  const key = keyTrimmed.slice(0, KEY_CAP);
  let keyResult = null;
  let keyError: string | null = null;

  if (key) {
    if (keyTrimmed.length > KEY_CAP) {
      keyError = `That key is ${keyTrimmed.length} characters. The cap is ${KEY_CAP}, so it was cut.`;
    }
    /* `classify()` throws on an unknown extension deliberately; catching it here softens nothing for other callers. */
    let classification: { kind: string; mime: string; extension: string } | null = null;
    let classifyRefusal: string | null = null;
    try {
      classification = classify(key);
    } catch (error) {
      classifyRefusal = errorMessage(error);
    }

    const dimensions = dimensionsFromKey(key);
    keyResult = {
      key,
      contentKey: isContentKey(key),
      digest: digestFromKey(key),
      dimensions: dimensions ? `${dimensions.width} by ${dimensions.height}` : null,
      storage: storageOf(key),
      role: roleOf(key),
      classification,
      classifyRefusal,
      raster: isRaster(key),
      cropSafe: cropSafe(key),
      excluded: excludedFromAssets(key),
    };
  }

  return { keyResult, keyError, keyRaw: key };
}
