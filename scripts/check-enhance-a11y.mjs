// The blog enhancements' accessibility, asserted on source because check:browser skips without a
// local corpus: the lightbox is a real modal dialog, footnote previews meet WCAG 1.4.13, the copy
// controls announce, and a heading permalink moves focus. Moved out of check:policy.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments.mjs";

import { assertFloor } from "./lib/floor.mjs";
import { createTally } from "./lib/tally.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const tally = createTally({ print: false });
const { eq } = tally;

/* THE LIGHTBOX IS A REAL MODAL DIALOG, asserted on source because check:browser skips. */
{
  const blog = stripComments(readFileSync(join(root, "app/enhance/blog.ts"), "utf8"));
  const overlay = blog.slice(blog.indexOf("function openOverlay"));
  const body = overlay.slice(0, overlay.indexOf("\n}"));
  eq("lightbox: the scan found openOverlay", body.length > 200, true);
  eq(
    "lightbox: it creates a dialog, not a div",
    /createElement\("dialog"\)/.test(body) && !/createElement\("div"\)/.test(body),
    true,
  );
  eq("lightbox: it opens with showModal", /showModal\(\)/.test(body), true);
  eq("lightbox: it carries an accessible name", /aria-label/.test(body), true);
  eq("lightbox: it has a close button", /lightbox-close/.test(body), true);
  eq(
    "lightbox: focus is restored on close",
    /addEventListener\("close"[\s\S]{0,200}restoreFocus\(\)/.test(body),
    true,
  );
}

{
  const blog = stripComments(readFileSync(join(root, "app/enhance/blog.ts"), "utf8"));
  const fn = blog.slice(blog.indexOf("function footnotePreviews"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  eq("footnotes: the scan found footnotePreviews", body.length > 200, true);
  eq(
    "footnotes: 1.4.13 hoverable, leaving schedules a hide rather than performing one",
    /scheduleHide/.test(body) && /setTimeout\(hide/.test(body),
    true,
  );
  eq(
    "footnotes: 1.4.13 hoverable, entering the bubble cancels the hide",
    /bubble\.addEventListener\("mouseenter", cancelHide\)/.test(body),
    true,
  );
  eq(
    "footnotes: 1.4.13 dismissible by Escape",
    /"Escape"/.test(body) && /keydown/.test(body),
    true,
  );
  eq(
    "footnotes: 1.4.13 persistent, no scroll listener destroys the bubble",
    !/addEventListener\("scroll"/.test(body),
    true,
  );
  eq(
    "footnotes: 1.3.1 the reference is described by its preview, and gets its old description back",
    /setAttribute\("aria-describedby", `\$\{bubble\.id\} \$\{prior\}`\)/.test(body) &&
      /owner\?\.setAttribute\("aria-describedby", prior\)/.test(body),
    true,
  );

  eq(
    "copy controls: there is a role=status region",
    /setAttribute\("role", "status"\)/.test(blog),
    true,
  );
  eq(
    "copy controls: all three announce through it",
    (blog.match(/announce\(/g) ?? []).length >= 4,
    true,
  );

  const headings = blog.slice(blog.indexOf("function headingLinks"));
  eq(
    "heading permalinks: activating one moves focus to the heading",
    /heading\.focus\(\)/.test(headings.slice(0, 2000)),
    true,
  );
}

/* Measured by running this gate, and it moves with the measurement: slack is the defect. */
const MINIMUM_CHECKS = 15;
const floorBreach = assertFloor("check:enhance-a11y", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:enhance-a11y FAILED, ${tally.failures} of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:enhance-a11y ok. ${tally.checks} assertions, 0 failures.`);
