---
name: verify
description: Use before committing or opening a pull request that changes what dustinedwards.info shows or does (app/, app/enhance/, stylesheets, content rendering). Boots the production build locally with preview:local, drives the changed flow in a real Chromium with the repo's own puppeteer, runs the existing check:browser case group that covers the area, and reports the evidence. Admin and Ask are not provable here. The landing steps that follow are the ship skill.
---

# Verify a change

The gates prove what someone thought to test. This skill proves the change itself: run
the real site, use the changed flow as a visitor would, and look at the result. Do it
before the commit and before the pull request. What comes after (gate tiers, the PR,
CI, the deploy, `verify-live`) is `.claude/skills/ship/SKILL.md`; nothing here repeats it.

The site stores no visitor data (CLAUDE.md). Drive it with no sign-in, no cookie
set on purpose and nothing typed that is a real person's. Never deploy:
`.claude/hooks/no-direct-deploy.sh` refuses it, and so does this skill.

## 1. Boot the preview build

On the repo's Node (`.nvmrc`, 26.13.1; in a cloud session
`export PATH=$HOME/.cache/capsid-node/node-v26.13.1-linux-x64/bin:$PATH`).
`wrangler.jsonc` is never touched.

```sh
npm ci
npx wrangler d1 migrations apply dustinedwards --local
npm run build:stack
npm run build:content
npm run sync:content -- --local
npm run preview:local   # run in the background, log to the scratchpad
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
// errors, log and step(): the helpers in devkit docs/verify.md
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

Drive the whole flow, not just the load: act, see the result change, reload and see
it hold. For a layout or style change repeat the end state at 390 px wide
(`page.setViewport`) and dark (`page.emulateMedia({ colorScheme: "dark" })`). For
anything that must work without script, use
`browser.createBrowserContext()` and `page.setJavaScriptEnabled(false)`. The
header's section links sit behind a menu button at some widths, so click what
a visitor can see, not a selector read off the HTML.

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
in the gate's order. Groups in `scripts/lib/browser/cases/` and what they cover:

| Change touches                           | Case               |
| ---------------------------------------- | ------------------ |
| header, section menus                    | `header-menus`     |
| page-to-page transitions, reduced motion | `navigation`       |
| hover prefetch, speculation rules        | `speculation`      |
| sitemap, old feed addresses              | `sitemap-feeds`    |
| layout, shift, widths                    | `layout`           |
| image lightbox                           | `lightbox`         |
| protocol run mode                        | `run-mode`         |
| keep on this device, offline             | `offline`          |
| step calculators                         | `step-calculators` |
| /media scripts and SVG                   | `media-svg`        |
| the CV page and filters                  | `cv`               |
| /systems                                 | `systems`          |

Not runnable alone: `enhancements`, `post-controls`, `math` and `script-set` take
what an earlier case returns, `theme-cache` and `admin` run in their own lanes. For
those, drive the flow in step 2 and leave the case to CI. For a change in no
group, step 2 is the proof.

## 4. When local cannot show it

`preview:local` leaves the `AI_SEARCH` and `IMAGES` bindings out, so Ask is off and
`/media` images are not resized. Admin is behind Cloudflare Access and a token is
never minted for localhost or a preview address (docs/RUNBOOK.md), so no
signed-in screen can be driven. For these, say "not verified locally" and name
them; the proof is the live check after the merge deploys, `npm run verify-live`,
in ship step 6. For a page that needs the real bindings (Ask, resized images),
use the Worker Preview link when ship's visual-change step has one for the PR:
pass it to the same script as the base URL (`node drive.mjs <preview-url>`), and
drive public pages only. The repo has no workflow that posts such a link, so if
none exists, do not invent one; say the PR has no preview and leave the check to
`verify-live`.

## Rules and report

Follow the Rules and the report in [devkit's docs/verify.md](https://github.com/DrDustinEdwards/devkit/blob/main/docs/verify.md). For this repo:

- Stop the preview and confirm port 4173 no longer answers.
- The report names the case group's last line (`N checks, 0 failures`) and which groups ran.
- Anything local cannot show (Ask, resized images, admin, live data), named as not
  verified, with `verify-live` after the merge as its check.
