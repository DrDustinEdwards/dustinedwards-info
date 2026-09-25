// The operator token ship needs to bring the Ask and media indexes into step. Read from the file
// OPERATOR_TOKEN_FILE names, never an argument and never printed.

import { readFileSync } from "node:fs";

/**
 * The token, or the refusal ship makes when it cannot have one. Checked before the build, so a
 * missing token costs no deploy. The length floor matches `auth.server.ts`.
 *
 * @param {string | undefined} tokenFile the value of OPERATOR_TOKEN_FILE
 * @returns {{ token: string, why: string, remedy: string }} `why` is empty when the token is usable
 */
export function readOperatorToken(tokenFile) {
  if (!tokenFile) {
    return {
      token: "",
      why: "OPERATOR_TOKEN_FILE is not set, so ship cannot bring the Ask index into step",
      remedy:
        "Point OPERATOR_TOKEN_FILE at a file holding the operator token. It is a " +
        "wrangler secret, it is not in the repository, and it must not be pasted " +
        "into a command line. Nothing has been built or deployed.",
    };
  }
  let token = "";
  try {
    token = readFileSync(tokenFile, "utf8").trim();
  } catch {
    return {
      token: "",
      why: `OPERATOR_TOKEN_FILE points at a file that cannot be read: ${tokenFile}`,
      remedy: "Nothing has been built or deployed.",
    };
  }
  if (token.length < 32) {
    return {
      token: "",
      why: "the token in OPERATOR_TOKEN_FILE is shorter than the 32 characters the Worker requires",
      remedy:
        "auth.server.ts treats a short secret as a misconfiguration and answers 503. " +
        "Nothing has been built or deployed.",
    };
  }
  return { token, why: "", remedy: "" };
}
