import { ADMIN_FORM_BYTES, cappedForm } from "~/lib/body.server";
import { Link, data, redirect } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";
import { Panel } from "capsomer/react/panel";

import { PageHead } from "capsomer/react/page-head";
import { LabTable, Result } from "~/components/lab/lab-ui";
import { RunForm } from "~/components/lab/run-form";
import { labActorContext } from "~/lab/actor.server";
import { recordRun, runsPage } from "~/lab/runs.server";
import { PERMISSION } from "~/lab/titles.mjs";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/workspace.runs";

export function meta() {
  return [{ title: "Runs · Lab" }, { name: "robots", content: "noindex" }];
}

const PRIVATE = { "cache-control": "private, no-store" };

function requireRecorder(actor: Parameters<typeof can>[0]) {
  if (!can(actor, PERMISSION.recordRun)) throw data("Not found.", { status: 404, headers: PRIVATE });
}

export async function loader({ context }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  requireRecorder(actor);
  return data(await runsPage(getEnv(context), actor), { headers: PRIVATE });
}

/** A recorded run opens on its own page; a refusal comes back here with its words. */
export async function action({ context, request }: Route.ActionArgs) {
  const actor = context.get(labActorContext);
  requireRecorder(actor);
  const result = await recordRun(getEnv(context), actor, await cappedForm(request, ADMIN_FORM_BYTES), Date.now());
  if (result.ok && result.runId) throw redirect(`/lab/runs/${result.runId}`, { headers: PRIVATE });
  return data(result, { headers: PRIVATE });
}

export default function LabRuns({ loaderData, actionData }: Route.ComponentProps) {
  const { runs, procedures, lots, all, lotRows } = loaderData;
  return (
    <>
      <PageHead
        title="Runs"
        lead={`${all ? "Every run recorded in the lab" : "The runs you recorded"}, with the lots each used. A saved run is never changed: a correction is a new run that names it.`}
      />
      <Result result={actionData} />
      {runs.length === 0 ? (
        <p className="cap-muted">No runs recorded yet.</p>
      ) : (
        <LabTable label="Runs" head={["Run", "Protocol", "Day", "Outcome", ...(all ? ["By"] : [])]}>
          {runs.map((r) => (
            <tr key={r.id}>
              <th scope="row">
                <Link to={`/lab/runs/${r.id}`}>Run {r.id}</Link>
                {r.replaced_by ? <span className="cap-muted">, corrected by run {r.replaced_by}</span> : null}
                {r.replaces_run_id ? <span className="cap-muted">, corrects run {r.replaces_run_id}</span> : null}
              </th>
              <td>{r.title}</td>
              <td>{r.run_on}</td>
              <td>{r.outcome}</td>
              {all ? <td>{r.actor}</td> : null}
            </tr>
          ))}
        </LabTable>
      )}
      <Panel title="Record a run">
        <RunForm procedures={procedures} lots={lots} lotRows={lotRows} />
      </Panel>
    </>
  );
}
