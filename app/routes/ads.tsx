import { Link } from "react-router";
import { ButtonLink } from "capsomer/react/link";

import { PageShell } from "~/components/page-shell";
import { UtilityAd } from "~/components/utility-ad";
import { SITE } from "~/lib/seo";
import { ADS } from "~/utility-ads/registry";

import type { Route } from "./+types/ads";

/**
 * The gallery of the vintage ads that sit behind the utility pages (docs/UTILITY-ADS.md): one ad at a time, whole, with
 * previous, next and random. `/ads` is the first ad, `/ads/random` sends you to a random one, `/ads/<id>` is one. Plain links,
 * so it works with no script; the list under the controls names every ad.
 */
export function loader({ params }: Route.LoaderArgs) {
  const index = params.id ? ADS.findIndex((ad) => ad.id === params.id) : 0;
  if (index < 0) throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  return { index };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const ad = ADS[loaderData?.index ?? 0];
  return [
    { title: `${ad?.title ?? "Ads"} | Ad gallery | ${SITE.name}` },
    { name: "robots", content: "noindex" },
  ];
}

export default function AdGallery({ loaderData }: Route.ComponentProps) {
  const ad = ADS[loaderData.index]!;
  const previous = ADS[(loaderData.index + ADS.length - 1) % ADS.length]!;
  const next = ADS[(loaderData.index + 1) % ADS.length]!;
  return (
    <PageShell>
      <header className="page-head">
        <h1>{ad.title}</h1>
        <p className="muted">
          {ad.era}. {ad.credit}
        </p>
      </header>
      <nav className="ad-gallery-nav" aria-label="Ads">
        <ButtonLink to={`/ads/${previous.id}`} rel="prev">
          Previous
        </ButtonLink>
        <ButtonLink to="/ads/random" reloadDocument>
          Random
        </ButtonLink>
        <ButtonLink to={`/ads/${next.id}`} rel="next">
          Next
        </ButtonLink>
      </nav>
      <ul className="ad-gallery-list">
        {ADS.map((entry) => (
          <li key={entry.id}>
            {entry.id === ad.id ? (
              <strong aria-current="page">{entry.title}</strong>
            ) : (
              <Link to={`/ads/${entry.id}`}>{entry.title}</Link>
            )}
          </li>
        ))}
      </ul>
      <UtilityAd ad={ad} size="large" />
    </PageShell>
  );
}
