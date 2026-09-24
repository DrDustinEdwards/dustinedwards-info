// `failed` rows are noise kept only to spot a pattern; `rejected` rows are kept so a re-sender does not
// reappear as new. `unverified` and `pending` are never swept: the global cap counts them, so expiring
// them would quietly raise the cap.

export const FAILED_RETENTION_DAYS = 30;

export const REJECTED_RETENTION_DAYS = 90;

/** @param {number} days */
export function daysInMilliseconds(days) {
  return days * 24 * 60 * 60 * 1000;
}
