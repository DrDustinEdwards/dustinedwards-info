import { LAB_BENCH_PATH } from "~/lab/path.mjs";
import { ADMIN_FORM_BYTES, cappedForm } from "~/lib/body.server";
import { Form, data } from "react-router";
import { MANAGE_MEMBERS, can } from "@dustinedwards/site-runtime/members";
import { Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Field } from "capsomer/react/field";
import { Panel } from "capsomer/react/panel";
import { PeopleRoles } from "capsomer/react/people-roles";

import { PageHead } from "capsomer/react/page-head";
import { labActorContext } from "~/lab/actor.server";
import { membersAction, membersPage } from "~/lab/members.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/workspace.members";

export function meta() {
  return [{ title: "Members · Lab" }, { name: "robots", content: "noindex" }];
}

const PRIVATE = { "cache-control": "private, no-store" };

/** A page a person cannot use is a 404, so a Lab worker learns nothing from its address. */
function requireManager(actor: Parameters<typeof can>[0]) {
  if (!can(actor, MANAGE_MEMBERS)) throw data("Not found.", { status: 404, headers: PRIVATE });
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const actor = context.get(labActorContext);
  requireManager(actor);
  const page = await membersPage(getEnv(context), actor, new URL(request.url), Date.now());
  return data(page, { headers: PRIVATE });
}

export async function action({ context, request }: Route.ActionArgs) {
  const actor = context.get(labActorContext);
  requireManager(actor);
  const result = await membersAction(getEnv(context), actor, await cappedForm(request, ADMIN_FORM_BYTES), Date.now());
  return data(result, { headers: PRIVATE });
}

export default function LabMembers({ loaderData, actionData }: Route.ComponentProps) {
  const { people, terms, canEditTerms, syncNotice } = loaderData;
  const confirm = actionData?.confirm;
  return (
    <>
      <PageHead
        title="Members"
        lead="Who may sign in to the lab. Adding a person here puts them on the lab's Cloudflare Access list; removing them takes them off."
      />
      {syncNotice ? (
        <Banner tone="warn" title="Cloudflare Access is not synced">
          {syncNotice}
        </Banner>
      ) : null}
      {confirm ? (
        <Panel title={`Remove ${confirm.name}?`}>
          <p>
            They are refused on their next request, taken off the lab&apos;s Cloudflare Access list and their seat is freed. Their
            row stays, marked removed, so their runs and edits keep their name.
          </p>
          <Form method="post" reloadDocument>
            <input type="hidden" name="intent" value="remove" />
            <input type="hidden" name="email" value={confirm.email} />
            <input type="hidden" name="confirmed" value="yes" />
            <Button type="submit" variant="danger">
              Remove {confirm.name}
            </Button>{" "}
            <a className="cap-btn" href={`${LAB_BENCH_PATH}/members`}>
              Cancel
            </a>
          </Form>
        </Panel>
      ) : null}
      <PeopleRoles data={{ ...people, ...(actionData?.result ? { result: actionData.result } : {}) }} action={`${LAB_BENCH_PATH}/members`} closeHref={`${LAB_BENCH_PATH}/members`} />
      {canEditTerms ? (
        <Panel title="Semester end dates">
          <Form method="post" reloadDocument>
            <input type="hidden" name="intent" value="set_terms" />
            <Field label="End dates" help="YYYY-MM-DD, separated by commas. A Lab worker's or Lab manager's access ends on the first of these after the day they are added or renewed.">
              <input className="cap-input" name="terms" defaultValue={terms.join(", ")} />
            </Field>
            <Button type="submit">Save dates</Button>
          </Form>
        </Panel>
      ) : null}
    </>
  );
}
