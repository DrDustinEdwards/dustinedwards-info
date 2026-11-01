import { LAB_BENCH_PATH } from "~/lab/path.mjs";
import { Link, data } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";

import { PageHead } from "capsomer/react/page-head";
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
    {
      title: titleLabel(actor.title),
      manages: can(actor, PERMISSION.manageMembers),
      reads: can(actor, PERMISSION.read),
      records: can(actor, PERMISSION.recordRun),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export default function LabOverview({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHead title="Lab bench" lead={`You are signed in as ${loaderData.title}.`} />
      {loaderData.reads ? (
        <p>
          <Link to={`${LAB_BENCH_PATH}/inventory`}>Inventory</Link>: the lots on the shelf, how much is left and where.
        </p>
      ) : null}
      {loaderData.records ? (
        <p>
          <Link to={`${LAB_BENCH_PATH}/runs`}>Runs</Link>: record a run of a protocol with the lots it used.
        </p>
      ) : null}
      {loaderData.manages ? (
        <p>
          <Link to={`${LAB_BENCH_PATH}/members`}>Members</Link>: who may sign in to the lab, their titles and when their access ends.
        </p>
      ) : null}
    </>
  );
}
