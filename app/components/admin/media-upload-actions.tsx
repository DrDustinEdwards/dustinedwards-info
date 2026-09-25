import { useRef } from "react";
import { Form } from "react-router";

import { DropAnywhere } from "~/components/admin/media-drop-anywhere";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { ACCEPT_ATTRIBUTE, UPLOAD_FORM_INTENT } from "~/lib/media/upload-contract.mjs";

/** The media panel's header actions: the upload form and the maintenance menu. */
export function MediaUploadActions() {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
        <>
        {/* The hidden `intent` alone selects the upload redirect branch. Images only. */}
        <Form
          method="post"
          action="/admin/media/upload"
          encType="multipart/form-data"
          className="media-upload"
        >
          <label className="media-upload-label" htmlFor="media-file">
            Drop files anywhere, or browse
          </label>
          <input
            ref={fileRef}
            id="media-file"
            type="file"
            name="file"
            accept={ACCEPT_ATTRIBUTE}
          />
          <DropAnywhere inputRef={fileRef} />
          <button type="submit" name="intent" value={UPLOAD_FORM_INTENT} className="btn">
            Upload
          </button>
        </Form>

        <OverflowMenu label="Maintenance">
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="rebuild"
              className="overflow-menu-item"
              data-menu-item
            >
              Rebuild media index
              <span className="overflow-menu-item-hint">
                Re-derive every row from R2 and the repo, preserving alt and captions
              </span>
            </button>
          </Form>
        </OverflowMenu>
        </>
  );
}
