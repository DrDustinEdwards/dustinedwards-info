/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// The interactive CV (app/routes/cv.tsx, app/enhance/cv.ts): the whole CV is in the server HTML with
// script off and a filter URL renders filtered there too; live, a filter changes the URL, the entries,
// the counts and the chart together, and a year's bar filters to that year.

import { BASE, clickOrFail, ok, pollUntil } from "../harness.mjs";

/** @param {import("puppeteer").Page} page */
const readCv = (page) =>
  page.evaluate(() => ({
    search: location.search,
    all: document.querySelectorAll("li[data-cv-entry]").length,
    shown: document.querySelectorAll("li[data-cv-entry]:not([hidden])").length,
    shownTypes: [
      ...new Set([...document.querySelectorAll("li[data-cv-entry]:not([hidden])")].map((li) => li.getAttribute("data-type"))),
    ],
    papers: document.querySelector('[data-cv-count="papers"]')?.textContent ?? "",
    grants: document.querySelector('[data-cv-count="grants"]')?.textContent ?? "",
    bars: document.querySelectorAll("[data-cv-timeline] [data-abscissa-key]").length,
    barLinks: document.querySelectorAll("[data-cv-timeline] a[href][data-abscissa-key]").length,
    enhanced: document.querySelector("[data-cv]")?.hasAttribute("data-cv-enhanced") ?? false,
  }));

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  /* Script off, in a page of its own, so the shared page keeps its script. */
  const off = await browser.newPage();
  try {
    await off.setJavaScriptEnabled(false);
    await off.goto(`${BASE}/cv`, { waitUntil: "load" });
    const full = await readCv(off);
    ok(
      "cv, script off: every entry is in the server HTML and none is hidden",
      full.all > 200 && full.shown === full.all && Number(full.papers) > 30,
      `${full.shown} of ${full.all} entries shown, ${full.papers} publications counted`,
    );
    ok(
      "cv, script off: the timeline is server-rendered, each bar a link to its year",
      full.bars > 10 && full.barLinks === full.bars,
      `${full.barLinks} of ${full.bars} bars are links`,
    );
    await off.goto(`${BASE}/cv?type=grant&from=2020`, { waitUntil: "load" });
    const filtered = await readCv(off);
    ok(
      "cv, script off: a filter URL renders filtered, with the counts to match",
      filtered.all === full.all &&
        filtered.shown > 0 &&
        filtered.shown < full.all &&
        filtered.shownTypes.join() === "grant" &&
        filtered.grants === String(filtered.shown) &&
        filtered.papers === "0",
      JSON.stringify(filtered),
    );
  } finally {
    await off.close();
  }

  /* Live, in a page of its own too: this case must not leave the shared page somewhere else. */
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/cv`, { waitUntil: "networkidle0" });
    const start = await readCv(page);
    ok("cv: the enhancement ran", start.enhanced, "no data-cv-enhanced on [data-cv]: app/enhance/cv.ts did not run");

    if (await clickOrFail(page, 'input[name="type"][value="publication"]', "cv: the Publications type filter is on the page")) {
      const pubs = await pollUntil(() => readCv(page), (v) => v.search.includes("type=publication"));
      ok(
        "cv: ticking a type filters in place and writes the URL",
        pubs.search === "?type=publication" && pubs.shownTypes.join() === "publication" && pubs.shown === Number(pubs.papers),
        JSON.stringify(pubs),
      );
      ok(
        "cv: the counts follow the filter",
        pubs.grants === "0" && pubs.papers === start.papers,
        `publications ${pubs.papers} (was ${start.papers}), grants ${pubs.grants}`,
      );

      /* A bar, once Abscissa's layer has made it a control: clicking it selects its year. */
      const year = await page.evaluate(
        () => document.querySelector("[data-cv-timeline] [data-abscissa-key]")?.getAttribute("data-abscissa-x") ?? "",
      );
      if (await clickOrFail(page, `[data-cv-timeline] [data-abscissa-x="${year}"]`, "cv: the timeline has a year to select")) {
        const oneYear = await pollUntil(() => readCv(page), (v) => v.search.includes(`from=${year}`));
        ok(
          "cv: a year's bar filters to that year and keeps the other filters",
          oneYear.search === `?type=publication&from=${year}&to=${year}` && oneYear.shown > 0 && oneYear.shown < pubs.shown,
          JSON.stringify(oneYear),
        );
        const faded = await page.evaluate(() => document.querySelectorAll("[data-cv-timeline] [data-abscissa-dimmed]").length);
        ok("cv: the chart shows the year it filters to, dimming the others", faded > 0, `${faded} dimmed bars`);
      }

      /* The URL it wrote is the one a reader shares: loaded fresh, it renders the same view. */
      const shared = page.url();
      const again = await browser.newPage();
      try {
        await again.setJavaScriptEnabled(false);
        await again.goto(shared, { waitUntil: "load" });
        const fresh = await readCv(again);
        const live = await readCv(page);
        ok(
          "cv: the written URL, loaded with script off, shows the same entries",
          fresh.shown === live.shown && fresh.papers === live.papers,
          `live ${live.shown}, fresh ${fresh.shown}`,
        );
      } finally {
        await again.close();
      }
    }
  } finally {
    await page.close();
  }
}
