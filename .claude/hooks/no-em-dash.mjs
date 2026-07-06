// PostToolUse hook: reject em dashes (U+2014) in any edited or written file.
// The em dash is matched by code point so this source stays ASCII clean.
// Exit 2 blocks the edit and feeds the message back to Claude.
import { readFileSync } from "node:fs";

const EM_DASH = 0x2014;

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input || "{}");
    const file = event?.tool_input?.file_path;
    if (!file) process.exit(0);

    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      process.exit(0);
    }

    for (const ch of text) {
      if (ch.codePointAt(0) === EM_DASH) {
        console.error(
          `Em dash (U+2014) found in ${file}. Em dashes are banned in this repo. Replace it before continuing.`,
        );
        process.exit(2);
      }
    }
  } catch {
    // Never block on a malformed event.
  }
  process.exit(0);
});
