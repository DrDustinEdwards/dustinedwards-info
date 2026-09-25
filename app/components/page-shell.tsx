import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";

/**
 * The plain page: header, a `main` holding one `page-inner` column, footer. `lead` and `trail`
 * sit in `main` outside the column, for a page's JSON-LD script.
 */
export function PageShell({
  lead,
  trail,
  children,
}: {
  lead?: React.ReactNode;
  trail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        {lead}
        <div className="page-inner">{children}</div>
        {trail}
      </main>
      <ShellFooter />
    </>
  );
}
