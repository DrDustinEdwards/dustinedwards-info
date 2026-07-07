import { Form, NavLink, Outlet, redirect } from "react-router";

import { adminSessionContext, getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * One gate for the whole /admin subtree. Runs before every child loader and
 * action; anyone without the single-admin session is 302'd to the login
 * screen. The verified session is stashed on the context so children read it
 * without a second lookup.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const session = await getAdminSession(getEnv(context), request);
    if (!session) throw redirect("/login");
    context.set(adminSessionContext, session);
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  return { email: context.get(adminSessionContext).user.email };
}

const NAV = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/sites", label: "Sites" },
  { to: "/admin/content", label: "Content" },
  { to: "/admin/tools", label: "Tools" },
];

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="admin">
      <aside className="admin-sidebar">
        <NavLink to="/admin" end className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            DE
          </span>
          <span>Cockpit</span>
        </NavLink>
        <nav className="admin-nav" aria-label="Admin sections">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <a className="admin-view-site" href="/">
          View site
        </a>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span className="admin-topbar-scope">Private plane</span>
          <div className="admin-topbar-user">
            <span className="muted">{loaderData.email}</span>
            <Form method="post" action="/admin/logout">
              <button type="submit" className="admin-signout">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign out
              </button>
            </Form>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
