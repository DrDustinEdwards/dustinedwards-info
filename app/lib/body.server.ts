import { readCappedBytes } from "@dustinedwards/site-runtime/body";

/** Ceilings for a request body: a form a reader sends, a signed-in form, and one that carries a picture (upload-contract.mjs). */
export const FORM_BYTES = 64 * 1024;
export const ADMIN_FORM_BYTES = 1024 * 1024;
export const UPLOAD_FORM_BYTES = 11 * 1024 * 1024;

/** The body read to `max` bytes (site-runtime ./body), as a Response of the type it came as; over it, a 413 is thrown. */
async function capped(request: Request, max: number): Promise<Response> {
  const bytes = await readCappedBytes(request, max);
  if (bytes === null) throw new Response("Payload Too Large", { status: 413, headers: { "cache-control": "no-store" } });
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "content-type": request.headers.get("content-type") ?? "" } });
}

export async function cappedForm(request: Request, max: number): Promise<FormData> {
  return (await capped(request, max)).formData();
}

export async function cappedJson(request: Request, max: number): Promise<unknown> {
  return (await capped(request, max)).json();
}
