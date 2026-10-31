import { ADMIN_FORM_BYTES, cappedForm } from "~/lib/body.server";
import { Link, data, redirect } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";
import { Panel } from "capsomer/react/panel";

import { PageHead } from "capsomer/react/page-head";
import { crumbLink } from "~/components/admin/shell-parts";
import { LabTable, Result } from "~/components/lab/lab-ui";
import { RunForm } from "~/components/lab/run-form";
import { labActorContext } from "~/lab/actor.server";
import { amountText, idOf } from "~/lab/forms.mjs";
import { recordRun, runPage } from "~/lab/runs.server";
import { PERMISSION } from "~/lab/titles.mjs";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/workspace.runs.run";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Run ${params.id} · Lab` }, { name: "robots", content: "noindex" }];
}

const PRIVATE = { "cache-control": "private, no-store" };

/** Someone else's run is a 404 to a person who reads only their own, the same answer as a run that does not exist. */
export async function loader({ context, params }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  if (!can(actor, PERMISSION.recordRun)) throw data("Not found.", { status: 404, headers: PRIVATE });
  const id = idOf(params.id);
  const page = id ? await runPage(getEnv(context), actor, id) : null;
  if (!page) throw data("Not found.", { status: 404, headers: PRIVATE });
  return data(page, { headers: PRIVATE });
}

/** A correction of this run: the run is the one in the address. Saved, it opens on its own page; refused, it stays here. */
export async function action({ context, request, params }: Route.ActionArgs) {
  const actor = context.get(labActorContext);
  const id = idOf(params.id);
  if (!id || !can(actor, PERMISSION.recordRun)) throw data("Not found.", { status: 404, headers: PRIVATE });
  const result = await recordRun(getEnv(context), actor, await cappedForm(request, ADMIN_FORM_BYTES), Date.now(), { replacesId: id });
  if (result.ok && result.runId) throw redirect(`/lab/runs/${result.runId}`, { headers: PRIVATE });
  return data(result, { headers: PRIVATE });
}

export default function LabRun({ loaderData, actionData }: Route.ComponentProps) {
  const { run, lots, procedures, allLots, canCorrect, lotRows } = loaderData;
  return (
    <>
      <PageHead renderLink={crumbLink} crumbs={[{ label: "Runs", href: "/lab/runs" }, { label: `Run ${run.id}` }]} title={`Run ${run.id}: ${run.title}`} />
      <Result result={actionData} />
      {run.replaced_by ? (
        <p>
          Corrected by <Link to={`/lab/runs/${run.replaced_by}`}>run {run.replaced_by}</Link>. This record stays as it was saved.
        </p>
      ) : null}
      <dl className="lab-facts">
        <dt>Protocol</dt>
        <dd>
          {run.title}
          {run.procedure_version ? `, version ${run.procedure_version}` : ""}
        </dd>
        <dt>Day</dt>
        <dd>{run.run_on}</dd>
        <dt>Outcome</dt>
        <dd>{run.outcome}</dd>
        <dt>By</dt>
        <dd>{run.actor}</dd>
        {run.replaces_run_id ? (
          <>
            <dt>Corrects</dt>
            <dd>
              <Link to={`/lab/runs/${run.replaces_run_id}`}>Run {run.replaces_run_id}</Link>
            </dd>
          </>
        ) : null}
        {run.note ? (
          <>
            <dt>Note</dt>
            <dd>{run.note}</dd>
          </>
        ) : null}
      </dl>
      <Panel title="Lots used">
        {lots.length === 0 ? (
          <p className="cap-muted">No lots recorded.</p>
        ) : (
          <LabTable label="Lots used" head={["Item", "Lot", "Used", ""]}>
            {lots.map((l) => (
              <tr key={l.lot_id}>
                <th scope="row">{l.item}</th>
                <td>
                  <Link to={`/lab/inventory/${l.lot_id}`} className="cap-mono">
                    {l.lot_number}
                  </Link>
                </td>
                <td>{l.amount_used === null ? "" : amountText(l.amount_used, l.unit)}</td>
                <td>{l.emptied ? "Emptied it" : ""}</td>
              </tr>
            ))}
          </LabTable>
        )}
      </Panel>
      {canCorrect ? (
        <Panel title="Record a correction">
          <RunForm
            procedures={procedures}
            lots={allLots}
            lotRows={lotRows}
            replaces={run.id}
            defaults={{ procedure: run.procedure_slug, run_on: run.run_on, outcome: run.outcome, note: run.note, lots }}
          />
        </Panel>
      ) : null}
    </>
  );
}
