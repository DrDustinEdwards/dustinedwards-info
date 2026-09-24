/** Roster's LABEL and its PATH deliberately disagree; see site-header.tsx. */
export const NAV = [
  // About first: a new reader wants to know whose site this is before a post list.
  { to: "/about", label: "About", end: false },
  { to: "/blog", label: "Blog", end: true },
  { to: "/publications", label: "Publications", end: false },
  { to: "/projects", label: "Projects", end: false },
  { to: "/playground", label: "Playground", end: false },
  { to: "/phage-discovery", label: "Roster", end: false },
] as const;
