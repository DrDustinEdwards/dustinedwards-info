#!/usr/bin/env bash
#
# Proves check:wrapper actually fails. A gate never observed failing has not been
# verified.
#
# WHY THIS SNAPSHOTS INSTEAD OF USING GIT. The first version of this harness
# reverted with `git checkout -- .`, which does not touch UNTRACKED files. Every
# plant that edited a then-untracked module survived into the next plant, so the
# results after the first were contaminated: the gate failed, but not necessarily
# for the reason under test. It also destroyed uncommitted work, which is the
# hazard dustinedwards/workflow-mainline.md records as one of this project's
# recurring failures.
#
# So: snapshot the exact files each plant edits, restore from the snapshot, and
# assert the baseline is green again between every plant. Independent by
# construction, and it cannot eat anything.
#
# Exit codes are read DIRECTLY, never through a pipe. `tail` masks them and has
# already reported success on a failing run elsewhere in this portfolio.

set -u
cd "$(dirname "$0")/.." || exit 2

SNAP="$(mktemp -d)"
trap 'rm -rf "$SNAP"' EXIT

FILES="src/tools.ts src/api-client.ts src/mcp-handler.ts src/index.ts src/auth.ts wrangler.jsonc wrangler.jsonc.example"

snapshot() {
  for f in $FILES; do
    mkdir -p "$SNAP/$(dirname "$f")"
    cp "$f" "$SNAP/$f"
  done
}

restore() {
  for f in $FILES; do cp "$SNAP/$f" "$f"; done
}

gate() {
  node scripts/check-wrapper.mjs >/dev/null 2>&1
  echo $?
}

pass=0
missed=0
contaminated=0

expect_fail() {
  label="$1"
  code=$(gate)
  if [ "$code" = "1" ]; then
    echo "  CAUGHT (exit 1)   $label"
    pass=$((pass + 1))
  else
    echo "  MISSED (exit $code)   $label   <-- the gate does NOT catch this"
    missed=$((missed + 1))
  fi
  restore
  # The baseline must be green again, or the next result means nothing.
  back=$(gate)
  if [ "$back" != "0" ]; then
    echo "         !! baseline did not return to green (exit $back): results after this are contaminated"
    contaminated=$((contaminated + 1))
  fi
}

snapshot

base=$(gate)
if [ "$base" != "0" ]; then
  echo "BASELINE NOT GREEN (exit $base). Fix the tree before trusting anything below."
  exit 2
fi
echo "baseline: exit 0 (green)"
echo

