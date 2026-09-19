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
 * Image upload for the editor. Sits under /admin so the existing Better Auth
 * middleware gates it; there is no unauthenticated write path to the bucket.
 *
 * ## AN ADAPTER, since 2026-09-07, and the store is `upload.server.ts`
 *
 * Everything this route used to do after the bytes arrived, it now asks
 * `storeUpload` to do: refuse, measure, address, put, annotate. Ruling 32d gave
 * MEDIA a second writer in the operator API's `upload_media`, and the sequence
 * is not one two copies stay equal to, so it moved to a door they share. The
 * grounds are at that function; the content-addressing ruling is at
 * `contentKey` in `classify.mjs`, which is where the key is actually made.
 *
 * WHAT IS LEFT HERE IS EXACTLY WHAT IS THIS ROUTE'S: parsing a multipart form,
 * naming its own missing-input refusal, and choosing between a redirect and a
 * JSON body. All three are properties of who is asking rather than of what is
 * being stored, which is the line the extraction was cut along.
 */

/* The accepted types, the size limit and the reply shapes live in
 * `upload-contract.mjs`, which is a plain module `node:test` can load so it can
 * assert them. Two editors read the JSON this route returns and neither may
 * change, so the contract is a tested object rather than a convention. */

/* `slugifyName` lived here to build the human-readable half of a key. Content
 * addressing removed the only caller: the key is a digest now, and the filename
 * goes to `original_name` verbatim rather than being mangled into a slug. */

/**
 * The listing loader that used to live here MOVED to the media page at
 * /admin/media, so there is one lister and one media surface. This route is now
 * the upload endpoint only, which is why it kept the action and lost the
 * loader. Its URL changed from /admin/media to /admin/media/upload; the editor
 * and the picker both post to the new one.
 */

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json(uploadErrorBody("Method not allowed"), { status: 405 });
  }

  const env = getEnv(context);
  const form = await request.formData();
  const file = form.get("file");

  /*
   * WHICH CALLER IS THIS, decided by an EXPLICIT FIELD and by nothing else.
   *
   * The library posts a form and navigates; the two editors `fetch` and read
   * JSON. The library declares itself with a hidden `intent=upload-form`, so
   * the editors keep the JSON path by SENDING NOTHING NEW, which is the whole
   * point: their contract cannot be moved by a header default changing under
   * them. `isFormUpload` is an equality against one token, asserted in
   * test/upload-contract.test.mjs against "1", "true", "" and undefined.
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
   * READ, THEN REFUSE, and the ordering costs nothing measurable.
   *
   * The type and size checks used to run against `file.type` and `file.size`
   * before the bytes were touched, which reads as the thrifty order and is not:
   * `request.formData()` above has already buffered the entire body into this
   * isolate, so `arrayBuffer()` is a copy out of memory rather than a read off
   * the wire, and an oversized post was oversized in here before any of this
   * ran. What the old order actually bought was a second statement of the size
   * rule living in this file, which is the thing the extraction was for.
   *
   * Read once, too: the bytes are needed to hash and to store, and a File's
   * stream cannot be consumed twice.
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
