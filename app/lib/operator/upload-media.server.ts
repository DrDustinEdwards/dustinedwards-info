import { ALLOWED, MAX_BYTES, uploadSuccessBody } from "~/lib/media/upload-contract.mjs";
import { storeUpload } from "~/lib/media/upload.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { readCappedBytes } from "~/lib/read-capped.mjs";
import { base64ToBytes } from "~/lib/bytes.mjs";
import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";

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
    return base64ToBytes(payload);
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

  let response: Response;
  try {
    response = await fetch(parsed, { headers: { accept: "image/*" } });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: `Fetching ${parsed.href} failed: ${errorMessage(error)}`,
    };
  }
  // Checked again where it LANDED: `fetch` follows redirects, and https may redirect to http.
  let landed = "";
  try {
    landed = new URL(response.url || parsed.href).protocol;
  } catch {
    landed = "";
  }
  if (landed !== "https:") {
    return {
      ok: false,
      status: 400,
      error:
        `${parsed.href} redirected to ${response.url || "somewhere unparseable"}, ` +
        `which is not https. upload_media fetches https only, redirects included.`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      error: `${parsed.href} answered ${response.status}.`,
    };
  }
  if (!response.body) {
    return { ok: false, status: 502, error: `${parsed.href} answered with no body.` };
  }

  const read = await readCappedBytes(response, MAX_BYTES);
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

// An adapter: `storeUpload` is the write. The token and rate limiter are the primary control; HTTPS only,
// a capped read and `validateUpload` are secondary. The declared type wins because good PNGs are often
// served as octet-stream, and it is still checked against the allowlist and the bytes.
export async function uploadMediaTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const data = typeof args.data === "string" ? args.data.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  const declaredType = typeof args.type === "string" ? args.type.trim().toLowerCase() : "";
  const declaredName = typeof args.name === "string" ? args.name.trim() : "";

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

  const source = data ? bytesFromData(data, declaredType) : await bytesFromUrl(url, declaredType);
  if (!source.ok) return source;
  const { bytes, type } = source;

  // A fresh ArrayBuffer, not `bytes.buffer`: that is the whole allocation, not the view, so a later change
  // to a producer could hash and store the wrong bytes.
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);

  const stored = await storeUpload(env, {
    bytes: payload,
    type,
    name: declaredName || defaultName(type, url),
  });

  if (!stored.ok) {
    return { ok: false, status: stored.status, error: stored.message, detail: { code: stored.code } };
  }

  return {
    ok: true,
    data: {
      // The editor's own builder, so the string an agent puts in markdown is the one the editor inserts.
      ...uploadSuccessBody(stored.key),
      bytes: stored.bytes,
      width: stored.width,
      height: stored.height,
      // `false` means the object landed and the row did not; `sync_media` re-derives it.
      recorded: stored.recorded,
    },
  };
}
