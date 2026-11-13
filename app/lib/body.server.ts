/** Ceilings for a request body: a form a reader sends, a signed-in form, and one that carries a picture (upload-contract.mjs). Read with site-runtime ./body readForm and readJson. */
export const FORM_BYTES = 64 * 1024;
export const ADMIN_FORM_BYTES = 1024 * 1024;
export const UPLOAD_FORM_BYTES = 11 * 1024 * 1024;
