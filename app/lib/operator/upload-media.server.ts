import { ALLOWED, MAX_BYTES, uploadSuccessBody, validateUpload } from "~/lib/media/upload-contract.mjs";
import { carrelMediaAdapter } from "~/lib/carrel/media-adapter.server";
import { RefusedError, altRefusal, duplicateKey, guardedFetch, OutboundRefusal } from "@dustinedwards/site-api";
import { errorMessage } from "~/lib/error-message.mjs";
import { readCappedBytes } from "@dustinedwards/site-runtime/body";
import { fromBase64 } from "@dustinedwards/site-runtime/encoding";
import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";

// site-api's own media import uses 15 s and three redirects; the same here.
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

// The bytes and the resolved type, or the refusal to send back as the tool's answer.
type Sourced = { ok: true; bytes: Uint8Array; type: string } | Extract<ToolResult, { ok: false }>;

// Base64 only: silently mis-decoding a percent-encoded URI would store rubbish under a valid-looking digest.
function readDataUri(value: string): { type: string; payload: string } | null {
  const match = /^data:([^;,]*)(;base64)?,/i.exec(value);
  if (!match) return null;
  if (!match[2]) return null;
  return { type: (match[1] ?? "").toLowerCase(), payload: value.slice(match[0].length) };
}

function decodeBase64(payload: string): Uint8Array | null {
  // Null rather than a throw: the caller answers the agent that sent it with a 400 that says why.
  try {
    return fromBase64(payload);
  } catch {
    return null;
  }
}

function defaultName(type: string, url: string): string {
  if (url) {
    try {
      const base = new URL(url).pathname.split("/").filter(Boolean).pop();
      if (base) return decodeURIComponent(base);
    } catch {
      // Unreachable: the protocol was already checked. Caught rather than thrown from a naming helper.
    }
  }
  const extension = ALLOWED.get(type);
  // Never stored: a type outside the allowlist is refused next. `upload.bin` would be a substitution.
  return extension ? `upload.${extension}` : "upload";
}

function bytesFromData(data: string, declaredType: string): Sourced {
  let type = declaredType;
  const uri = readDataUri(data);
  if (data.startsWith("data:") && !uri) {
    return {
      ok: false,
      status: 400,
      error:
        "`data` looks like a data: URI but is not base64-encoded. Send " +
        "`data:<type>;base64,<payload>` or bare base64.",
    };
  }

  if (!type && uri) type = uri.type;

  // Refused on the encoded length before `atob` allocates. Generous: `validateUpload` states the real limit.
  const packedLength = (uri ? uri.payload : data).replace(/\s+/g, "").length;
  if (packedLength > Math.ceil(MAX_BYTES / 3) * 4 + 4) {
    return {
      ok: false,
      status: 413,
      error:
        `That base64 payload decodes to more than the ` +
        `${MAX_BYTES / (1024 * 1024)} MB limit. Upload it with \`url\` instead.`,
    };
  }

  const decoded = decodeBase64(uri ? uri.payload : data);
  if (!decoded) {
    return { ok: false, status: 400, error: "`data` is not valid base64." };
  }
  return { ok: true, bytes: decoded, type };
}

