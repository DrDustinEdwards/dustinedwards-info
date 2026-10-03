import { useRef } from "react";
import { Form } from "react-router";

import { DropAnywhere } from "~/components/admin/media-drop-anywhere";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { ACCEPT_ATTRIBUTE, UPLOAD_FORM_INTENT } from "~/lib/media/upload-contract.mjs";

/** The upload form: one file, loaded by browsing or by dropping anywhere on the page. */
export function MediaUploadForm() {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
      <>
      {/* The hidden `intent` alone selects the upload redirect branch. Images only. */}
      <Form
        method="post"
        action="/admin/media/upload"
        encType="multipart/form-data"
        className="app-actions"
      >
        <label className="cap-field-label" htmlFor="media-file">
          Drop files anywhere, or browse
        </label>
        <input
          ref={fileRef}
          id="media-file"
          className="cap-input"
          type="file"
          name="file"
          accept={ACCEPT_ATTRIBUTE}
        />
        <button
          type="submit"
          name="intent"
          value={UPLOAD_FORM_INTENT}
          className="cap-btn"
          data-variant="primary"
        >
          Upload
        </button>
        <DropAnywhere inputRef={fileRef} />
      </Form>
      </>
  );
}

/** The maintenance menu, in the page head. */
export function MediaMaintenance() {
  return (
    <>
      <OverflowMenu label="Maintenance">
        <Form method="post">
          <button type="submit" name="intent" value="rebuild" className="cap-option" data-menu-item>
            <span className="cap-option-label">Rebuild media index</span>
            <span className="cap-option-hint">
              Re-derive every row from R2 and the repo, preserving alt and captions
            </span>
          </button>
        </Form>
      </OverflowMenu>
    </>
  );
}
