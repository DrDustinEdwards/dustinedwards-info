// A `datetime-local` input speaks `YYYY-MM-DDTHH:mm` in the reader's LOCAL time; the post stores UTC ISO.

/** An ISO instant as a `datetime-local` value, or "" when it does not parse. */
export function toLocalInput(iso: string) {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  return new Date(at - new Date(at).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** A `datetime-local` value as an ISO instant, or "" when it is empty or does not parse. */
export function toIso(local: string) {
  if (!local) return "";
  const at = Date.parse(local);
  return Number.isNaN(at) ? "" : new Date(at).toISOString();
}

/** An hour from now, as a `datetime-local` value: the default a new schedule starts from. */
export function anHourFromNowLocal() {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