async function bytesFromUrl(url: string, declaredType: string): Promise<Sourced> {
  let type = declaredType;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: 400, error: `\`url\` is not a URL: ${JSON.stringify(url)}.` };
  }
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      status: 400,
      error: `upload_media fetches https only, not ${parsed.protocol.replace(":", "")}.`,
    };
  }

  // site-api's one outbound guard: https on the default port, no local name or private address (DNS answers
  // included), each redirect followed by hand and checked the same way. One signal covers the fetch and the read.
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    ({ response } = await guardedFetch(
      fetch,
      parsed.href,
      { headers: { accept: "image/*" }, signal },
      { maxRedirects: MAX_REDIRECTS },
    ));
  } catch (error) {
    if (error instanceof OutboundRefusal) {
      return { ok: false, status: 400, error: `upload_media will not fetch ${parsed.href}: ${error.message}` };
    }
    return {
      ok: false,
      status: 502,
      error: signal.aborted
        ? `Fetching ${parsed.href} took over ${FETCH_TIMEOUT_MS / 1000} seconds and was abandoned.`
        : `Fetching ${parsed.href} failed: ${errorMessage(error)}`,
    };
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return {
      ok: false,
      status: 502,
      error: `${parsed.href} answered ${response.status}.`,
    };
  }
  if (!response.body) {
    return { ok: false, status: 502, error: `${parsed.href} answered with no body.` };
  }

  let read: Uint8Array | null;
  try {
    read = await readCappedBytes(response, MAX_BYTES);
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: signal.aborted
        ? `Reading ${parsed.href} took over ${FETCH_TIMEOUT_MS / 1000} seconds and was abandoned.`
        : `Reading ${parsed.href} failed: ${errorMessage(error)}`,
    };
  }
  if (!read) {
    return {
      ok: false,
      status: 413,
      error:
        `${parsed.href} is over the ${MAX_BYTES / (1024 * 1024)} MB limit; the ` +
        `download was abandoned.`,
    };
  }

  // Split on `;`: a charset parameter is normal, and the allowlist holds bare types.
  if (!type) {
    type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  }
  return { ok: true, bytes: read, type };
}

// An adapter: the media library's upload is the write, the same one Carrel's and the admin's reach. The token and rate
// limiter are the primary control; the guarded fetch, a timed and capped read and `validateUpload` are secondary. The
// declared type wins because good PNGs are often served as octet-stream, and it is still checked against the allowlist
// and the bytes.
export async function uploadMediaTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const data = typeof args.data === "string" ? args.data.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  const declaredType = typeof args.type === "string" ? args.type.trim().toLowerCase() : "";
  const declaredName = typeof args.name === "string" ? args.name.trim() : "";
  const alt = typeof args.alt === "string" ? args.alt.trim() : "";
  const decorative = args.decorative === true;

  // Both sources is refused, not resolved: picking one could store the wrong image under a valid digest.
  if (data && url) {
    return {
      ok: false,
      status: 400,
      error: "upload_media takes `data` or `url`, never both. Send one.",
    };
  }
  if (!data && !url) {
    return {
      ok: false,
      status: 400,
      error:
        "upload_media needs either `data` (base64 bytes or a data: URI) or " +
        "`url` (an https URL this API will fetch).",
    };
  }

  // Before any fetch or store: an image is described before it is uploaded, as in the editors (site-api 0.19+,
  // ATAG 2.0 B.2.3). Decorative is stored as empty alt.
  const refusal = altRefusal(alt, decorative, declaredName || null);
  if (refusal) return { ok: false, status: 400, error: refusal, detail: { code: "alt-required" } };

  const source = data ? bytesFromData(data, declaredType) : await bytesFromUrl(url, declaredType);
  if (!source.ok) return source;
  const { bytes, type } = source;
  const name = declaredName || defaultName(type, url);
  const nameRefusal = declaredName ? null : altRefusal(alt, decorative, name);
  if (nameRefusal) return { ok: false, status: 400, error: nameRefusal, detail: { code: "alt-required" } };

  const refused = validateUpload({ type, bytes });
  if (refused) return { ok: false, status: refused.status, error: refused.message, detail: { code: refused.code } };

  // Idempotent: bytes the library already holds answer with that file, as a Carrel upload of them does.
  const media = carrelMediaAdapter(env);
  let item = await media.findByHash?.(await duplicateKey(bytes, type));
  if (!item) {
    try {
      item = await media.upload({ bytes, contentType: type, filename: name, alt, decorative, changeId: `operator-upload-${crypto.randomUUID()}` });
    } catch (error) {
      if (error instanceof RefusedError) return { ok: false, status: 415, error: error.message, detail: { code: "content-mismatch" } };
      throw error;
    }
  }

  return {
    ok: true,
    data: {
      // The editor's own builder, so the string an agent puts in markdown is the one the editor inserts.
      ...uploadSuccessBody(item.id),
      bytes: item.bytes,
      width: item.width,
      height: item.height,
      // Always true: a row that cannot be written takes its object with it, so nothing lands half stored.
      recorded: true,
    },
  };
}
