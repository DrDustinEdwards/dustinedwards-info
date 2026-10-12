import { SITE } from "~/lib/seo";

/**
 * The home page's name and identity line. It states the whole organization, university and system, as
 * the CV does (`SITE.org`); structured data keeps the short form (`SITE.affiliation` in worksFor). Its own
 * component so test/home-intro.test.mjs renders exactly what the page does.
 */
export function HomeIntro() {
  return (
    <section className="home-intro h-card" aria-labelledby="intro-h">
      <h1 className="intro-name p-name" id="intro-h">
        {SITE.name}
      </h1>
      <p className="intro-affil">
        <span className="p-job-title">{SITE.role}</span>
        <span>{SITE.department}</span>
        <span className="p-org">{SITE.org}</span>
      </p>
      <a className="u-url" href="/" hidden>
        {SITE.name}
      </a>
    </section>
  );
}
