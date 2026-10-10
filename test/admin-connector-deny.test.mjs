/**
 * Coding sessions must not reach an admin MCP (job_4f42a57102fa). Claude Code lists the claude.ai connectors
 * "Dustin Edwards Admin" and "Foxing Admin" in every session on this machine; an exact serverUrl deny in the
 * project settings drops them, and a deny matches by URL, not by the connector's display name. Removing an
 * entry silently restores the exposure, so this fails when one goes missing. The machine-level managed
 * settings carry the same two entries for every other repo; that file is not in this repository.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settings = JSON.parse(readFileSync(new URL("../.claude/settings.json", import.meta.url), "utf8"));
const denied = (settings.deniedMcpServers ?? []).map((entry) => entry.serverUrl);

for (const url of ["https://admin-mcp.dustinedwards.info/mcp", "https://admin-mcp.foxing.app/mcp"]) {
  test(`${url} is denied to coding sessions`, () => {
    assert.ok(denied.includes(url), `.claude/settings.json deniedMcpServers does not list ${url}`);
  });
}

test("the denies match by exact URL, never by display name", () => {
  for (const entry of settings.deniedMcpServers) {
    assert.deepEqual(Object.keys(entry), ["serverUrl"], JSON.stringify(entry));
  }
});
