/**
 * THE HEADER'S PATHS, IN ONE PLACE, because two consumers now read them.
 *
 * `site-header.tsx` renders a NavLink per entry and `site-speculation.tsx`
 * builds a Speculation Rules payload from the same array. Written as two lists
 * they would drift, and the drift is INVISIBLE: a nav link added without a
 * speculation entry still navigates, just slower, and a speculation entry left
 * behind after a link is removed speculates a URL nothing points at. Neither
 * shows up in a render.
 *
 * That is the mirror anti-pattern hard rule 5 refuses a gate for elsewhere. It
 * is avoidable here because both consumers are code, so the list is DERIVED
 * rather than hand-maintained, and `test/header-speculation.test.mjs` asserts
 * the derivation in both directions.
 *
 * Roster's LABEL and its PATH deliberately disagree; see site-header.tsx.
 */
export const NAV = [
  { to: "/blog", label: "Blog", end: true },
  { to: "/projects", label: "Projects", end: false },
  { to: "/playground", label: "Playground", end: false },
  { to: "/phage-discovery", label: "Roster", end: false },
] as const;

/**
 * Every path the header can navigate to: the brand's `/` plus the nav.
 *
 * DERIVED from NAV, deliberately, rather than written out. The brand link is
 * the one entry that is not a NavLink, so it is the one that has to be named
 * here, and it is named ONCE.
 */
export const HEADER_PATHS: readonly string[] = ["/", ...NAV.map((item) => item.to)];
