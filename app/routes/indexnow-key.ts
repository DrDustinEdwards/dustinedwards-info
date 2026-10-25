// /<key>.txt, the IndexNow key file: Prelum's keyFileResponse, the key as the whole body.
import { keyFileResponse } from "@drdustinedwards/site-helpers/indexnow";

import { INDEXNOW_KEY } from "~/lib/indexnow.mjs";
import { HOURLY_CACHE_CONTROL } from "~/lib/seo";

export function loader() {
  return keyFileResponse(INDEXNOW_KEY, { "cache-control": HOURLY_CACHE_CONTROL });
}
