/** ask-guards: the operator publish policy, every rule with its paired negative, and the smoke capability row. */

import {
  decide,
  decideDelete,
  forceFirstPublished,
  readState,
  SMOKE_READ_ONLY_POLICY,
  WRITE_CAPABILITIES,
} from "../../app/lib/editor/publish-policy.mjs";
import { ADMIN, OPERATOR, SMOKE, eq, file, permits, refuses } from "./guards-shared.mjs";

export function checkPublishPolicy() {
  eq("readState reads an unpublished draft", readState(file({ draft: true })), {
    draft: true,
    firstPublished: null,
  });
  eq(
    "readState reads a previously published post",
    readState(file({ draft: false, firstPublished: "2026-01-01" })),
    { draft: false, firstPublished: "2026-01-01" },
  );
  // The negative: a post withdrawn after publication is draft:true but HAS a date.
  eq(
    "readState distinguishes a withdrawn post from a new draft",
    readState(file({ draft: true, firstPublished: "2026-01-01" })),
    { draft: true, firstPublished: "2026-01-01" },
  );

  eq(
    "forceFirstPublished adds the field when absent",
    readState(forceFirstPublished(file({ draft: false }), "2026-07-28")).firstPublished,
    "2026-07-28",
  );
  eq(
    "forceFirstPublished replaces a value already there",
    readState(
      forceFirstPublished(file({ draft: false, firstPublished: "2020-01-01" }), "2026-07-28"),
    ).firstPublished,
    "2026-07-28",
  );
  eq(
    "forceFirstPublished removes the field when told to",
    readState(forceFirstPublished(file({ draft: true, firstPublished: "2020-01-01" }), null))
      .firstPublished,
    null,
  );
  {
    const out = forceFirstPublished(file({ draft: false }), "2026-07-28");
    eq("forceFirstPublished keeps the body", out.trimEnd().endsWith("Body."), true);
    eq("forceFirstPublished keeps other keys", out.includes("slug: t"), true);
    eq("forceFirstPublished keeps the draft flag", readState(out).draft, false);
  }

  refuses(
    "operator cannot publish a post that has never been published",
    () =>
      decide({
        actor: OPERATOR,
        incomingRaw: file({ draft: false }),
        priorRaw: file({ draft: true }),
      }),
    "first-publish-requires-admin",
  );

  refuses(
    "operator cannot create a post already published in one shot",
    () => decide({ actor: OPERATOR, incomingRaw: file({ draft: false }), priorRaw: null }),
    "first-publish-requires-admin",
  );

  // THE FORGERY CASE: the payload claims first_published; only the prior file is consulted.
  refuses(
    "operator cannot forge first_published to bypass the gate",
    () =>
      decide({
        actor: OPERATOR,
        incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
        priorRaw: file({ draft: true }),
      }),
    "first-publish-requires-admin",
  );

  refuses(
    "operator cannot forge first_published on a brand new post",
    () =>
      decide({
        actor: OPERATOR,
        incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
        priorRaw: null,
      }),
    "first-publish-requires-admin",
  );

  permits("operator may create a draft", () =>
    decide({ actor: OPERATOR, incomingRaw: file({ draft: true }), priorRaw: null }),
  );
  permits("operator may edit an existing draft", () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: true }),
      priorRaw: file({ draft: true }),
    }),
  );
  permits("operator may edit a live post", () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: false, firstPublished: "2026-01-01" }),
      priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    }),
  );
  permits("operator may unpublish a live post", () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: true }),
      priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    }),
  );
  permits("operator may REpublish a post it withdrew", () =>
    decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: false }),
      priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
    }),
  );

  permits("admin may publish a post for the first time", () =>
    decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: file({ draft: true }) }),
  );
  permits("admin may create an already published post", () =>
    decide({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: null }),
  );

  const EVERY_TRANSITION = [
    ["create a draft", file({ draft: true }), null],
    ["edit an existing draft", file({ draft: true }), file({ draft: true })],
    [
      "edit a live post",
      file({ draft: false, firstPublished: "2026-01-01" }),
      file({ draft: false, firstPublished: "2026-01-01" }),
    ],
    [
      "unpublish a live post",
      file({ draft: true }),
      file({ draft: false, firstPublished: "2026-01-01" }),
    ],
    [
      "republish a withdrawn post",
      file({ draft: false }),
      file({ draft: true, firstPublished: "2026-01-01" }),
    ],
    ["publish for the first time", file({ draft: false }), file({ draft: true })],
    ["create an already published post", file({ draft: false }), null],
  ];

  for (const [what, incomingRaw, priorRaw] of EVERY_TRANSITION) {
    refuses(
      `smoke cannot ${what}`,
      () =>
        decide({
          actor: SMOKE,
          incomingRaw: String(incomingRaw),
          priorRaw: /** @type {string | null} */ (priorRaw),
        }),
      SMOKE_READ_ONLY_POLICY,
    );
  }

  refuses(
    "smoke cannot delete a post",
    () => decideDelete({ actor: SMOKE }),
    SMOKE_READ_ONLY_POLICY,
  );

  refuses(
    "smoke cannot forge first_published to buy itself a write",
    () =>
      decide({
        actor: SMOKE,
        incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
        priorRaw: file({ draft: true }),
      }),
    SMOKE_READ_ONLY_POLICY,
  );

  /* Iterated rather than named, so a FOURTH capability granted to smoke fails here. */
  {
    const smokeRow = Object.entries(WRITE_CAPABILITIES.smoke);
    eq("the smoke capability row is not empty", smokeRow.length >= 3, true);
    for (const [name, granted] of smokeRow) {
      eq(`smoke is denied the ${name} capability`, granted, false);
    }

    eq("admin may still write", WRITE_CAPABILITIES.admin.write, true);
    eq("admin may still publish for the first time", WRITE_CAPABILITIES.admin.firstPublish, true);
    eq("admin may still delete", WRITE_CAPABILITIES.admin.destroy, true);
    eq("operator may still write", WRITE_CAPABILITIES.operator.write, true);
    eq("carrel may write", WRITE_CAPABILITIES.carrel.write, true);
    eq("carrel may publish for the first time", WRITE_CAPABILITIES.carrel.firstPublish, true);
    eq(
      "carrel may delete (site-api v0.3.0 content.delete)",
      WRITE_CAPABILITIES.carrel.destroy,
      true,
    );

    eq(
      "the capability table names the four actor kinds",
      Object.keys(WRITE_CAPABILITIES).sort().join(","),
      "admin,carrel,operator,smoke",
    );
  }
}
