import { Link, data } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";

import { PageHead } from "~/components/admin/page-head";
import { labActorContext } from "~/lab/actor.server";
import { PERMISSION, titleLabel } from "~/lab/titles.mjs";
import type { Route } from "./+types/workspace._index";

export function meta() {
  return [{ title: "Overview · Lab" }, { name: "robots", content: "noindex" }];
}

/** What this person may do here, from their permissions, never their title. */
export async function loader({ context }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  return data(
    { title: titleLabel(actor.title), manages: can(actor, PERMISSION.manageMembers) },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export default function LabOverview({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHead title="Lab" lead={`You are signed in as ${loaderData.title}.`} />
      {loaderData.manages ? (
        <p>
          <Link to="/lab/members">Members</Link>: who may sign in to the lab, their titles and when their access ends.
        </p>
      ) : null}
    </>
  );
}
