import { personJsonLd, SITE, webSiteJsonLd } from "~/lib/seo";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: `${SITE.name}, ${SITE.role}` },
    { name: "description", content: SITE.description },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  return { origin: new URL(request.url).origin };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { origin } = loaderData;
  const jsonLd = [personJsonLd(origin), webSiteJsonLd(origin)];

  return (
    <main className="hero">
      <div className="hero-inner">
        <p className="eyebrow">{SITE.affiliation}</p>
        <h1 className="hero-name">{SITE.name}</h1>
        <p className="hero-role">{SITE.role}</p>
      </div>
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          // schema.org data for search and language models
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </main>
  );
}
