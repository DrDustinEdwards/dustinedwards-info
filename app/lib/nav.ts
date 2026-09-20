/**
 * THE HEADER'S LINKS, in one place.
 *
 * `site-header.tsx` renders a NavLink per entry and is the ONLY consumer. A second one read this
 * list to build a Speculation Rules payload, and **that mirror is gone**: the rules are document
 * rules now, matching links in the rendered document rather than a list of paths, so the drift this
 * module was written to prevent is not merely gated, it is unrepresentable.
 *
 * `HEADER_PATHS` went with it: a derived export whose only reader has gone is dead configuration
 * that reads as load-bearing.
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
  { to: "/publications", label: "Publications", end: false },
  { to: "/projects", label: "Projects", end: false },
  { to: "/playground", label: "Playground", end: false },
  { to: "/phage-discovery", label: "Roster", end: false },
] as const;
