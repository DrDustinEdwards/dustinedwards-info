import { mdCell } from "@drdustinedwards/site-helpers/text";

/** A Markdown link whose text cannot end the link or split a table cell: a `]`, `[` or `|` in a name is escaped. */
export function mdLink(/** @type {string} */ text, /** @type {string} */ href) {
  return `[${mdCell(text).replace(/[[\]]/g, "\\$&")}](${href})`;
}
