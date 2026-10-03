/**
 * NAMES ONLY: nothing that reads this may return a value. `CLOUDFLARE_ACCOUNT_ID` is left off
 * deliberately: it is a plain var and an identifier, not a credential.
 *
 * @type {readonly string[]}
 */
export const REQUIRED_SECRETS = [
  "GITHUB_TOKEN",
  "OPERATOR_TOKEN",
  "CARREL_SITE_KEY",
  "SMOKE_TOKEN",
  "OPENALEX_API_KEY",
];
