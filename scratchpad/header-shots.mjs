// Ten header shot pairs, sheets as rewritten vs sheets at 5b8007e.
//
//   node scratchpad/header-shots.mjs
//
// For each arm: put that arm's sheets on disk, `npm run build`, record the
// built CSS asset names and bytes, serve with `vite preview` on port 4273,
// and capture `.site-header` on five routes in light and dark. The rewritten
// sheets are restored at the end whatever happens.
//
// Pixel comparison decodes both PNGs in the browser and counts differing
// pixels, so a byte-different PNG with identical pixels still reads 0.000%.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import puppeteer from "puppeteer";
import { readSheets } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const OUT = join(HERE, "shots");
const PORT = 4273;
const ROUTES = ["/", "/blog", "/blog/blog-reading-without-javascript", "/projects", "/search"];
const THEMES = ["light", "dark"];
const sheets = readSheets(REPO);

const saved = new Map(sheets.map((s) => [s, readFileSync(join(REPO, s))]));
const putBefore = () => { for (const s of sheets) copyFileSync(join(HERE, "before", basename(s)), join(REPO, s)); };
const putAfter = () => { for (const [s, buf] of saved) writeFileSync(join(REPO, s), buf); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(500);
  }
  throw new Error(`preview never answered ${url}`);
}

function cssAssets() {
  const dir = join(REPO, "build/client/assets");
  return readdirSync(dir).filter((f) => f.endsWith(".css")).sort()
    .map((f) => `${f} ${statSync(join(dir, f)).size}`);
}

async function arm(name) {
  const b = spawnSync("npm", ["run", "build"], { cwd: REPO, shell: true, encoding: "utf8" });
  if (b.status !== 0) throw new Error(`${name}: build failed\n${b.stdout}\n${b.stderr}`);
  const assets = cssAssets();
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: REPO, shell: true, stdio: "ignore" });
  try {
    await waitFor(`http://localhost:${PORT}/`);
    const browser = await puppeteer.launch();
    const files = [];
    try {
      for (const theme of THEMES) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
        for (const route of ROUTES) {
          await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "networkidle0" });
          await page.evaluate(() => document.fonts.ready);
          const el = await page.$(".site-header");
          if (!el) throw new Error(`${name}: no .site-header on ${route}`);
          const file = join(OUT, `${name}-${theme}-${route.replace(/\W+/g, "_") || "home"}.png`);
          await el.screenshot({ path: file });
          files.push(file);
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
    return { assets, files };
  } finally {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true });
    await sleep(1000);
  }
}

async function diff(a, b) {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    const toUrl = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
    return await page.evaluate(async (ua, ub) => {
      const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
      const [ia, ib] = await Promise.all([load(ua), load(ub)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`, pct: 100 };
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
      const da = px(ia), db = px(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) n++;
      return { size: `${ia.width}x${ia.height}`, pct: (n / (da.length / 4)) * 100 };
    }, toUrl(a), toUrl(b));
  } finally {
    await browser.close();
  }
}

mkdirSync(OUT, { recursive: true });
let after, before;
try {
  after = await arm("after");
  putBefore();
  before = await arm("before");
} finally {
  putAfter();
}
const same = after.assets.join("\n") === before.assets.join("\n");
console.log(`built CSS assets identical by name and size: ${same}`);
for (const l of after.assets) console.log(`  ${l}`);
let bad = 0;
for (let i = 0; i < after.files.length; i++) {
  const d = await diff(before.files[i], after.files[i]);
  if (d.pct !== 0) bad++;
  console.log(`  ${basename(after.files[i]).replace(/^after-/, "").padEnd(52)} ${d.size.padEnd(12)} ${d.pct.toFixed(3)}%`);
}
console.log(`${after.files.length} pairs, ${bad} differing`);
// The differ must be able to say "different": light home against dark home.
const control = await diff(after.files[0], after.files[ROUTES.length]);
console.log(`control (light home vs dark home): ${control.pct.toFixed(3)}%`);
if (control.pct === 0) { console.log("CONTROL FAILED: the differ cannot discriminate"); process.exitCode = 1; }
if (bad || !same) process.exitCode = 1;
