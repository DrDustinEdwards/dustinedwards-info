import { Link } from "react-router";

/** One way on: where it goes, its title on the sign, and the words a screen reader hears before the title. */
export type SignTarget = { href: string; title: string; label: string };

type Ways = SignTarget | SignTarget[] | null | undefined;

const list = (ways: Ways): SignTarget[] => (Array.isArray(ways) ? ways : ways ? [ways] : []);

/**
 * The ways on as dark sign panels (Capsomer's manual theme, `nav.cap-signs` of `a.cap-sign`): the ways back with a
 * left arrow, the ways on with a right arrow and the family color along their top. A sign shows only the title; its
 * kind ("Next part") is read, not shown, since the arrow says it. Nothing renders when there is no way on.
 */
export function Signs({ label, prev, next }: { label: string; prev?: Ways; next?: Ways }) {
  const back = list(prev);
  const on = list(next);
  if (back.length === 0 && on.length === 0) return null;
  const sign = (target: SignTarget, rel: "prev" | "next") => (
    <Link key={`${rel}:${target.href}`} className="cap-sign" rel={rel} to={target.href}>
      <span className="sr-only">{target.label}: </span>
      {target.title}
    </Link>
  );
  return (
    <nav className="cap-signs" aria-label={label}>
      {back.map((t) => sign(t, "prev"))}
      {on.map((t) => sign(t, "next"))}
    </nav>
  );
}