# 1. A forbidden binding. A D1 database would be a second route to app data.
python3 -c "
p='wrangler.jsonc'; s=open(p,encoding='utf-8').read()
s=s.replace('\"kv_namespaces\": [', '\"d1_databases\": [{\"binding\":\"DB\",\"database_name\":\"x\",\"database_id\":\"x\"}],\n\t\"kv_namespaces\": [',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "1. d1_databases binding added"

# 2. Tool surface drift. A renamed tool no longer mirrors the API.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('    name: \"dei_check_publications\",','    name: \"check_publications\",',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "2. tool renamed away from the ten dei_ tools"

# 3. The API-leg credential read from a second module.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('async function run(','function leak(e){ return e.OPERATOR_TOKEN; }\n\nasync function run(',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "3. OPERATOR_TOKEN read outside api-client.ts"

# 4. A policy DECISION. Branching on publish state duplicates the API's rule.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('  try {','  if (args.firstPublished === null) { throw new Error(\"no\"); }\n  try {',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "4. code branches on firstPublished"

# 5. Hardcoded API path. Would survive a config change and hit the wrong env.
python3 -c "
p='src/api-client.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('callApi(env, LEG, \"/api/operator\"','callApi(env, LEG, \"https://dustinedwards.info/api/operator\"',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "5. operator API path hardcoded in source"

# 6. A shim with no stated removal condition becomes permanent by default.
python3 -c "
p='src/mcp-handler.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('REMOVAL CONDITION','(note removed)',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "6. removal condition deleted from the shim"

# 7. Primary handler in compatibility mode. Deleting the shim would then NOT
#    leave a modern-only server, which is the shim's whole justification.
python3 -c "
p='src/mcp-handler.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('  return routeMcpEra(request, env, ctx, {','  if (env) return createMcpHandler(buildServer(env, caller), { route: MCP_ROUTE, legacy: \"stateless\" })(request, env, ctx);\n  return routeMcpEra(request, env, ctx, {',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "7. a handler built around the era router, in legacy: stateless"

# 8. A non-allowlisted outbound host.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('async function run(','const u = \"https://evil.example.com/exfil\";\n\nasync function run(',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "8. non-allowlisted outbound host"

# 9. Re-implementing one of the app's gates.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('async function run(','const g = publiclyVisible;\n\nasync function run(',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "9. app gate re-implemented (publiclyVisible)"

# 10. The shim gaining a second call site stops it being a seam.
python3 -c "
p='src/mcp-handler.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('  return routeMcpEra(request, env, ctx, {','  if (!env) await routeMcpEra(request, env, ctx, { factory: buildServer(env, caller), options: {}, createMcpHandler, isLegacyRequest });\n  return routeMcpEra(request, env, ctx, {',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "10. second call site for the era router"

# 11. Removing the policy statement from the tool descriptions. This is the
#     asymmetric one: describing the policy is REQUIRED, enforcing it is banned.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('first-publish-requires-admin','(policy name removed)')
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "11. first-publish policy dropped from tool descriptions"

# 12. The example drifting from the real config. The example is what a fresh
#     clone checks, so drift there silently weakens the whole gate.
python3 -c "
p='wrangler.jsonc.example'; s=open(p,encoding='utf-8').read()
s=s.replace('\"OAUTH_KV\"','\"DRIFTED_KV\"',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "12. wrangler.jsonc.example drifted from the real config"

# 13. Pointing the deploy at the conformance harness, which mounts the handler
#     with the client leg and the rate limiter removed.
python3 -c "
p='wrangler.jsonc'; s=open(p,encoding='utf-8').read()
s=s.replace('\"main\": \"src/index.ts\"','\"main\": \"test/conformance-entry.ts\"',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "13. main points at the conformance test entry"

# 14. The door built locally beside the shared one: a provider of its own in index.ts.
python3 -c "
p='src/index.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('export default adminMcpWorker<Env>({','const local = new OAuthProvider({});\n\nexport default adminMcpWorker<Env>({',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "14. a local OAuthProvider beside site-runtime's door"

# 15. Agent keys switched off: Grok (measured 2026-09-07) cannot complete OAuth, so its key is its only door.
python3 -c "
p='src/index.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('agentKeys: true,','agentKeys: false,',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "15. agent keys switched off"

# 16. A second service binding: a second door into another Worker.
python3 -c "
p='wrangler.jsonc'; s=open(p,encoding='utf-8').read()
s=s.replace('{ \"binding\": \"SITE\", \"service\": \"dustinedwards\" }','{ \"binding\": \"SITE\", \"service\": \"dustinedwards\" }, { \"binding\": \"CAPSID\", \"service\": \"capsid\" }',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "16. second service binding added"

# 17. A tool registered around invokeTool skips ownership, scope and the log.
python3 -c "
p='src/mcp-handler.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('    return server;','    server.registerTool(\'dei_raw\', {}, (args: Record<string, unknown>) => TOOLS[0]!.handler(env, args));\n    return server;',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "17. tool registered around invokeTool"

# 18. The shared door handed scopes other than this server's (rule 12.1, 12.3).
python3 -c "
p='src/mcp-handler.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('const SERVER: McpServerInfo = { site: \"dustinedwards.info\", scopes: SCOPES,','const SERVER: McpServerInfo = { site: \"dustinedwards.info\", scopes: { read: \"\", write: \"\" },',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "18. invokeTool given scopes other than this server's"

# 19. A local registration check beside the shared one (rule 13 lives in site-runtime's door).
python3 -c "
p='src/index.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('  routes: async (request, env) => {','  routes: async (request, env) => {\n    if (registrationRefusal(\"\", {})) return null;',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "19. a local registration check"

# 20. The default export is not the shared door (rule 12.2's audience binding and every other guard live there).
python3 -c "
p='src/index.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('export default adminMcpWorker<Env>({','export const door = adminMcpWorker<Env>({',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "20. default export is not adminMcpWorker"

# 21. A post tool called again (rule 11, Carrel owns writing).
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('handler: (env) => run(env, \"check_publications\", {}),','handler: (env) => run(env, \"save_post\", {}),',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "21. a post tool called"

# 22. A second app module imported.
python3 -c "
p='src/tools.ts'; s=open(p,encoding='utf-8').read()
s=s.replace('import { z } from \"zod\";','import { z } from \"zod\";\nimport { SITE_ORIGIN } from \"../../app/lib/seo.ts\";',1)
open(p,'w',encoding='utf-8',newline='').write(s)"
expect_fail "22. a second app module imported"

echo
echo "planted 22: $pass caught, $missed missed, $contaminated contaminated"
final=$(gate)
echo "final baseline: exit $final"
if [ "$missed" != "0" ] || [ "$contaminated" != "0" ] || [ "$final" != "0" ]; then
  exit 1
fi
echo "check:wrapper is verified: every planted violation produced a real exit 1."
