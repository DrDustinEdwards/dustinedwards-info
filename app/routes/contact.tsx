import { PageShell } from "~/components/page-shell";
import { OWNER_FACULTY_PAGE, SITE, pageMeta, publicHtmlHeaders } from "~/lib/seo";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";

/** The address is the one the About page already publishes; this page adds nothing a reader could not find there. */
const EMAIL = "email@dustinedwards.info";

export function headers() {
  // The shared builder: a hand-written pair drops the Vary line and serves one reader's theme to another.
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `Contact | ${SITE.name}`,
    description: "How to reach Dustin Edwards: email, and his Tarleton State University faculty page.",
    path: "/contact",
  });
}

export default function Contact() {
  return (
    <PageShell>
      <header className="page-head">
        <h1>Contact</h1>
      </header>

      <div className="prose">
        <p>
          Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. It reaches me directly, for research, teaching,
          collaboration or anything on this site.
        </p>
        <p>
          My office, phone and department details are on my{" "}
          <a href={OWNER_FACULTY_PAGE}>Tarleton State University faculty page</a>.
        </p>
      </div>
    </PageShell>
  );
}
