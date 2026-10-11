/**
 * What every /lab form reads the same way: a trimmed field, a real calendar date, today's date in UTC, and an amount.
 * Pure, so the members, inventory and run pages refuse the same bad input with the same words.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A field's trimmed text, or "" when it is absent or a file. @param {FormData} form @param {string} name */
export function field(form, name) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** A real calendar date in YYYY-MM-DD: 2027-02-30 and 2026-13-01 are not. @param {string} text */
export function isDate(text) {
  const ms = Date.parse(`${text}T00:00:00Z`);
  return DATE.test(text) && !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === text;
}

/** Today in UTC, as YYYY-MM-DD. @param {number} nowMs */
export function today(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * An optional amount: null when blank, a finite number of zero or more, or a refusal in words.
 * @param {string} text
 * @returns {{ ok: true, value: number | null } | { ok: false, reason: string }}
 */
export function amountOf(text) {
  if (text === "") return { ok: true, value: null };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return { ok: false, reason: `Not an amount: ${text}.` };
  return { ok: true, value };
}

/** A positive whole number from an address or a form, or null: "abc", "1.5" and "0" are not ids. @param {unknown} text */
export function idOf(text) {
  const id = Number(text);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** "5 mL", or "5" when a lot has no unit. @param {number} amount @param {string | null} unit */
export function amountText(amount, unit) {
  return unit ? `${amount} ${unit}` : String(amount);
}
