/**
 * THE HEADER'S LINKS, in one place.
 *
 * `site-header.tsx` renders a NavLink per entry. It is the ONLY consumer, and
 * that is a change: from 2026-08-27 until 2026-08-28 `site-speculation.tsx`
 * also read this list, through an exported `HEADER_PATHS`, to build a
 * Speculation Rules `urls` payload.
 *
 * **THAT SECOND CONSUMER IS GONE, AND SO IS THE MIRROR IT CREATED.** The rules
 * are document rules now (`~/lib/speculation.mjs`): they match the links in the
 * rendered document rather than a list of paths, so a header link is covered
 * because it is an `<a href>`, not because someone kept two arrays in step. The
 * drift this module was written to prevent, a nav link with no speculation
 * entry or an entry whose link had been removed, is not merely gated now, it is
 * unrepresentable.
 *
 * `HEADER_PATHS` was deleted with it. A derived export whose only reader has
 * gone is dead configuration that reads as load-bearing, which is worse than
 * either keeping it honest or removing it.
 *
 * Roster's LABEL and its PATH deliberately disagree; see site-header.tsx.
 */
export const NAV = [
  /*
   * ABOUT IS FIRST, and the position is the decision rather than the link.
   *
   * A reader who has just arrived wants to know whose site this is before
   * they want a post list, and the audit measured the alternative: with the
   * university named only inside the home page's Person JSON-LD, a stranger
   * could read the whole site and never learn where the author works.
   */
  { to: "/about", label: "About", end: false },
  { to: "/blog", label: "Blog", end: true },
  { to: "/projects", label: "Projects", end: false },
  { to: "/playground", label: "Playground", end: false },
  { to: "/phage-discovery", label: "Roster", end: false },
] as const;
