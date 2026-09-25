/**
 * The storage target for a script that writes or deletes, named on the command line every time. A
 * default would pick production for a run that meant local, or local for a run that meant to repair
 * production, and neither shows until the damage is done.
 *
 * @param {string[]} argv the script's arguments
 * @param {string} script the npm script name, for the refusal
 * @returns {"--remote" | "--local"}
 */
export function requireTarget(argv, script) {
  const remote = argv.includes("--remote");
  const local = argv.includes("--local");
  if (remote && local) {
    throw new Error(`${script} was given both --remote and --local. Name one; nothing was touched.`);
  }
  if (!remote && !local) {
    throw new Error(
      `${script} needs an explicit target: npm run ${script} -- --remote writes and prunes ` +
        `production, npm run ${script} -- --local the local emulator. Nothing was touched.`,
    );
  }
  return remote ? "--remote" : "--local";
}
