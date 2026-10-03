// Runs only the admin cases of check:browser against the local preview (ADMIN_ORIGIN) with the smoke token.
import puppeteer from "puppeteer";
import * as admin from "../../scripts/lib/browser/cases/admin.mjs";
import { tally } from "../../scripts/lib/browser/harness.mjs";

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const ran = await admin.run({ browser });
await browser.close();
console.log(`\n${tally.checks} checks, ${tally.failures} failures, ran=${ran}`);
