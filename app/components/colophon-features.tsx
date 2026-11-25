import { Link } from "react-router";

import features from "../../content/features.json";

export type Anchor = {
  kind: string;
  path?: string;
  gate?: string;
  text?: string;
  id?: string;
  anonymousGet?: boolean;
};

export function byComponent() {
  const groups = new Map<string, typeof features.features>();
  for (const feature of features.features) {
    const existing = groups.get(feature.component);
    if (existing) existing.push(feature);
    else groups.set(feature.component, [feature]);
  }
  return [...groups.entries()];
}

/** A gate anchor names the script rather than linking: the scripts are not served. */
export function AnchorItem({ anchor }: { anchor: Anchor }) {
  if (anchor.kind === "route" && anchor.path) {
    /* A link a reader cannot follow reads as evidence until clicked, so such a path is named, not linked. */
    const followable =
      !anchor.path.includes(":") && !anchor.path.includes("*") && anchor.anonymousGet !== false;
    return (
      <li>
        <span className="muted">route </span>
        {followable ? (
          <Link to={anchor.path}>
            <code>{anchor.path}</code>
          </Link>
        ) : (
          <code>{anchor.path}</code>
        )}
      </li>
    );
  }
  if (anchor.kind === "gate") {
    return (
      <li>
        <span className="muted">gate </span>
        <code>{anchor.gate}</code>
      </li>
    );
  }
  if (anchor.kind === "assertion") {
    return (
      <li>
        <span className="muted">assertion in </span>
        <code>{anchor.gate}</code>
        <span className="muted">: </span>
        <q>{anchor.text}</q>
      </li>
    );
  }
  return (
    <li>
      <span className="muted">decision </span>
      <code>{anchor.id}</code>
    </li>
  );
}
