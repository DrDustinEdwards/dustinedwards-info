/**
 * NAMES ONLY: nothing that reads this may return a value. `CLOUDFLARE_ACCOUNT_ID` is left off
 * deliberately: it is a plain var and an identifier, not a credential.
 *
 * @type {readonly string[]}
 */
export const REQUIRED_SECRETS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "ADMIN_EMAIL",
  "GITHUB_TOKEN",
  "OPERATOR_TOKEN",
  "ANALYTICS_READ_TOKEN",
  "SMOKE_TOKEN",
  "OPENALEX_API_KEY",
];
