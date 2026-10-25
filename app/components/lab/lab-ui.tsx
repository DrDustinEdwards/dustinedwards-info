// The small pieces the /lab pages share: a post's result line and a table in Capsomer's scrolling region.

import type { ReactNode } from "react";
import { Alert } from "capsomer/react/banner";

/** The answer to the last post: a status line when it worked, an alert when it did not. */
export function Result({ result }: { result?: { ok: boolean; text: string } | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="cap-muted" role="status">
      Done: {result.text}
    </p>
  ) : (
    <Alert tone="crit">Not done: {result.text}</Alert>
  );
}

/** A table that scrolls on a phone in a labeled, focusable region (DEFAULTS.md). */
export function LabTable({ label, head, children }: { label: string; head: string[]; children: ReactNode }) {
  return (
    <div className="cap-table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className="cap-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
