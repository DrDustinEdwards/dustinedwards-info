import { isContentKey } from "./classify.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

// Measured for the index (the rebuild and the R2 events), whose rows hold what pages size by. Null means the binding answered
// with no pixel dimensions (an SVG); a binding that throws is NOT that answer, so the throw propagates:
// read as null it would mint a permanent key with no size, or write empty sizes over measured ones.
export async function measureDimensions(
  env: Env,
  body: ReadableStream | ArrayBuffer,
): Promise<{ width: number; height: number } | null> {
  const stream = body instanceof ArrayBuffer ? new Blob([body]).stream() : body;
  let info: Awaited<ReturnType<Env["IMAGES"]["info"]>>;
  try {
    info = await env.IMAGES.info(stream);
  } catch (error) {
    throw new Error(`Cloudflare Images could not measure the image: ` + `${errorMessage(error)}`, {
      cause: error,
    });
  }
  // An SVG has no pixel dimensions: record nothing rather than 0.
  if ("width" in info && "height" in info) {
    return { width: info.width, height: info.height };
  }
  return null;
}

export function isManagedKey(key: string) {
  return isContentKey(key);
}
