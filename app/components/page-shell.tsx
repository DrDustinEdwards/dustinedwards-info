import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";

/**
 * The plain page: header, a `main` holding one `page-inner` column, footer. `lead` and `trail`
 * sit in `main` outside the column, for a page's JSON-LD script. `rail` is a side column (the page's
 * contents) on the left from 64rem, after the page below that, as the manual's pages carry their index.
 * `rail={null}` holds that column empty, so a reading page with too few parts for an index still starts
 * where the others do (Dustin, 2026-10-26: the software pages were inconsistent).
 */
export function PageShell({
  lead,
  trail,
  rail,
  children,
}: {
  lead?: React.ReactNode;
  trail?: React.ReactNode;
  rail?: React.ReactNode | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="cap-page page" id="main" tabIndex={-1}>
        {lead}
        {rail !== undefined ? (
          <div className="page-inner page-inner-railed">
            <div className="page-column">{children}</div>
            {rail ? <aside className="page-rail">{rail}</aside> : null}
          </div>
        ) : (
          <div className="page-inner">{children}</div>
        )}
        {trail}
      </main>
      <ShellFooter />
    </>
  );
}
