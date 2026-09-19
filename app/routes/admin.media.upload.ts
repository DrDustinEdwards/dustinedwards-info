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

/**
 * Image upload for the editor. Sits under /admin so the existing Better Auth middleware gates it;
 * there is no unauthenticated write path to the bucket.
 *
 * AN ADAPTER over `upload.server.ts`, which owns everything after the bytes arrive. The
 * content-addressing ruling is at `contentKey` in `classify.mjs`, where the key is made.
 *
 * WHAT IS LEFT HERE IS EXACTLY WHAT IS THIS ROUTE'S: parsing a multipart form, naming its own
 * missing-input refusal, and choosing between a redirect and a JSON body. All three are properties of
 * who is asking rather than of what is being stored, which is the line the extraction was cut along.
 */

/* The accepted types, the size limit and the reply shapes live in
 * `upload-contract.mjs`, which is a plain module `node:test` can load so it can
 * assert them. Two editors read the JSON this route returns and neither may
 * change, so the contract is a tested object rather than a convention. */


/**
 * The upload endpoint only. The listing lives on the media page at /admin/media, so there is one
 * lister and one media surface.
 */

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json(uploadErrorBody("Method not allowed"), { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  const file = form.get("file");

  /*
   * WHICH CALLER IS THIS, decided by an EXPLICIT FIELD and by nothing else. The library posts a form
   * and navigates, declaring itself with a hidden `intent=upload-form`; the two editors `fetch` and
   * read JSON, and keep that path by SENDING NOTHING NEW, so their contract cannot be moved by a header
   * default changing under them. `isFormUpload` is an equality against one token, asserted in
   * test/upload-contract.test.mjs.
   */
  const asForm = isFormUpload(form.get("intent"));

  /**
   * One refusal, answered in the caller's own language.
   *
   * @param {string} code a key of UPLOAD_ERRORS, carried in the redirect
   * @param {string} message the sentence the editors show verbatim
   * @param {number} status
   */
  const refuse = (code: string, message: string, status: number) =>
    asForm
      ? redirect(uploadRedirectTo({ ok: false, code }))
      : Response.json(uploadErrorBody(message), { status });

  if (!(file instanceof File)) {
    return refuse("no-file", "No file was submitted.", 400);
  }

  /*
   * READ, THEN REFUSE, and the ordering costs nothing measurable: `request.formData()` above has
   * already buffered the entire body into this isolate, so `arrayBuffer()` is a copy out of memory
   * rather than a read off the wire. What the old order bought was a second statement of the size rule
   * living in this file, which is the thing the extraction was for.
   *
   * Read once, too: the bytes are needed to hash and to store, and a File's stream cannot be consumed
   * twice.
   */
  const stored = await storeUpload(env, {
    bytes: await file.arrayBuffer(),
    type: file.type,
    name: file.name,
  });

  if (!stored.ok) return refuse(stored.code, stored.message, stored.status);

  // The library navigates back to itself carrying the key; the editors get the
  // two-key body they have always read. Same upload, two answers, one branch.
  return asForm
    ? redirect(uploadRedirectTo({ ok: true, key: stored.key }))
    : Response.json(uploadSuccessBody(stored.key));
}
