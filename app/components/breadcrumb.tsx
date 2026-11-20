import { Breadcrumb as CapBreadcrumb } from "capsomer/react/breadcrumb";
import { crumbLink } from "~/components/admin/shell-parts";

/** Visible trail, `[name, path]` steps as the head's BreadcrumbList takes them, drawn by Capsomer. Hubs (one step) render nothing. */
export function Breadcrumb({ trail }: { trail: Array<[string, string]> }) {
  return (
    <CapBreadcrumb
      variant="direction"
      className="page-breadcrumb"
      items={trail.map(([label, href]) => ({ label, href }))}
      renderLink={crumbLink}
    />
  );
}
