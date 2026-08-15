import { useState } from "react";

/**
 * The drawer's preview-link section. Feature G.
 *
 * ## The token is a CAPABILITY, so it is never printed
 *
 * Anyone holding the full URL can read the draft. That makes it the same class
 * of thing as a password, and it gets the same treatment: the list prints SIX
 * characters, which is enough to tell two links apart and to know which one you
 * are revoking, and the whole value leaves the page only through the copy
 * control. A list that printed the URL would put every live capability for this
 * post on screen at once, in something the author might screen-share.
 *
 * ## Why the buttons point at forms that are somewhere else
 *
 * The drawer is a `<dialog>` INSIDE the editing `<Form>`, so a form declared
 * here would be a nested form and the browser would drop it. Association is by
 * the `form` attribute instead, exactly as the delete control already does, and
 * the forms themselves live in the edit route beside the delete form.
 *
 * ONE FORM PER LINK, each carrying its token as a hidden field, rather than one
 * form and a `name="token"` on each button. Both work. The first keeps every
 * revoke submission IDENTICAL in shape, so `check:admin-ui` records one tuple
 * whether the post has one preview link or five, and the fixture describes the
 * requests the page can issue rather than how many rows it happens to hold.
 *
 * THE INTENT IS ON THE BUTTON, not in a hidden field, and that is the delete
 * control's idiom copied deliberately. `check:admin-ui` records a hidden field's
 * NAME and not its value, so an intent carried as `<input type="hidden"
 * name="intent" value="preview-link">` would reach the fixture as the bare word
 * `intent` and the two controls would be told apart only by whether a `token`
 * field happened to be present. The dispatch key belongs where the gate can see
 * its value.
 */

export interface PreviewLinkView {
  token: string;
  /** Six characters. What is printed. */
  short: string;
  /** The whole thing. Reaches the reader only through the copy control. */
  url: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  note: string;
}

/** The id of the form that mints a link. Declared by the edit route. */
export const CREATE_FORM_ID = "create-preview-link";

/** The id of the revoke form for one token. One per link. */
export const revokeFormId = (token: string) => `revoke-preview-link-${token}`;

/** UTC, so the server render and the hydrated one cannot disagree. */
function formatDate(iso: string) {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "an unknown date";
  return new Date(at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PreviewLinks({
  links,
  created,
}: {
  links: PreviewLinkView[];
  /** The link this request just minted, if the last action minted one. */
  created: { url: string; expiresAt: string } | null;
}) {
  return (
    <>
      <p className="muted">
        A preview link shows this draft to anyone who has it, with no sign-in. It
        stops working seven days after it is created, the moment you revoke it,
        or the moment this post is published, whichever comes first.
      </p>

      {created ? (
        /*
         * The one place the full URL is VISIBLE rather than merely copyable.
         *
         * It is shown once, on the response to the request that minted it,
         * because an author who cannot see what they just made has to trust a
         * copy button that may have failed. It is not shown again: reload the
         * page and it is behind the copy control with every other link.
         */
        <div className="field">
          <span className="field-label">New preview link</span>
          <code className="slug-value">{created.url}</code>
          <span className="field-hint muted">
            Expires {formatDate(created.expiresAt)}.
          </span>
          <CopyButton url={created.url} label="Copy this link" />
        </div>
      ) : null}

      {links.length > 0 ? (
        <ul className="preview-link-list">
          {links.map((link) => (
            <li key={link.token} className="preview-link">
              <div className="preview-link-meta">
                {/* Six characters and an ellipsis, so nobody reads it as the
                    whole token and tries to type it into an address bar. */}
                <code className="slug-value">{link.short}...</code>
                <span className="muted">
                  Expires {formatDate(link.expiresAt)}
                  {link.createdBy ? `, created by ${link.createdBy}` : null}
                </span>
              </div>
              <div className="preview-link-actions">
                <CopyButton url={link.url} label="Copy" />
                <button
                  type="submit"
                  form={revokeFormId(link.token)}
                  name="intent"
                  value="revoke-preview-link"
                  className="row-action"
                >
                  Revoke
                  <span className="sr-only"> the link ending {link.short}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No preview links for this draft.</p>
      )}

      <button
        type="submit"
        form={CREATE_FORM_ID}
        name="intent"
        value="preview-link"
        className="row-action"
      >
        Create a preview link
      </button>
    </>
  );
}

/**
 * Copies the URL, and says so.
 *
 * SCRIPT ONLY, and that is permitted here rather than an oversight: the admin
 * plane is exempt from the progressive-enhancement law, and the same control
 * already exists on the slug field. Without script the button does nothing,
 * which is the state the whole editor is in.
 */
function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="row-action"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
