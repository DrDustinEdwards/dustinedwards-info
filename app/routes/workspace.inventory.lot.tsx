import { ADMIN_FORM_BYTES, cappedForm } from "~/lib/body.server";
import { Form, Link, data } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";
import { Button } from "capsomer/react/button";
import { Field } from "capsomer/react/field";
import { Panel } from "capsomer/react/panel";

import { PageHead } from "capsomer/react/page-head";
import { crumbLink } from "~/components/admin/shell-parts";
import { LabTable, Result } from "~/components/lab/lab-ui";
import { labActorContext } from "~/lab/actor.server";
import { inventoryAction, lotPage } from "~/lab/inventory.server";
import { amountText, idOf } from "~/lab/forms.mjs";
import { PERMISSION } from "~/lab/titles.mjs";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/workspace.inventory.lot";

export function meta() {
  return [{ title: "Lot · Lab" }, { name: "robots", content: "noindex" }];
}

const PRIVATE = { "cache-control": "private, no-store" };

function notFound(): never {
  throw data("Not found.", { status: 404, headers: PRIVATE });
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  if (!can(actor, PERMISSION.read)) notFound();
  const id = idOf(params.id);
  const page = id ? await lotPage(getEnv(context), actor, id) : null;
  if (!page) notFound();
  return data(page, { headers: PRIVATE });
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const actor = context.get(labActorContext);
  if (!can(actor, PERMISSION.read)) notFound();
  const id = idOf(params.id);
  if (!id) notFound();
  const form = await cappedForm(request, ADMIN_FORM_BYTES);
  // The lot is the one in the address, whatever the form says.
  form.set("lot", String(id));
  return data(await inventoryAction(getEnv(context), actor, form, Date.now()), { headers: PRIVATE });
}

/** One audit row in words: what changed, field by field. */
function changeText(before: string | null, after: string | null): string {
  const b = before ? (JSON.parse(before) as Record<string, unknown>) : null;
  const a = after ? (JSON.parse(after) as Record<string, unknown>) : null;
  if (!b && a) return "Added";
  if (!a) return "Changed";
  const changed = Object.keys(a).filter((k) => k !== "id" && JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
  return changed.length ? changed.map((k) => `${k.replace("_", " ")}: ${b?.[k] ?? "none"} to ${a[k] ?? "none"}`).join("; ") : "No change";
}

export default function LabLot({ loaderData, actionData }: Route.ComponentProps) {
  const { lot, audit, runs, locations, allRuns, canEdit, canUse } = loaderData;
  return (
    <>
      <PageHead
        renderLink={crumbLink}
        crumbs={[{ label: "Inventory", href: "/lab/inventory" }, { label: `Lot ${lot.lot_number}` }]}
        title={`${lot.item}, lot ${lot.lot_number}`}
      />
      <Result result={actionData} />
      <dl className="lab-facts">
        <dt>Left</dt>
        <dd>{lot.amount === null ? "Not recorded" : amountText(lot.amount, lot.unit)}</dd>
        <dt>Status</dt>
        <dd>{lot.status.replace("_", " ")}</dd>
        <dt>Opened</dt>
        <dd>{lot.opened ?? "Not yet"}</dd>
        <dt>Expires</dt>
        <dd>{lot.expiry ?? "Not recorded"}</dd>
        <dt>Received</dt>
        <dd>{lot.received ?? "Not recorded"}</dd>
        <dt>Where</dt>
        <dd>{lot.location ?? "Not recorded"}</dd>
      </dl>
      {canUse && lot.status === "in_stock" ? (
        <Form method="post" className="lab-actions">
          {lot.opened ? null : (
            <Button type="submit" name="intent" value="mark_opened">
              Mark opened
            </Button>
          )}
          <Button type="submit" name="intent" value="mark_empty">
            Mark empty
          </Button>
        </Form>
      ) : null}

      <Panel title={allRuns ? "Runs that used this lot" : "Your runs that used this lot"}>
        {runs.length === 0 ? (
          <p className="cap-muted">No runs yet.</p>
        ) : (
          <LabTable label="Runs that used this lot" head={["Run", "Protocol", "Day", "Outcome", "By"]}>
            {runs.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <Link to={`/lab/runs/${r.id}`}>Run {r.id}</Link>
                  {r.replaced_by ? <span className="cap-muted">, corrected by run {r.replaced_by}</span> : null}
                </th>
                <td>{r.title}</td>
                <td>{r.run_on}</td>
                <td>{r.outcome}</td>
                <td>{r.actor}</td>
              </tr>
            ))}
          </LabTable>
        )}
      </Panel>

      {canEdit ? (
        <Panel title="Change this lot">
          <Form method="post" className="lab-form">
            <input type="hidden" name="intent" value="edit_lot" />
            <div className="lab-fields">
              <Field label="Amount left">
                <input className="cap-input" name="amount" inputMode="decimal" defaultValue={lot.amount ?? ""} />
              </Field>
              <Field label="Unit">
                <input className="cap-input" name="unit" defaultValue={lot.unit ?? ""} />
              </Field>
              <Field label="Expires">
                <input className="cap-input" type="date" name="expiry" defaultValue={lot.expiry ?? ""} />
              </Field>
              <Field label="Where">
                <select className="cap-input" name="location" defaultValue={lot.location_id ?? ""}>
                  <option value="">Not recorded</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className="cap-input" name="status" defaultValue={lot.status}>
                  <option value="in_stock">In stock</option>
                  <option value="empty">Empty</option>
                  <option value="discarded">Discarded</option>
                </select>
              </Field>
            </div>
            <div>
              <Button type="submit" variant="primary">
                Save lot
              </Button>
            </div>
          </Form>
        </Panel>
      ) : null}

      <Panel title="History">
        <LabTable label="History of this lot" head={["When", "Who", "What"]}>
          {audit.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.at * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
              <td>{row.actor}</td>
              <td>{changeText(row.before_row, row.after_row)}</td>
            </tr>
          ))}
        </LabTable>
      </Panel>
    </>
  );
}
