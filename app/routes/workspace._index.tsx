import { LAB_BENCH_PATH } from "capsomer/behavior/family-footer";
import { Link, data } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";

import { PageHead } from "capsomer/react/page-head";
import { labActorContext } from "~/lab/actor.server";
import { PERMISSION } from "~/lab/titles.mjs";
import type { Route } from "./+types/workspace._index";
import { UNCACHED } from "@dustinedwards/site-runtime/edge-cache";

export function meta() {
  return [{ title: "Overview · Lab" }, { name: "robots", content: "noindex" }];
}

/** What this person may do here, from their permissions, never their title. */
export async function loader({ context }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  return data(
    {
      manages: can(actor, PERMISSION.manageMembers),
      reads: can(actor, PERMISSION.read),
      records: can(actor, PERMISSION.recordRun),
    },
    { headers: { "cache-control": UNCACHED } },
  );
}

export default function LabOverview({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHead title="Lab bench" />
      {loaderData.reads ? (
        <p>
          <Link to={`${LAB_BENCH_PATH}/inventory`}>Inventory</Link>
        </p>
      ) : null}
      {loaderData.records ? (
        <p>
          <Link to={`${LAB_BENCH_PATH}/runs`}>Runs</Link>
        </p>
      ) : null}
      {loaderData.manages ? (
        <p>
          <Link to={`${LAB_BENCH_PATH}/members`}>Members</Link>
        </p>
      ) : null}
    </>
  );
}
