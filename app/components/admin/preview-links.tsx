import { CopyTextButton } from "~/components/admin/copy-button";
import { longDateUTC } from "~/lib/long-date.mjs";

// The token is a capability: only six characters are printed, and the full URL leaves only via copy.
export interface PreviewLinkView {
  token: string;
  short: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  note: string;
}

export const CREATE_FORM_ID = "create-preview-link";

// Substituted here, not in longDateUTC, because the blog pages want the null to omit the line.
const expiresLabel = (iso: string) => {
  const on = longDateUTC(iso);
  return on === null ? "an unknown date" : on;
};

export const revokeFormId = (token: string) => `revoke-preview-link-${token}`;

export function PreviewLinks({
  links,
  created,
  error = null,
}: {
  links: PreviewLinkView[];
  created: { url: string; expiresAt: string } | null;
  /** Set when the list could not be read: live links may exist that this page cannot show or revoke. */
  error?: string | null;
}) {
  return (
    <>
      {/* Revocation is not instant: `APP_KV.get` has an edge read cache, so a colo that already read
          the record serves it until that lapses. Publication is immediate: the read path re-asks D1. */}
      <p className="muted">
        A preview link shows this draft to anyone who has it, with no sign-in. It
        stops working seven days after it is created, within a minute of you
        revoking it, or the moment this post is published, whichever comes first.
      </p>

      {created ? (
        // Shown in full once, so the author need not trust a copy button that may have failed.
        <div className="field">
          <span className="field-label">New preview link</span>
          <code className="slug-value">{created.url}</code>
          <span className="field-hint muted">
            Expires {expiresLabel(created.expiresAt)}.
          </span>
          <CopyTextButton value={created.url} label="Copy this link" subject="the new preview link" />
        </div>
      ) : null}

      {links.length > 0 ? (
        <ul className="preview-link-list">
          {links.map((link) => (
            <li key={link.token} className="preview-link">
              <div className="preview-link-meta">
                <code className="slug-value">{link.short}...</code>
                <span className="muted">
                  Expires {expiresLabel(link.expiresAt)}
                  {link.createdBy ? `, created by ${link.createdBy}` : null}
                </span>
              </div>
              <div className="preview-link-actions">
                <CopyTextButton
                  value={link.url}
                  label="Copy"
                  name={`the link starting ${link.short}`}
                  subject={`the link starting ${link.short}`}
                />
                <button
                  type="submit"
                  form={revokeFormId(link.token)}
                  name="intent"
                  value="revoke-preview-link"
                  className="row-action"
                >
                  Revoke
                  <span className="sr-only"> the link starting {link.short}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <p className="field-alarm">
          The preview links could not be read, so any live link is not listed here and cannot be
          revoked from this page until it loads: {error}
        </p>
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
