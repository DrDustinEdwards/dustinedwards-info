import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { uiWidthEm } from "~/lib/ui-width";

/** Capsomer's link chips drawn as router links (chips.md, `renderLink`). */
export function chipLink(props: {
  href: string;
  className: string;
  "aria-current"?: "true";
  "data-size"?: string;
  children: ReactNode;
}) {
  const { href, ...rest } = props;
  return <Link to={href} {...rest} />;
}

/** A filter chip's name, its box Inter's width whichever face draws it, so the row wraps the same before and after the font swap (ui-width.ts). */
export function filterName(label: string, current: boolean) {
  const width = { "--name-w": `${uiWidthEm(label, current ? 600 : 400)}em` } as CSSProperties;
  return (
    <span className="filter-name" style={width}>
      {label}
    </span>
  );
}
