/**
 * MEASURE the selected publications filter chip on the deployed site.
 *
 * The question is whether the active chip's text is visible, and what
 * `--on-brand` actually resolves to per theme ON THE WIRE. A source read says
 * `.pub-chip-active` pairs `background: var(--brand)` with `color:
 * var(--on-brand)`; that is a claim about the declaration, not about the
 * rendered pair, so this reads computed values off the live page and computes
 * the contrast ratio rather than asserting one.
 */

import puppeteer from "puppeteer";

const ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";

/** WCAG relative luminance from an rgb()/rgba() string. */
function lum(rgb) {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number);
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setCookie({ name: "theme", value: theme, domain: new URL(ORIGIN).hostname, path: "/" });
  await page.goto(`${ORIGIN}/publications`, { waitUntil: "networkidle2" });

  // The chips are plain links, so "selecting" one is following it. Take the
  // first chip that is not already active.
  const href = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a.pub-chip")].find((x) => !x.classList.contains("pub-chip-active"));
    return a ? a.getAttribute("href") : null;
  });
  if (!href) {
    console.log(`${theme}: no inactive chip found`);
    await page.close();
    continue;
  }
  await page.goto(new URL(href, ORIGIN).href, { waitUntil: "networkidle2" });

  const m = await page.evaluate(() => {
    const el = document.querySelector("a.pub-chip-active");
    if (!el) return null;
    const cs = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    // Walk up for the first non-transparent background actually painted behind it.
    let bg = cs.backgroundColor, node = el;
    while (/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && node.parentElement) {
      node = node.parentElement;
      bg = getComputedStyle(node).backgroundColor;
    }
    return {
      dataTheme: document.documentElement.getAttribute("data-theme"),
      label: el.textContent.trim().slice(0, 40),
      color: cs.color,
      background: bg,
      declaredBg: cs.backgroundColor,
      onBrandToken: root.getPropertyValue("--on-brand").trim(),
      brandToken: root.getPropertyValue("--brand").trim(),
      opacity: cs.opacity,
      visibility: cs.visibility,
      fontSize: cs.fontSize,
      href: location.pathname + location.search,
    };
  });

  if (!m) {
    console.log(`${theme}: no active chip after following ${href}`);
    await page.close();
    continue;
  }

  const r = ratio(m.color, m.background);
  console.log(`\n=== theme=${theme} (data-theme=${m.dataTheme}) at ${m.href}`);
  console.log(`  chip label      ${m.label}`);
  console.log(`  text color      ${m.color}`);
  console.log(`  painted bg      ${m.background}`);
  console.log(`  --on-brand      ${m.onBrandToken}`);
  console.log(`  --brand         ${m.brandToken}`);
  console.log(`  opacity         ${m.opacity}   visibility ${m.visibility}   font-size ${m.fontSize}`);
  console.log(`  contrast        ${r.toFixed(2)}:1  -> ${r >= 4.5 ? "PASSES AA normal text" : r >= 3 ? "passes AA large text only" : "FAILS AA"}`);
  console.log(`  text visible    ${m.color !== m.background && Number(m.opacity) > 0 && m.visibility !== "hidden" ? "YES" : "NO"}`);
  await page.close();
}

await browser.close();
