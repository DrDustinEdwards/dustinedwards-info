import { Outlet, data, isRouteErrorResponse, useLocation, useRouteLoaderData } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";
import { Empty } from "capsomer/react/empty";
import { MessageProvider } from "capsomer/react/message";
import { AdminShell, type AdminEntry } from "capsomer/react/admin-shell";
import { ThemeSwitch } from "capsomer/react/theme-switch";

import { Icon, THEME_SCRIPT, shellLink } from "~/components/admin/shell-parts";
import { labIdentity } from "~/lab/access.server";
import { labActorContext, loadLabActor, primaryOwnerSet } from "~/lab/actor.server";
import { PERMISSION, titleLabel } from "~/lab/titles.mjs";
import { getEnv } from "~/lib/context";
import { ORIGIN_REFUSAL, originVerdict } from "~/lib/origin.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/workspace";
import type { loader as rootLoader } from "~/root";

/*
 * The lab workspace (docs/KNOWLEDGE-BASE.md step 5; capsid docs/design/design-identity-roles.md). Lab members sign in
 * through their own Cloudflare Access application, never /admin's, and their row in `members` decides what they may
 * do. /admin stays the Primary Owner's alone. Capsomer's shell and stylesheets, as the admin plane.
 */
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/800.css";
import "@fontsource/martian-mono/400.css";
import "~/admin.css";
import "~/lab.css";

export function meta() {
  return [{ title: "Lab" }, { name: "robots", content: "noindex" }];
}

export const handle = { hydrate: true };

const PRIVATE = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
};

/** The words a person with no access reads. It names nobody, and it is the same for a stranger and a removed member. */
export function noAccessText(email: string): string {
  return `No access. Ask your lab manager to add ${email}.`;
}

/**
 * Default deny: Access must vouch for a person with this application's own token, and that person must hold an
 * active, unexpired row (or be the Primary Owner). Anything else is refused before any child runs, and the row is read
 * on every request, so a removal takes effect on the next click.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const env = getEnv(context);
    if (request.method !== "GET" && request.method !== "HEAD") {
      const verdict = originVerdict(request.headers.get("origin"), request.url);
      if (!verdict.ok) throw new Response(ORIGIN_REFUSAL, { status: 403, headers: PRIVATE });
    }

    const identity = await labIdentity(env, request);
    if (identity.kind === "refused") {
      throw new Response(`Refused: the Cloudflare Access token did not verify (${identity.reason}).`, { status: 401, headers: PRIVATE });
    }
    if (identity.kind !== "human") {
      const configured = Boolean(env.ACCESS_LAB_AUD);
      throw new Response(
        configured
          ? `The lab signs in at ${SITE_ORIGIN}/lab, through Cloudflare Access.`
          : "The lab workspace is not set up yet: its Cloudflare Access application (ACCESS_LAB_AUD) is not configured.",
        { status: identity.kind === "service" ? 403 : configured ? 403 : 503, headers: PRIVATE },
      );
    }
    if (!primaryOwnerSet(env)) {
      throw new Response("The lab workspace is not set up yet: PRIMARY_OWNER_EMAIL is not set.", { status: 503, headers: PRIVATE });
    }

    const actor = await loadLabActor(env, identity.email, Date.now());
    if (!actor) throw new Response(noAccessText(identity.email), { status: 403, headers: PRIVATE });
    context.set(labActorContext, actor);
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  return data(
    {
      email: actor.email,
      title: titleLabel(actor.title),
      manages: can(actor, PERMISSION.manageMembers),
      reads: can(actor, PERMISSION.read),
      records: can(actor, PERMISSION.recordRun),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

const ICONS = {
  overview: <Icon d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  inventory: <Icon d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" />,
  runs: <Icon d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 14h9" />,
  members: <Icon d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 6v1" />,
};

const RouterLink = shellLink("/lab");

const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

export default function LabLayout({ loaderData }: Route.ComponentProps) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const { pathname } = useLocation();
  const at = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const nav: AdminEntry[] = [
    { id: "overview", label: "Overview", href: "/lab", icon: ICONS.overview, current: pathname === "/lab" || pathname === "/lab/" },
    ...(loaderData.reads
      ? [{ id: "inventory", label: "Inventory", href: "/lab/inventory", group: "Bench", icon: ICONS.inventory, current: at("/lab/inventory") }]
      : []),
    ...(loaderData.records
      ? [{ id: "runs", label: "Runs", href: "/lab/runs", group: "Bench", icon: ICONS.runs, current: at("/lab/runs") }]
      : []),
    ...(loaderData.manages
      ? [{ id: "members", label: "Members", href: "/lab/members", group: "People", icon: ICONS.members, current: at("/lab/members") }]
      : []),
  ];
  const theme = rootData?.theme;
  const initials = loaderData.email.slice(0, 2).toUpperCase();

  return (
    <>
      <script nonce={rootData?.nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <AdminShell
        title="Lab"
        apps={[{ id: "lab", label: "Lab", href: "/lab", mono: "L", current: true }]}
        nav={nav}
        tabs={nav}
        renderLink={RouterLink}
        account={{
          name: loaderData.email,
          initials,
          role: loaderData.title,
          email: loaderData.email,
          appLinks: [{ label: "View site", href: "/" }],
          onSignOut: () => window.location.assign(ACCESS_LOGOUT_PATH),
        }}
        status={<span className="cap-muted">Signed in as {loaderData.email}</span>}
        actions={<ThemeSwitch initial={theme === "light" || theme === "dark" ? theme : undefined} />}
        prefKey="lab-rail"
      >
        <MessageProvider>
          <div className="cap-admin-page">
            <Outlet />
          </div>
        </MessageProvider>
      </AdminShell>
    </>
  );
}

/** The lab's own error page, in Capsomer: a refusal's words are the answer, never a login page. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const known = isRouteErrorResponse(error);
  const title = known ? (error.status === 403 ? "No access" : `${error.status} ${error.statusText}`) : "Something went wrong";
  return (
    <main className="app-page">
      <Empty kind={known && error.status === 404 ? "no-match" : "failed"} title={title}>
        {known && typeof error.data === "string" ? error.data : "Nothing you entered is lost."}
      </Empty>
    </main>
  );
}
