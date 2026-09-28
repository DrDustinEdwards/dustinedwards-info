import { Link } from "react-router";

/** Visible trail. The last step is the current page. Hubs (one step) render nothing. */
export function Breadcrumb({ trail }: { trail: Array<[string, string]> }) {
  if (trail.length < 2) return null;
  return (
    <nav className="page-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {trail.map(([name, path], i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${path}-${i}`}>
              {last ? <span aria-current="page">{name}</span> : <Link to={path}>{name}</Link>}
              {last ? null : <span aria-hidden="true"> / </span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
