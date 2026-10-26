import { Fragment } from "react";

import { SITE } from "~/lib/seo";

/**
 * The home page's name and identity line. It states the whole organization, university and system, as
 * the CV does (`SITE.org`); structured data keeps the short form (`SITE.affiliation` in worksFor). Its own
 * component so test/home-intro.test.mjs renders exactly what the page does.
 *
 * The hero sets that line on two lines, the university and then its system, split at the first comma of
 * `SITE.org` so no name is typed twice. Only the hero does this: the About panel, structured data and the
 * page title keep their own forms. Both lines sit in one `p-org` element, so the h-card has one organization, and a visually hidden comma between them keeps its text equal to `SITE.org`.
 */
function orgLines(org: string): string[] {
  const at = org.indexOf(",");
  if (at < 0) return [org];
  return [org.slice(0, at).trim(), org.slice(at + 1).trim()].filter(Boolean);
}

/** Where the department is: Tarleton's main campus. */
const PLACE = "Stephenville, Texas";

/**
 * The cover of a technical report (the manual theme): the department and the place over a heavy rule, the
 * name large, the role, and the organization at the foot over a hairline.
 */
export function HomeIntro() {
  return (
    <section className="home-intro h-card" aria-labelledby="intro-h">
      <p className="cover-top">
        <span>{SITE.department}</span>
        <span>{PLACE}</span>
      </p>
      <h1 className="intro-name p-name cap-layout-grid" id="intro-h">
        {SITE.name}
      </h1>
      <p className="intro-affil">
        <b className="p-job-title">{SITE.role}</b>
      </p>
      <p className="cover-foot">
        <span className="p-org">
          {orgLines(SITE.org).map((line, i) => (
            <Fragment key={line}>
              {i > 0 ? <span className="sr-only">, </span> : null}
              <span className="org-line">{line}</span>
            </Fragment>
          ))}
        </span>
      </p>
      <a className="u-url" href="/" hidden>
        {SITE.name}
      </a>
    </section>
  );
}
