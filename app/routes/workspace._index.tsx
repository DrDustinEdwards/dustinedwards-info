import { LAB_BENCH_PATH } from "capsomer/behavior/family-footer";
import { Link, useRouteLoaderData } from "react-router";

import { PageHead } from "capsomer/react/page-head";
import type { loader as workspaceLoader } from "./workspace";

export function meta() {
  return [{ title: "Overview · Lab" }, { name: "robots", content: "noindex" }];
}

/** What this person may do here, from their permissions, never their title: the workspace layout's loader. */
export default function LabOverview() {
  const loaderData = useRouteLoaderData<typeof workspaceLoader>("routes/workspace");
  if (!loaderData) return null;
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
