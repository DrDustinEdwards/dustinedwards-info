// The lab members migration (drizzle/0030_lab_members.sql, job_4409e06c39d4): its constraints hold on a real SQLite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const sql = readFileSync(new URL("../drizzle/0030_lab_members.sql", import.meta.url), "utf8");

function fresh() {
  const db = new DatabaseSync(":memory:");
  db.exec(sql);
  return db;
}

const member = "INSERT INTO members (email, title, status, added_by) VALUES (?, ?, ?, 'dustin@example.org')";

await test("the three tables start empty", () => {
  const db = fresh();
  for (const t of ["members", "member_audit", "member_terms"]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n, 0, t);
  }
});

await test("a member's email is stored lower-cased and trimmed, once, and their status is one of three", () => {
  const db = fresh();
  db.prepare(member).run("rosa@example.org", "lab_worker", "active");
  assert.throws(() => db.prepare(member).run("rosa@example.org", "lab_worker", "active"), /UNIQUE|PRIMARY/);
  assert.throws(() => db.prepare(member).run("Sam@example.org", "lab_worker", "active"), /CHECK/);
  assert.throws(() => db.prepare(member).run("not-an-email", "lab_worker", "active"), /CHECK/);
  assert.throws(() => db.prepare(member).run("lee@example.org", "lab_worker", "suspended"), /CHECK/);
  assert.equal(db.prepare("SELECT status FROM members").get().status, "active");
});

await test("the audit takes only the actions and sync states it names, and a term change has no member", () => {
  const db = fresh();
  const audit = "INSERT INTO member_audit (at, actor, actor_title, action, member_email, cloudflare) VALUES ('2026-10-11T00:00:00.000Z', 'a@b.c', 'owner', ?, ?, ?)";
  db.prepare(audit).run("add", "rosa@example.org", "pending");
  db.prepare(audit).run("set_terms", null, "not_needed");
  assert.throws(() => db.prepare(audit).run("promote", "rosa@example.org", "pending"), /CHECK/);
  assert.throws(() => db.prepare(audit).run("add", "rosa@example.org", "maybe"), /CHECK/);
});

await test("a term end is a YYYY-MM-DD date, once", () => {
  const db = fresh();
  const term = "INSERT INTO member_terms (end_date, added_by) VALUES (?, 'dustin@example.org')";
  db.prepare(term).run("2026-12-18");
  assert.throws(() => db.prepare(term).run("2026-12-18"), /UNIQUE|PRIMARY/);
  assert.throws(() => db.prepare(term).run("18 Dec 2026"), /CHECK/);
});
