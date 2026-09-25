/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { BASE, bundleFetches, firstPathWith, ok, readSkipLink, root, skip } from "../harness.mjs";

/**
 * The post-page enhancements: the bundles, the copy buttons, the footnote previews and the copy
 * announcement. Returns what the later cases read: the console errors collected from here on, the
 * enhancement stems, and the posts the walk found.
 *
 * @param {import("../harness.mjs").CaseContext} ctx
 */
export async function run({ page }) {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  const loginSkip = await page.evaluate(readSkipLink);
  /* root.tsx renders the skip link on every page, /login included, so its absence is a failure. */
  ok(
    "/login: the skip link exists and its target does",
    loginSkip.link && loginSkip.target,
    loginSkip.link
      ? `the login page renders a skip link to ${JSON.stringify(loginSkip.href)} and nothing ` +
          `carries that id, so keyboard focus goes nowhere`
      : "there is no .skip-link on /login at all",
  );

  /* The Ask stream is not driven because it bills. Console errors are asserted at the end, where CSP refusals show. */
  /** @type {string[]} */
  const publicConsoleErrors = [];
  /** @param {import("puppeteer").Page} p */
  const collectErrors = (p) => {
    p.on("console", (m) => {
      if (m.type() === "error") publicConsoleErrors.push(m.text().slice(0, 200));
    });
    p.on("pageerror", (e) => publicConsoleErrors.push(String(e).slice(0, 200)));
  };
  collectErrors(page);

  /* Stems from app/enhance/, since build/client may be another build's. */
  const enhanceStems = new Set(
    readdirSync(join(root, "app", "enhance"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(/\.ts$/, "")),
  );
  ok(
    "the enhancement module listing is non-empty",
    enhanceStems.size > 0,
    "app/enhance/ lists no modules, so the script-set cases below would assert nothing",
  );

  await page.setViewport({ width: 1280, height: 900 });

  /* Found by walking the listing, since a pinned slug goes stale. */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const postPaths = await page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('.entry-list a[href^="/blog/"]')]
        .map((a) => a.getAttribute("href"))
        /* A post is one segment: each row also links its tags (/blog/tags/x). */
        .filter((h) => h && /^\/blog\/[^/.]+$/.test(h)),
    )].slice(0, 6),
  );
  ok(
    "the /blog listing yields post links to probe",
    postPaths.length > 0,
    "no post link on /blog, so the post-page bundle, copy, footnote and progress cases below " +
      "would have nothing to run on",
  );
  const blogOnIndex = await bundleFetches(page, "blog");
  ok(
    "the blog reading bundle is NOT fetched by the listing page",
    blogOnIndex === 0,
    `${blogOnIndex} request(s) for the blog bundle on /blog. Every enhancement in it ` +
      `targets markup only a rendered post carries, so this is bytes spent to find ` +
      `nothing.`,
  );

  const { found: codePost, last: probedPost } = await firstPathWith(page, postPaths, ".prose pre[data-lang]");

  if (probedPost !== null) {
    // The page is sitting on a post, whichever one the loop stopped at.
    const blogOnPost = await bundleFetches(page, "blog");
    ok(
      "the blog reading bundle IS fetched by a post page",
      blogOnPost === 1,
      `${blogOnPost} request(s) for the blog bundle on ${probedPost}. Zero means the ` +
        `component was removed from the post route as well as the listing, which turns ` +
        `seven enhancements off rather than scoping one bundle.`,
    );
  }

  if (codePost === null) {
    skip(
      "code copy buttons appear on a post with code blocks",
      `none of the first ${postPaths.length} posts carry a pre[data-lang]; the corpus ` +
        `has no code post to observe, which is a content fact, not a defect`,
    );
  } else {
    // The page is already open on codePost from the loop above.
    const decorated = await page.evaluate(() => ({
      copies: document.querySelectorAll(".prose pre[data-lang] .code-copy").length,
      pres: document.querySelectorAll(".prose pre[data-lang]").length,
    }));
    ok(
      `${codePost}: every code block gained a copy button`,
      decorated.pres > 0 && decorated.copies === decorated.pres,
      `${decorated.copies} button(s) on ${decorated.pres} block(s). The blog bundle did ` +
        `not run, or decorateCodeBlock's selector moved.`,
    );
  }

  const { found: footnotePost } = await firstPathWith(page, postPaths, ".prose a[data-footnote-ref]");

  if (footnotePost === null) {
    skip(
      "footnote previews are hoverable, dismissible and persistent",
      `none of the first ${postPaths.length} posts carry a footnote reference, so there ` +
        `is nothing to hover. A content fact, not a defect.`,
    );
  } else {
    const bubbleShown = () =>
      page.evaluate(() => Boolean(document.querySelector(".footnote-preview")));

    // The page is already open on footnotePost from the walk above.
    const footnoteRef = await page.$(".prose a[data-footnote-ref]");
    if (footnoteRef) await footnoteRef.hover();
    else ok(`${footnotePost}: the footnote reference is there to hover`, false, "it vanished after the walk found it");
    await new Promise((r) => setTimeout(r, 150));
    ok(
      `${footnotePost}: hovering a footnote reference shows the preview`,
      await bubbleShown(),
      `no .footnote-preview after hovering the reference. Every assertion below is ` +
        `vacuous without this: the three properties are all about a bubble that exists.`,
    );

    /* Straight to the bubble's center; a gap step would test the grace period. */
    const box = await page.evaluate(() => {
      const el = document.querySelector(".footnote-preview");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (box) await page.mouse.move(box.x, box.y);
    await new Promise((r) => setTimeout(r, 400));
    ok(
      `${footnotePost}: 1.4.13 HOVERABLE, the preview survives the pointer entering it`,
      await bubbleShown(),
      `the bubble was gone 400ms after the pointer moved onto it, which is longer than ` +
        `the grace period. mouseleave on the reference is hiding it without waiting to ` +
        `see whether the pointer arrived, which is the defect: the bubble sits below the ` +
        `reference, so reaching it always crosses that boundary.`,
    );

    /* Asserted with the pointer still inside the bubble, so a failure is the scroll listener, not the pointer leaving. */
    await page.evaluate(() => window.scrollBy(0, 40));
    await new Promise((r) => setTimeout(r, 150));
    ok(
      `${footnotePost}: 1.4.13 PERSISTENT, scrolling does not destroy the preview`,
      await bubbleShown(),
      `a scroll removed the bubble. The reader scrolling to bring a long footnote into ` +
        `view is exactly the person this hurts.`,
    );

    /*
     * DISMISSIBLE. Escape removes it WITHOUT moving focus, which is the part
     * of 1.4.13 that is easy to satisfy wrongly by focusing something else.
     */
    const focusBefore = await page.evaluate(() => document.activeElement?.tagName ?? "");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 150));
    const afterEscape = await page.evaluate(() => ({
      gone: document.querySelector(".footnote-preview") === null,
      focus: document.activeElement?.tagName ?? "",
    }));
    ok(
      `${footnotePost}: 1.4.13 DISMISSIBLE, Escape removes the preview`,
      afterEscape.gone,
      `Escape left the bubble on screen. A reader who cannot move the pointer away, or ` +
        `whose bubble covers the text they were reading, had no way out.`,
    );
    ok(
      `${footnotePost}: dismissing does not move focus`,
      afterEscape.focus === focusBefore,
      `focus went from ${focusBefore} to ${afterEscape.focus}. Dismissing content must ` +
        `not cost the reader their place, which is what 1.4.13 asks for.`,
    );
  }

  /* Asserted on the `role="status"` region; speech is not observable. On the code post the walk
     found, not on whichever post had footnotes: that only ran when one post had both. */
  if (codePost === null) {
    skip(
      "the copy controls announce through a status region",
      `none of the first ${postPaths.length} posts carries a code block, so there is no copy ` +
        `control to press`,
    );
  } else {
    await page.goto(`${BASE}${codePost}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      const button = document.querySelector(".prose pre[data-lang] .code-copy");
      if (button instanceof HTMLElement) button.click();
    });
    await new Promise((r) => setTimeout(r, 250));
    const status = await page.evaluate(() => {
      const region = document.querySelector('[role="status"]');
      return {
        exists: Boolean(region),
        text: region?.textContent?.trim() ?? "",
        visuallyHidden: region ? region.classList.contains("sr-only") : false,
      };
    });
    ok(
      `${codePost}: 4.1.3 the copy control writes into a role=status region`,
      status.exists && status.text.length > 0,
      `region present ${status.exists}, text ${JSON.stringify(status.text)}. A button ` +
        `that relabels itself is a change of NAME, not a status message, and generated ` +
        `::after content is not in the accessibility tree at all.`,
    );
    ok(
      `${codePost}: the status region is visually hidden, not a second visible label`,
      status.exists && status.visuallyHidden,
      status.exists
        ? `the region is not .sr-only, so the announcement is also painted on screen ` +
            `beside the control's own feedback.`
        : "there is no role=status region at all",
    );
  }

  return { publicConsoleErrors, enhanceStems, codePost, probedPost };
}
