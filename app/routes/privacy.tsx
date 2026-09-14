import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { SITE, pageMeta, publicHtmlHeaders } from "~/lib/seo";

// This page renders into `.prose`, and prose.css is route-scoped since the
// per-route CSS split. A page that uses the class and does not import the sheet
// renders unstyled, which check:page-payload's coverage half is what catches.
import "~/styles/prose.css";

/**
 * What this site records, in plain English.
 *
 * ## EVERY SENTENCE IS DERIVABLE FROM THE CODE
 *
 * That is the rule this page is written under, and it is the reason it can be
 * short. There is no "we may collect" and no "from time to time": each claim
 * below names something a reader could go and check, and the cited files are
 * the ones that do it.
 *
 *   the analytics fields      workers/app.ts, recordTraffic
 *   the redaction             app/lib/analytics-path.mjs
 *   the Ask cache and its TTL app/lib/search/ask-guard.server.ts
 *   the CSP report sink       app/routes/api.csp-report.ts
 *   the webmention receiver   app/routes/webmention.ts
 *   what a mention stores     app/db/schema.ts, the `webmentions` table
 *   what it reads off a page  app/lib/webmention/verify.server.ts
 *   the theme cookie          app/lib/theme.ts
 *   the admin session         app/lib/auth.server.ts
 *
 * NO RETENTION PERIOD IS STATED THAT THE CODE DOES NOT OWN. The Ask cache has
 * one, because `expirationTtl` is a number in the source. Analytics Engine's
 * retention is Cloudflare's and is not set here, so this page says that rather
 * than inventing a figure, which is the difference between a privacy page and a
 * privacy performance.
 *
 * NO COMPLIANCE CLAIM. This is not a GDPR notice, it does not name a lawful
 * basis, and it does not promise a process for requests, because none of those
 * would be true statements about a personal site. Saying what is recorded is
 * something this page can actually stand behind.
 *
 * ## WHY IT IS A ROUTE AND NOT A POST
 *
 * A post is content that ages and carries a date. This is a statement about how
 * the site works right now, so it lives beside `/colophon`, takes the shared
 * cache headers like every other public page, and changes when the code does.
 *
 * It joins the footer on every page, which is WCAG 2.2 3.2.6 consistent help:
 * the same help mechanism in the same relative order on every page that has it.
 */
export function headers() {
  // The SHARED builder, never a hand-written pair. check:headers refuses the
  // latter by name: a hand-written pair is how the Vary line gets dropped, and
  // the shared string without Vary: Cookie serves one reader's theme to
  // another.
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `Privacy | ${SITE.name}`,
    description:
      "What this site records, what it does not, and where each of those facts lives in the code.",
    path: "/privacy",
  });
}

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          <header className="page-head">
            <h1>Privacy</h1>
            <p className="muted">
              What this site records, what it does not, and where each of those facts lives in
              the code. Every statement here describes something the source does; nothing is
              aspirational.
            </p>
          </header>

          <div className="prose">
            <h2 id="page-views">Page views</h2>
            <p>
              Every successful HTML page view writes one row to Cloudflare Analytics Engine. The
              row holds four things: the path you visited, the hostname of the site that linked
              you here if there was one, the country Cloudflare associates with the request, and
              whether the browser said it was mobile, desktop, or did not say.
            </p>
            <p>
              It does not hold an IP address, a user agent, a cookie, an identifier of any kind,
              or anything that would let two visits be recognised as the same person.
            </p>
            <p>
              Two paths carry an identifier in the URL rather than in a parameter: a draft
              preview link and a media key. Those are redacted to a fixed placeholder before the
              row is written, so the token itself is never stored. Admin pages are skipped
              entirely, and so is everything that is not an HTML page: images, feeds, the
              markdown copies of posts, and the API.
            </p>
            <p>
              How long Cloudflare keeps those rows is Cloudflare&rsquo;s retention policy, not a
              setting in this repository. This page does not quote a number it does not control.
            </p>

            <h2 id="ask">Asking a question</h2>
            <p>
              The search page has an optional Ask feature. Using it sends your question to a
              language model running on Cloudflare&rsquo;s network, together with passages from
              this site that matched it. The answer is generated from those passages.
            </p>
            <p>
              Answers are cached for seven days, keyed by a hash of the question, so that the
              same question asked twice does not bill a second generation. The cache holds the
              question&rsquo;s hash, the answer, and which passages it drew on. It does not hold
              who asked.
            </p>
            <p>
              The feature is opt-in per question: classic search never reaches it, and a page
              that is not searched never sends anything anywhere.
            </p>

            <h2 id="security-reports">Security reports</h2>
            <p>
              This site sends a Content Security Policy, and browsers report violations of it to
              an endpoint here. Those reports are written to the Worker&rsquo;s log stream
              verbatim. A report is generated by your browser and describes the page and the
              resource that was blocked; it is a debugging signal about the site, not about you.
            </p>

            <h2 id="webmentions">Mentions from other sites</h2>
            <p>
              Another site can tell this one that it has linked to a post here. When that
              happens, this site fetches the page that was named and stores four things: the
              address of that page, which post it linked to, an author name read from the page
              if it publishes one, and a short excerpt of the text around the link. It does not
              store the IP address of whoever sent it. Nothing appears anywhere on the site
              until it has been approved by hand, and until then it is visible only to the
              administrator.
            </p>

            <h2 id="cookies">Cookies</h2>
            <p>
              There is one cookie for ordinary readers. It is called{" "}
              <code>theme</code>, it holds either <code>light</code> or <code>dark</code>, and it
              lasts a year. You only have it if you have used the theme button; until then the
              site simply follows your device and stores nothing. It exists so the site renders in
              the colours you chose on the first byte rather than flickering into them. Nothing
              else is stored on your device.
            </p>
            <p>
              There is a second cookie, a sign-in session, and it exists only for the one
              administrator of this site. If you have not signed in, you do not have it.
            </p>

            <h2 id="processors">Who else is involved</h2>
            <p>
              <strong>Cloudflare</strong> runs everything: the Worker that serves these pages,
              the database, the file storage, the analytics, and the model that answers Ask
              questions. No page on this site loads anything from another company&rsquo;s server,
              which is why there are no third-party scripts to disclose.
            </p>
            <p>
              <strong>Google</strong> is the sign-in provider for the administrator account. It
              is reached only from the sign-in page, and only by the one person who can use it.
            </p>

            <h2 id="checking">Checking any of this</h2>
            <p>
              The repository is the authority for every claim above, and{" "}
              <a href="/colophon">the colophon</a> describes how the site is built. If this page
              and the code ever disagree, the code is right and this page is a bug.
            </p>
          </div>
        </div>
      </main>
      <ShellFooter />
    </>
  );
}
