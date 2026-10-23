import { Form, Link, data } from "react-router";
import { can } from "@dustinedwards/site-runtime/members";
import { Button } from "capsomer/react/button";
import { Field } from "capsomer/react/field";
import { Panel } from "capsomer/react/panel";

import { PageHead } from "capsomer/react/page-head";
import { LabTable, Result } from "~/components/lab/lab-ui";
import { labActorContext } from "~/lab/actor.server";
import { inventoryAction, inventoryPage } from "~/lab/inventory.server";
import { amountText } from "~/lab/forms.mjs";
import { PERMISSION } from "~/lab/titles.mjs";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/workspace.inventory";

export function meta() {
  return [{ title: "Inventory · Lab" }, { name: "robots", content: "noindex" }];
}

const PRIVATE = { "cache-control": "private, no-store" };

function requireReader(actor: Parameters<typeof can>[0]) {
  if (!can(actor, PERMISSION.read)) throw data("Not found.", { status: 404, headers: PRIVATE });
}

export async function loader({ context }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  requireReader(actor);
  return data(await inventoryPage(getEnv(context), actor), { headers: PRIVATE });
}

export async function action({ context, request }: Route.ActionArgs) {
  const actor = context.get(labActorContext);
  requireReader(actor);
  return data(await inventoryAction(getEnv(context), actor, await request.formData(), Date.now()), { headers: PRIVATE });
}

const STATUS_TEXT = { in_stock: "In stock", empty: "Empty", discarded: "Discarded" } as const;

export default function LabInventory({ loaderData, actionData }: Route.ComponentProps) {
  const { lots, locations, items, canEdit, canUse } = loaderData;
  return (
    <>
      <PageHead title="Inventory" lead="The lots on the shelf: which lot of each reagent, how much is left, and where it is. Every change is recorded." />
      <Result result={actionData} />
      {lots.length === 0 ? (
        <p className="cap-muted">No lots recorded yet.</p>
      ) : (
        <LabTable label="Lots" head={["Item", "Lot", "Left", "Expires", "Where", "Status", ""]}>
          {lots.map((lot) => (
            <tr key={lot.id}>
              <th scope="row">{lot.item}</th>
              <td>
                <Link to={`/lab/inventory/${lot.id}`} className="cap-mono">
                  {lot.lot_number}
                </Link>
              </td>
              <td>{lot.amount === null ? "" : amountText(lot.amount, lot.unit)}</td>
              <td>{lot.expiry ?? ""}</td>
              <td>{lot.location ?? ""}</td>
              <td>
                {STATUS_TEXT[lot.status]}
                {lot.opened ? <span className="cap-muted">, opened {lot.opened}</span> : null}
              </td>
              <td>
                {canUse && lot.status === "in_stock" ? (
                  <Form method="post" className="lab-actions">
                    <input type="hidden" name="lot" value={lot.id} />
                    {lot.opened ? null : (
                      <Button type="submit" size="sm" name="intent" value="mark_opened">
                        Mark opened<span className="cap-sr-only"> lot {lot.lot_number}</span>
                      </Button>
                    )}
                    <Button type="submit" size="sm" name="intent" value="mark_empty">
                      Mark empty<span className="cap-sr-only"> lot {lot.lot_number}</span>
                    </Button>
                  </Form>
                ) : null}
              </td>
            </tr>
          ))}
        </LabTable>
      )}
      {canEdit ? (
        <>
          <Panel title="Add a lot">
            <Form method="post" className="lab-form">
              <input type="hidden" name="intent" value="add_lot" />
              <div className="lab-fields">
                <Field label="Item" required>
                  <select className="cap-input" name="item" required defaultValue="">
                    <option value="" disabled>
                      Choose an item
                    </option>
                    {items.map((i) => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lot number" required>
                  <input className="cap-input" name="lot_number" required />
                </Field>
                <Field label="Amount">
                  <input className="cap-input" name="amount" inputMode="decimal" />
                </Field>
                <Field label="Unit" help="mL, g, tubes">
                  <input className="cap-input" name="unit" />
                </Field>
                <Field label="Expires">
                  <input className="cap-input" type="date" name="expiry" />
                </Field>
                <Field label="Received">
                  <input className="cap-input" type="date" name="received" />
                </Field>
                <Field label="Where">
                  <select className="cap-input" name="location" defaultValue="">
                    <option value="">Not recorded</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div>
                <Button type="submit" variant="primary">
                  Add lot
                </Button>
              </div>
            </Form>
          </Panel>
          <Panel title="Add a location">
            <Form method="post" className="lab-form">
              <input type="hidden" name="intent" value="add_location" />
              <div className="lab-fields">
                <Field label="Name" required help="Freezer 2, shelf B">
                  <input className="cap-input" name="name" required />
                </Field>
                <Field label="Inside">
                  <select className="cap-input" name="parent" defaultValue="">
                    <option value="">Nowhere else</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div>
                <Button type="submit">Add location</Button>
              </div>
            </Form>
          </Panel>
        </>
      ) : null}
    </>
  );
}
