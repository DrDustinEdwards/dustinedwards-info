import { redirect } from "react-router";

import { getEnv } from "~/lib/context";
import {
  isFormUpload,
  uploadErrorBody,
  uploadRedirectTo,
  uploadSuccessBody,
} from "~/lib/media/upload-contract.mjs";
import { storeUpload } from "~/lib/media/upload.server";
import type { Route } from "./+types/admin.media.upload";

/** Under /admin so the Better Auth middleware gates it: there is no unauthenticated write path to the bucket. */


export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json(uploadErrorBody("Method not allowed"), { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  const file = form.get("file");

  /*
   * Decided by an explicit field only. The editors send nothing new and read JSON, so a header
   * default changing cannot move their contract.
   */
  const asForm = isFormUpload(form.get("intent"));

  const refuse = (code: string, message: string, status: number) =>
    asForm
      ? redirect(uploadRedirectTo({ ok: false, code }))
      : Response.json(uploadErrorBody(message), { status });

  if (!(file instanceof File)) {
    return refuse("no-file", "No file was submitted.", 400);
  }

  /*
   * Cheap: `formData()` already buffered the body, so `arrayBuffer()` copies from memory.
   * Read once: a File's stream cannot be consumed twice.
   */
  const stored = await storeUpload(env, {
    bytes: await file.arrayBuffer(),
    type: file.type,
    name: file.name,
  });

  if (!stored.ok) return refuse(stored.code, stored.message, stored.status);

  return asForm
    ? redirect(uploadRedirectTo({ ok: true, key: stored.key }))
    : Response.json(uploadSuccessBody(stored.key));
}
