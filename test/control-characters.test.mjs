import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { collector, root } from "./lib/invariants-harness.mjs";

test("no tracked text file carries a raw control or invisible character", async (t) => {
  const { ok, done } = collector();

  /* A shell-expanded escape reaches disk as one byte and still looks right. An intended one is
   * written as an escape, so a raw byte is a defect anywhere. */
  {
    const BINARY = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|avif|ico|pdf|zip|wasm|mp4|mp3|sqlite|db)$/i;
    const NAMES = new Map([
      [0x00, "NUL"], [0x07, "BEL"], [0x08, "BACKSPACE"], [0x0b, "VERTICAL TAB"],
      [0x0c, "FORM FEED"], [0x1b, "ESC"], [0x7f, "DEL"],
    ]);
    const INVISIBLE = new Map([
      ["\uFEFF", "U+FEFF BYTE ORDER MARK"],
      ["\u200B", "U+200B ZERO WIDTH SPACE"],
      ["\u200C", "U+200C ZERO WIDTH NON-JOINER"],
      ["\u200D", "U+200D ZERO WIDTH JOINER"],
      ["\u2060", "U+2060 WORD JOINER"],
    ]);

    /* No `shell: true`: on Windows that joins argv unquoted. */
    const listed = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    ok(
      "[scope] git ls-files answered",
      listed.status === 0 && typeof listed.stdout === "string",
      `git ls-files exited ${listed.status}. A scan over no files reports what a clean tree reports.`,
    );
    const tracked = (listed.stdout ?? "").split(String.fromCharCode(10)).filter(Boolean);

    let scanned = 0;
    let skipped = 0;
    /** @type {string[]} */
    const offences = [];
    /** @type {string[]} */
    const unreadable = [];

    for (const rel of tracked) {
      if (BINARY.test(rel)) {
        skipped += 1;
        continue;
      }
      let buf;
      try {
        buf = readFileSync(join(root, rel));
      } catch (error) {
        // An unread file was not scanned, so skipping it quietly would report it clean.
        unreadable.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      scanned += 1;

      for (let i = 0; i < buf.length; i += 1) {
        const v = buf[i];
        if ((v < 0x20 && v !== 0x09 && v !== 0x0a && v !== 0x0d) || v === 0x7f) {
          const line = buf.subarray(0, i).toString("utf8").split("\n").length;
          offences.push(`${rel}:${line} 0x${v.toString(16).padStart(2, "0")} ${NAMES.get(v) ?? "control"}`);
          break;
        }
      }

      const text = buf.toString("utf8");
      for (const [ch, name] of INVISIBLE) {
        const at = text.indexOf(ch);
        if (at === -1) continue;
        offences.push(`${rel}:${text.slice(0, at).split("\n").length} ${name}`);
        break;
      }
    }

    /* Both halves floored: an empty glob or an over-wide binary rule reports a clean sweep. */
    ok(
      "[scope] the control-character scan read the tracked tree",
      scanned >= 400 && skipped >= 50,
      `scanned ${scanned} text file(s) and skipped ${skipped} binary file(s). Below either floor the ` +
        `scan has stopped reading the repository and the result below means nothing.`,
    );
    ok(
      "every tracked text file could be read",
      unreadable.length === 0,
      `${unreadable.length} could not be read, so were not scanned:\n      ${unreadable.join("\n      ")}`,
    );
    ok(
      "no tracked text file carries a raw control or invisible character",
      offences.length === 0,
      `${offences.length} file(s) carry one. An escape written in prose can reach disk as a control ` +
        `byte, render close enough to correct to survive review, and sit there: this test exists ` +
        `because that happened three times. Write the escape so the shell cannot expand it, or use ` +
        `the literal character:\n      ${offences.join("\n      ")}`,
    );
    t.diagnostic(`     ${scanned} text file(s) scanned, ${skipped} binary skipped, ${offences.length} offense(s)`);
  }

  done();
});

