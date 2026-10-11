/**
 * The /lab workspace's titles and what each may do (capsid docs/design/design-identity-roles.md, "Layers and
 * permissions"; docs/KNOWLEDGE-BASE.md step 5). The rules every app shares are site-runtime's `./members`; this file
 * is only the lab's own list. Code asks `can(actor, PERMISSION)`, never which title a person holds, so a title can be
 * renamed or split without touching a check.
 *
 * The Primary Owner (layer 0, PRIMARY_OWNER_EMAIL) and an Owner (layer 1) hold every permission below; `defineTitles`
 * adds both and they cannot be redefined. Publishing stays in /admin, which is the Primary Owner's alone.
 */

import { defineTitles } from "@dustinedwards/site-runtime/members";

export const PERMISSION = Object.freeze({
  /** Inventory, lots and protocols, private fields included. */
  read: "read",
  /** Mark a lot opened, used or empty. */
  useLot: "use_lot",
  /** Record a run, and see your own. */
  recordRun: "record_run",
  readAllRuns: "read_all_runs",
  /** Items, lots and locations. */
  editInventory: "edit_inventory",
  /** A protocol draft; only the Primary Owner publishes. */
  draftProcedure: "draft_procedure",
  /** Add, renew, change and remove people below your own layer. */
  manageMembers: "manage_members",
});

const P = PERMISSION;

export const LAB_CATALOG = defineTitles({
  permissions: Object.values(P),
  titles: [
    {
      id: "lab_manager",
      label: "Lab manager",
      layer: 2,
      expires: true,
      permissions: [P.read, P.useLot, P.recordRun, P.readAllRuns, P.editInventory, P.draftProcedure, P.manageMembers],
    },
    { id: "lab_worker", label: "Lab worker", layer: 3, expires: true, permissions: [P.read, P.useLot, P.recordRun] },
  ],
});

/** The words a person reads for a title id; an unknown id is shown as itself. @param {string} id */
export function titleLabel(id) {
  return LAB_CATALOG.titles.get(id)?.label ?? id;
}

/**
 * Who may edit the semester end dates: the Primary Owner and Owners (layers 0 and 1), as the ruling says. A layer
 * question and not a permission one, because no title below an Owner may ever hold it.
 * @param {{ layer: number } | null} actor
 */
export function canEditTerms(actor) {
  return !!actor && actor.layer <= 1;
}
