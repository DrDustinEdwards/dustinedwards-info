---
name: verify
description: Use before committing or opening a pull request that changes what dustinedwards.info shows or does (app/, app/enhance/, stylesheets, content rendering). Boots the production build locally with preview:local, drives the changed flow in a real Chromium with the repo's own puppeteer, runs the existing check:browser case group that covers the area, and reports the evidence. Admin and Ask are not provable here. The landing steps that follow are the ship skill.
---

# Verify a change

Do it before the commit and before the pull request. What comes after is
`.claude/skills/ship/SKILL.md`.

## 1. Boot the preview build

On the repo's Node (`.nvmrc`; in a cloud session put the Node 26 the SessionStart
hook installs on PATH).

```sh
npm ci
npx wrangler d1 migrations apply dustinedwards --local
npm run build:stack
npm run build:content
npm run sync:content -- --local
npm run preview:local   # run in the background, log to the scratchpad; note its PID
```

The middle four are the CI order (`.github/workflows/systems-map.yml`); a fresh
checkout has no `content/generated/` and the build stops on a missing
`stack.json` without them. `preview:local` builds with `PREVIEW_LOCAL=1`, serves
the production build on port 4173 and cleans up after itself on Ctrl+C or the next
run. Wait for it, then confirm the server is this repo's, since a busy port can
hold another app:

```sh
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/)" = 200 ]; do sleep 2; done
curl -s http://localhost:4173/ | grep -o '<title>[^<]*'   # Dustin Edwards, Professor and Virologist
```

If 4173 is already held by something else, find out what before going on; the
preview uses `--strictPort` and will not move.

## 2. Drive the changed flow

Write a short script in the session's scratchpad, never in the repo. Use the repo's
puppeteer (the driver `check:browser` uses). Name each step as a visitor would say
it, assert what they should see, and keep the end-state screenshot.

```js
// <scratchpad>/drive.mjs: REPO=<repo> node drive.mjs http://localhost:4173
import { createRequire } from "node:module";
const puppeteer = createRequire(`${process.env.REPO}/package.json`)("puppeteer");
const base = process.argv[2];
const browser = await puppeteer.launch({
  headless: true,
  args: process.env.NO_SANDBOX ? ["--no-sandbox"] : [],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const log = [];
async function step(name, fn) {
  try {
    await fn();
    log.push(`ok   ${name}`);
  } catch (e) {
    log.push(`FAIL ${name}: ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: "fail.png", fullPage: true });
    throw e;
  }
}
try {
  await step("open the home page", async () => {
    const r = await page.goto(base, { waitUntil: "networkidle0" });
    if (!r.ok()) throw new Error(`status ${r.status()}`);
    if (!(await page.title()).includes("Dustin Edwards"))
      throw new Error(`wrong site: ${await page.title()}`);
  });
  await step("open Writing", async () => {
    await page.goto(`${base}/writing`, { waitUntil: "networkidle0" });
    await page.waitForSelector("main a[href^='/writing/']");
  });
  await step("open the first post", async () => {
    const href = await page.$eval("main a[href^='/writing/']", (a) => a.getAttribute("href"));
    await page.click(`main a[href='${href}']`);
    // The site navigates in place, so wait for the address, not a page load.
    await page.waitForFunction((h) => location.pathname === h, {}, href);
    await page.waitForSelector("main h1");
  });
  // ...the changed flow: click, type, then assert what a visitor should see.
  await page.screenshot({ path: "after.png", fullPage: true });
} finally {
  console.log(log.join("\n"));
  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();
}
```

Drive the whole flow (act, see the result, reload and see it hold); repeat the end
state at 390 px (`page.setViewport`) and dark (`page.emulateMedia({ colorScheme:
"dark" })`) for a layout or style change. For anything that must work without script,
use `page.setJavaScriptEnabled(false)`. The header's section links sit behind a menu
button at some widths, so click what a visitor can see, not a selector read off the
HTML.

Chrome: puppeteer's own download may be missing in a cloud session. Puppeteer
honors `PUPPETEER_EXECUTABLE_PATH` (the container sets it to `/usr/bin/google-chrome`;
`/opt/pw-browsers/chromium` also works). If Chrome refuses to start as root, add
`NO_SANDBOX=1` to the command. Do not run an install.

## 3. Run the check:browser group that covers the area

`npm run check:browser` runs every case in one sequence, builds its own preview,
needs the admin credential for its last group and takes minutes: it is CI's, not
this step's. It has no way to run one group, so run the group's module directly,
through the same harness, against the server from step 1 (the harness fixes
port 4173):

```js
// <scratchpad>/case.mjs: REPO=<repo> node case.mjs header-menus [more case names]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const repo = process.env.REPO;
const puppeteer = createRequire(`${repo}/package.json`)("puppeteer");
const { tally } = await import(pathToFileURL(`${repo}/scripts/lib/browser/harness.mjs`));
const browser = await puppeteer.launch({
  headless: true,
  args: process.env.NO_SANDBOX ? ["--no-sandbox"] : [],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
try {
  for (const name of process.argv.slice(2)) {
    const group = await import(pathToFileURL(`${repo}/scripts/lib/browser/cases/${name}.mjs`));
    await group.run({ page, browser });
  }
} finally {
  await browser.close();
}
console.log(`${tally.checks} checks, ${tally.failures} failures`);
process.exitCode = tally.failures > 0 ? 1 : 0;
```

Run `cd <scratchpad> && REPO=<repo> node case.mjs header-menus`. It prints a FAIL
line for each failed check and ends with the count. The cases share one page and
a case that navigates voids the ones after it, so name only the groups you need,
in the gate's order. Groups are in `scripts/lib/browser/cases/`, named for the area (`layout`, `lightbox`,
`offline`, `cv`, `systems`); the less obvious ones:

| Change touches                           | Case               |
| ---------------------------------------- | ------------------ |
| header, section menus                    | `header-menus`     |
| page-to-page transitions, reduced motion | `navigation`       |
| hover prefetch, speculation rules        | `speculation`      |
| sitemap, old feed addresses              | `sitemap-feeds`    |
| protocol run mode                        | `run-mode`         |
| step calculators                         | `step-calculators` |
| /media scripts and SVG                   | `media-svg`        |

Not runnable alone: `enhancements`, `post-controls`, `math` and `script-set` take
what an earlier case returns, `theme-cache` and `admin` run in their own lanes. For
those, drive the flow in step 2 and leave the case to CI. For a change in no
group, step 2 is the proof.

## 4. When local cannot show it

`preview:local` leaves the `AI_SEARCH` and `IMAGES` bindings out, so Ask is off and
`/media` images are not resized. Admin is behind Cloudflare Access and no token is
minted for localhost (docs/RUNBOOK.md), so no signed-in screen can be driven. Say
"not verified locally" and name them; the proof is `npm run verify-live` after the
merge deploys (ship step 6).

## Rules

A failed step is a finding about the change: fix the code and rerun the same script;
no sleeps, no looser selectors. Stop the preview by the PID you noted and confirm
port 4173 no longer answers.

## The report

Put this in the reply and the pull request body:

- First line: verified, partly verified (and what was not), or failed.
- Each step's ok or FAIL line, the console errors line, and the end-state screenshot
  attached.
- The case group's last line (`N checks, 0 failures`), and which groups ran.
- Not verified: Ask, resized images, admin, live data; `verify-live` after the merge
  is their check.
