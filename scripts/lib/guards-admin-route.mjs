/** ask-guards: the admin plane's smoke and session guards, read off the route source, and that operators cannot delete. */

import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { walkFiles } from "@dustinedwards/devkit/node";
import {
  PolicyError,
  decide,
  decideDelete,
  readState,
} from "../../app/lib/editor/publish-policy.mjs";
import { functionBody } from "./source-body.mjs";
import { stripComments } from "./strip-comments.mjs";
import { ADMIN, OPERATOR, eq, file, permits, refuses, root } from "./guards-shared.mjs";

export function checkAdminRoute() {
  /* The guard is extracted by walking back from the EXIT: a proximity needle passes on a print. */
  {
    const adminRoute = readFileSync(join(root, "app", "routes", "admin.tsx"), "utf8");
    const src = stripComments(adminRoute);

    const mentions = [];
    for (
      let at = src.indexOf("SMOKE_READ_ONLY_POLICY");
      at !== -1;
      at = src.indexOf("SMOKE_READ_ONLY_POLICY", at + 1)
    ) {
      const lineStart = src.lastIndexOf("\n", at) + 1;
      if (!/^\s*import\b/.test(src.slice(lineStart, at))) mentions.push(at);
    }
    eq(
      "the smoke refusal exists in admin.tsx, outside comments and imports",
      mentions.length > 0,
      true,
    );
    const exitAt = mentions[0] ?? -1;

    const ifAt = src.lastIndexOf("if (", exitAt);
    let guard = "";
    if (ifAt !== -1) {
      let depth = 0;
      for (let i = ifAt + 3; i < exitAt; i += 1) {
        if (src[i] === "(") depth += 1;
        else if (src[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            guard = src.slice(ifAt + 3, i + 1);
            break;
          }
        }
      }
    }

    eq("the guard expression was extracted", guard.length > 10, true);
    eq("and it is a condition, not a span of the file", guard.length < 200, true);

    eq(
      "the smoke refusal is conditioned on the request METHOD",
      /request\.method/.test(guard),
      true,
    );
    eq(
      "the method gate is an ALLOWLIST: it names GET and HEAD and refuses the rest",
      /!==\s*"GET"/.test(guard) && /!==\s*"HEAD"/.test(guard),
      true,
    );
    /* AND NOT A DENYLIST: equality on POST lets PUT, PATCH and DELETE through. */
    eq("the gate does not name the methods it refuses", !/request\.method\s*===/.test(guard), true);

    /* REFUSED BEFORE ANYTHING RUNS: a gate after next() is a 403 with the write already done. */
    const nextAt = src.indexOf("return next()");
    eq("the middleware calls next()", nextAt > 0, true);
    eq("the smoke method gate refuses BEFORE next() is reached", exitAt < nextAt, true);

    /** @type {string[]} */
    const constructors = [];
    for (const full of walkFiles(join(root, "app"), {
      keep: (name) => /\.(ts|tsx|mjs)$/.test(name),
    })) {
      if (/kind:\s*"smoke"/.test(stripComments(readFileSync(full, "utf8")))) {
        constructors.push(relative(root, full).split(sep).join("/"));
      }
    }

    eq(
      "the smoke-actor scan found the one construction site it expects",
      constructors.length > 0,
      true,
    );
    eq(
      "the smoke actor is declared in admin-actor.server and constructed in the middleware, nowhere else",
      constructors.sort().join(", "),
      "app/lib/admin-actor.server.ts, app/routes/admin.tsx",
    );
  }

  {
    const r = decide({
      actor: ADMIN,
      incomingRaw: file({ draft: false }),
      priorRaw: file({ draft: true }),
    });
    const stamped = readState(r.raw).firstPublished;
    eq(
      "admin first publish stamps a date",
      typeof stamped === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stamped),
      true,
    );
    eq("admin first publish reports published", r.published, true);
    eq("the stamped date is echoed back", r.firstPublished, stamped);
  }

  {
    const r = decide({
      actor: ADMIN,
      incomingRaw: file({ draft: false, firstPublished: "2020-01-01" }),
      priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    });
    eq("a submitted first_published never wins over the file", r.firstPublished, "2026-01-01");
    eq(
      "and the raw written out carries the file's value",
      readState(r.raw).firstPublished,
      "2026-01-01",
    );
  }

  {
    const r = decide({ actor: OPERATOR, incomingRaw: file({ draft: true }), priorRaw: null });
    eq("a new draft is stamped with nothing", r.firstPublished, null);
    eq("and reports itself unpublished", r.published, false);
  }

  {
    // Unpublishing must NOT clear the date, or the next republish would be read
    // as a first publication and an operator would be locked out of its own post.
    const r = decide({
      actor: OPERATOR,
      incomingRaw: file({ draft: true }),
      priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
    });
    eq("unpublishing preserves first_published", r.firstPublished, "2026-01-01");
    eq("and writes it back into the file", readState(r.raw).firstPublished, "2026-01-01");
  }

  {
    /** @param {Parameters<typeof decide>[0]} o */
    const outcome = (o) => decide(o).outcome;

    eq(
      "a new draft is an ordinary save",
      outcome({ actor: ADMIN, incomingRaw: file({ draft: true }), priorRaw: null }),
      "saved",
    );
    eq(
      "editing an existing draft is an ordinary save",
      outcome({
        actor: ADMIN,
        incomingRaw: file({ draft: true }),
        priorRaw: file({ draft: true }),
      }),
      "saved",
    );
    eq(
      "publishing a post that has never been public is a first publication",
      outcome({
        actor: ADMIN,
        incomingRaw: file({ draft: false }),
        priorRaw: file({ draft: true }),
      }),
      "published-first",
    );
    eq(
      "creating a post already published is also a first publication",
      outcome({ actor: ADMIN, incomingRaw: file({ draft: false }), priorRaw: null }),
      "published-first",
    );
    eq(
      "republishing a withdrawn post is a republication, not a first publication",
      outcome({
        actor: ADMIN,
        incomingRaw: file({ draft: false }),
        priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
      }),
      "republished",
    );
    eq(
      "editing a live post is an ordinary save, not a republication",
      outcome({
        actor: ADMIN,
        incomingRaw: file({ draft: false, firstPublished: "2026-01-01" }),
        priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
      }),
      "saved",
    );
    eq(
      "withdrawing a live post is an unpublish",
      outcome({
        actor: ADMIN,
        incomingRaw: file({ draft: true }),
        priorRaw: file({ draft: false, firstPublished: "2026-01-01" }),
      }),
      "unpublished",
    );
    eq(
      "re-saving a withdrawn post as a draft is not a second unpublish",
      outcome({
        actor: ADMIN,
        incomingRaw: file({ draft: true }),
        priorRaw: file({ draft: true, firstPublished: "2026-01-01" }),
      }),
      "saved",
    );
  }

  /* OPERATORS CANNOT DELETE: the destructive verb needs more authority than publishing, not less. */
  {
    refuses(
      "delete: an operator is refused",
      () => decideDelete({ actor: { kind: "operator", id: "mcp" } }),
      "delete-requires-admin",
    );
    permits("delete: the admin is permitted", () => decideDelete({ actor: { kind: "admin" } }));

    const operator = /** @type {const} */ ({ kind: "operator", id: "mcp" });
    let publishRefused = false;
    try {
      decide({ actor: operator, incomingRaw: file({ draft: false }), priorRaw: null });
    } catch (error) {
      publishRefused = error instanceof PolicyError;
    }
    let deleteRefused = false;
    try {
      decideDelete({ actor: operator });
    } catch (error) {
      deleteRefused = error instanceof PolicyError;
    }
    eq(
      "delete: an actor refused a first publish is refused a delete too",
      [publishRefused, deleteRefused],
      [true, true],
    );

    const publishSrc = readFileSync(join(root, "app/lib/editor/publish.server.ts"), "utf8");
    const at = publishSrc.indexOf("export async function deletePost(");
    eq("delete: deletePost exists to be checked", at !== -1, true);
    const body = functionBody(publishSrc, /export async function deletePost\(/);
    eq("delete: deletePost's body parses", body.length > 0, true);
    eq(
      "delete: deletePost calls decideDelete in its own body",
      /decideDelete\(\s*\{\s*actor\s*\}\s*\)/.test(body),
      true,
    );

    /* BEFORE THE FILE READ, or the difference between two errors tells a caller which slugs exist. */
    eq(
      "delete: the decision precedes the file read",
      body.indexOf("decideDelete") < body.indexOf("readFile("),
      true,
    );
  }
}
