import { readCappedBytes, requireJson } from "@dustinedwards/site-runtime/body";
import { logEvent, OWASP_EVENTS, requestFields } from "@dustinedwards/site-runtime/log";

/** Ceilings for a request body: a form a reader sends, a signed-in form, and one that carries a picture (upload-contract.mjs). */
export const FORM_BYTES = 64 * 1024;
export const ADMIN_FORM_BYTES = 1024 * 1024;
export const UPLOAD_FORM_BYTES = 11 * 1024 * 1024;

/**
 * One OWASP `input_validation_fail` line (site-runtime ./log) for a request refused for what it sent: the method, the
 * scrubbed path, the status and a fixed reason, never the input itself.
 */
export function inputRefused(request: Request, status: number, reason: string): void {
  logEvent(OWASP_EVENTS.inputValidationFailure, { ...requestFields(request), status, reason }, { level: "warn" });
}

/** The body read to `max` bytes (site-runtime ./body), as a Response of the type it came as; over it, a 413 is thrown. */
async function capped(request: Request, max: number): Promise<Response> {
  const bytes = await readCappedBytes(request, max);
  if (bytes === null) {
    inputRefused(request, 413, "body over its limit");
    throw new Response("Payload Too Large", { status: 413, headers: { "cache-control": "no-store" } });
  }
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "content-type": request.headers.get("content-type") ?? "" } });
}

export async function cappedForm(request: Request, max: number): Promise<FormData> {
  return (await capped(request, max)).formData();
}

/** A JSON body; one of any other type throws the 415 first (requireJson), since a form or text/plain post needs no preflight. */
export async function cappedJson(request: Request, max: number): Promise<unknown> {
  const refused = requireJson(request);
  if (refused) {
    inputRefused(request, refused.status, "body not JSON");
    throw refused;
  }
  return (await capped(request, max)).json();
}
