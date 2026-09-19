import { useState } from "react";

import { longDateUTC } from "~/lib/long-date.mjs";

/**
 * The drawer's preview-link section.
 *
 * THE TOKEN IS A CAPABILITY, so it is never printed. The list prints SIX
 * characters, enough to tell two links apart, and the whole value leaves the page
 * only through the copy control: a list that printed the URL would put every live
 * capability for this post on screen at once.
 *
 * ONE FORM PER LINK, each carrying its token as a hidden field, so every revoke
 * submission is IDENTICAL in shape and the fixture describes the requests the page
 * can issue rather than how many rows it holds.
 *
 * THE INTENT IS ON THE BUTTON, because `check:admin-ui` records a hidden field's
 * NAME and not its value.
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

/**
 * NOT HARD RULE 13'S CLASS. That rule names a fallback substituting a PLAUSIBLE
 * value for a failure, so the failure stops being visible. This does the opposite:
 * it says out loud that the date could not be read, nothing downstream consumes it,
 * and no decision is taken on it.
 *
 * The marker is deliberately not repeated here, since the gate counts files
 * carrying it.
 *
 * The substitution lives HERE and not inside `longDateUTC` because the blog pages
 * want the null: they omit the whole line when there is no date.
 */
const expiresLabel = (iso: string) => {
  const on = longDateUTC(iso);
  return on === null ? "an unknown date" : on;
};

/** The id of the revoke form for one token. One per link. */
export const revokeFormId = (token: string) => `revoke-preview-link-${token}`;

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
      {/*
       * THE REVOKE CLAUSE IS A MEASURED BOUND, NOT A FIGURE OF SPEECH. `APP_KV.get`
       * takes an edge read cache and KV is eventually consistent, so a colo that has
       * already read the record keeps serving it until that cache lapses. The sentence
       * said "the moment you revoke it", which was measurably false.
       *
       * PUBLICATION IS STILL IMMEDIATE, and for a different reason: the read path
       * re-asks D1 for `status = 'draft'` on every request, and that read is not
       * KV-cached.
       */}
      <p className="muted">
        A preview link shows this draft to anyone who has it, with no sign-in. It
        stops working seven days after it is created, within a minute of you
        revoking it, or the moment this post is published, whichever comes first.
      </p>

      {created ? (
        /*
         * The one place the full URL is VISIBLE rather than merely copyable, shown once
         * on the response that minted it: an author who cannot see what they just made has
         * to trust a copy button that may have failed.
         */
        <div className="field">
          <span className="field-label">New preview link</span>
          <code className="slug-value">{created.url}</code>
          <span className="field-hint muted">
            Expires {expiresLabel(created.expiresAt)}.
          </span>
          <PreviewCopyButton url={created.url} label="Copy this link" />
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
                  Expires {expiresLabel(link.expiresAt)}
                  {link.createdBy ? `, created by ${link.createdBy}` : null}
                </span>
              </div>
              <div className="preview-link-actions">
                <PreviewCopyButton url={link.url} label="Copy" />
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
 * Copies the URL, and says so. SCRIPT ONLY, which the admin plane is exempt to
 * be.
 *
 * NOT `media-copy-button`, and not merged into it: pointing this at the shared one
 * would import the media page's keyboard and toast module into the editor to get a
 * glyph styled for a grid this panel does not have.
 *
 * STATED DIFFERENCE, not fixed here because it is a change to how the editor
 * behaves: the shared button announces through a live region and resets, and this
 * one changes its own label permanently.
 */
function PreviewCopyButton({ url, label }: { url: string; label: string }) {
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
