/** Judges a procedure's method: its steps, flags, calculators, commands and photos. */

import { isGap } from "./gap.mjs";
import { allSteps, PLATFORMS, readCalcs, stepConditions } from "./parse.mjs";
import { TOOLS } from "../../lib/phage-tools.mjs";
import { PROTOCOL_QUANTITY, PROTOCOL_UNITS, TIME_UNITS } from "./validate-values.mjs";

/** The sentences a how-to's WHY may run to before its reasoning belongs on an explanation page it links (S1). */
const HOWTO_WHY_SENTENCES = 3;

/** The sentences in some markdown: each run of words ended by ., ! or ? before a capital or the end, so "e.g. this" is one. @param {string} text */
export function sentenceCount(text) {
  return (
    text
      .replace(/`[^`]*`/g, "x")
      .match(/[^.!?]*[A-Za-z0-9][^.!?]*[.!?]+(?=[*_]*(?:\s+[*_]*[A-Z0-9]|\s*$))/g) ?? []
  ).length;
}

/**
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 * @param {string} profile
 * @param {string[]} errors
 * @param {Array<{ field: string, reason: string, where?: string[], section?: string }>} gaps
 * @param {Map<string, any>} materials
 * @param {Set<string>} equipmentNames
 * @param {Set<string>} troubleIds
 */
export function stepRules(parsed, profile, errors, gaps, materials, equipmentNames, troubleIds) {
  const d = parsed.data;
  const steps = allSteps(parsed);
  if (steps.length === 0)
    errors.push("the procedure has no steps: a method section holds a numbered list");
  let previous = 0;
  for (const section of parsed.sections) {
    for (const block of section.blocks) {
      if (block.type !== "steps") continue;
      const first = block.steps[0];
      if (first && first.number !== 1 && first.number !== previous + 1) {
        errors.push(
          `line ${first.line}: step ${first.number} neither restarts at 1 nor follows step ${previous}`,
        );
      }
      block.steps.forEach((step, i) => {
        if (i > 0 && step.number !== (block.steps[i - 1]?.number ?? 0) + 1) {
          errors.push(
            `line ${step.line}: step ${step.number} follows step ${block.steps[i - 1]?.number}`,
          );
        }
      });
      previous = block.steps[block.steps.length - 1]?.number ?? previous;
    }
  }

  // A step's section, so a gap in it can say where it is (app/kb/gap-labels.mjs).
  const stepSection = new Map(
    parsed.sections.flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.type === "steps" ? block.steps.map((s) => [s, section.title]) : [],
      ),
    ),
  );
  for (const step of steps) {
    const at = `line ${step.line}, step ${step.number}`;
    if (!step.source.trim()) errors.push(`${at} has no words`);
    for (const reason of step.flags.critical)
      if (!reason) errors.push(`${at}: CRITICAL needs its reason`);
    for (const kind of /** @type {const} */ (["pause", "why", "expect", "challenge", "solution"])) {
      for (const text of step.flags[kind])
        if (!text) errors.push(`${at}: an empty ${kind.toUpperCase()} flag`);
    }
    for (const id of step.flags.troubleshooting) {
      if (!troubleIds.has(id))
        errors.push(
          `${at}: TROUBLESHOOTING names "${id}", which is not a row id in troubleshooting`,
        );
    }
    if (step.flags.calc.length > 0 && profile !== "protocol")
      errors.push(`${at}: CALC belongs to the protocol profile`);
    const calcs = readCalcs(step.flags.calc);
    if (new Set(calcs.map((c) => c.id)).size !== calcs.length)
      errors.push(`${at}: CALC names a calculator twice`);
    for (const { id, values } of calcs) {
      const tool = Object.hasOwn(TOOLS, id) ? TOOLS[id] : undefined;
      if (!tool) {
        errors.push(
          id
            ? `${at}: CALC names "${id}", which is not a calculator (${Object.keys(TOOLS).join(", ")})`
            : `${at}: CALC gives a value before it names a calculator`,
        );
        continue;
      }
      for (const [name, value] of Object.entries(values)) {
        if (!tool.fields.some((f) => f.name === name))
          errors.push(
            `${at}: CALC ${id} has no field "${name}" (${tool.fields.map((f) => f.name).join(", ")})`,
          );
        // Every value is the step's own: a number that is not in the step's words is not from the record.
        else if (!step.source.includes(value))
          errors.push(
            `${at}: CALC ${id} ${name}=${value}, but the step does not state ${value}; a value is filled in only from the step's own words`,
          );
      }
    }
    for (const seg of step.segments) {
      if (seg.type === "material") {
        const declared = materials.get(seg.name.toLowerCase());
        if (!declared && profile !== "recipe") {
          errors.push(
            `${at}: @${seg.name} is not in materials; declare it there with its stock and amount`,
          );
        }
        if (
          seg.quantity &&
          profile === "protocol" &&
          !PROTOCOL_QUANTITY.test(`${seg.quantity.amount} ${seg.quantity.unit}`.trim())
        ) {
          errors.push(
            `${at}: @${seg.name}'s amount "${seg.quantity.raw}" is not a number and a unit from the closed list (${PROTOCOL_UNITS.join(", ")})`,
          );
        }
      }
      if (
        seg.type === "equipment" &&
        profile !== "recipe" &&
        !equipmentNames.has(seg.name.toLowerCase())
      ) {
        errors.push(`${at}: #${seg.name} is not in equipment`);
      }
      if (seg.type === "timer") {
        if (!seg.quantity || seg.quantity.min === null || !TIME_UNITS.includes(seg.quantity.unit)) {
          errors.push(
            `${at}: the timer ~{${seg.quantity?.raw ?? ""}} needs a number and a unit of time (${TIME_UNITS.join(", ")})`,
          );
        }
      }
    }
    if (profile === "protocol") {
      const { spins } = stepConditions(step);
      const words = step.segments.map((s) => (s.type === "text" ? s.value : "")).join("");
      const spinsHere = /\bspin\b|\bspun\b|\bcentrifuge\b/i.test(
        words.replace(/pulse[- ]spin/gi, ""),
      );
      const hasG = spins.some((s) => s.unit === "x g");
      if (spinsHere && !hasG && step.flags.spin.length === 0) {
        errors.push(
          `${at} spins with no g-force: add "> SPIN: <n> x g", or "> SPIN: MISSING: <why>" (a speed in rpm needs the rotor)`,
        );
      }
      for (const spin of step.flags.spin) {
        if (isGap(spin))
          gaps.push({
            field: `step ${step.number} (line ${step.line}).spin`,
            reason: spin.replace(/^MISSING:\s*/, ""),
            section: stepSection.get(step) ?? "",
          });
        else if (!/x g\b/.test(spin)) errors.push(`${at}: SPIN "${spin}" is not in x g`);
      }
    } else if (step.flags.spin.length > 0) {
      errors.push(`${at}: SPIN belongs to the protocol profile`);
    }
    // A tutorial teaches with challenges; a how-to links its reasoning out (S1, S5).
    if (
      step.flags.challenge.length > 0 &&
      !(profile === "computational" && d.type === "tutorial")
    ) {
      errors.push(
        `${at}: CHALLENGE belongs to a tutorial (a computational procedure with type: tutorial)`,
      );
    }
    if (step.flags.solution.length < step.flags.challenge.length)
      errors.push(`${at}: each CHALLENGE needs its SOLUTION after it`);
    if (profile === "computational" && d.type === "how-to") {
      for (const why of step.flags.why) {
        const n = sentenceCount(why);
        if (n > HOWTO_WHY_SENTENCES) {
          errors.push(
            `${at}: WHY runs to ${n} sentences; a how-to keeps a reason to ${HOWTO_WHY_SENTENCES} at most, so put the rest on a page and link it under explanation`,
          );
        }
      }
    }
    /** @type {Set<string>} */
    const platforms = new Set();
    for (const cmd of step.commands) {
      if (cmd.platform === null) continue;
      if (profile !== "computational")
        errors.push(`${at}: platform= belongs to the computational profile`);
      else if (!Object.hasOwn(PLATFORMS, cmd.platform))
        errors.push(
          `${at}: platform=${cmd.platform} is not a platform (${Object.keys(PLATFORMS).join(", ")})`,
        );
      else if (platforms.has(cmd.platform))
        errors.push(
          `${at}: two blocks for platform=${cmd.platform}; a step gives each platform one block`,
        );
      platforms.add(cmd.platform);
    }
    if (platforms.size === 1)
      errors.push(
        `${at}: a block names one platform alone; give each platform its block, or name none`,
      );
    if (profile === "computational") {
      for (const cmd of step.commands) {
        if (cmd.output === null && step.flags.expect.length === 0) {
          errors.push(
            `${at}: a command needs its expected output: a \`\`\`output block after it, or an EXPECT flag`,
          );
        }
      }
    } else if (step.commands.length > 0 && profile === "recipe") {
      errors.push(`${at}: a recipe step carries no commands`);
    }
    if (step.photos.length > 0 && profile !== "recipe")
      errors.push(`${at}: step photos belong to the recipe profile`);
    for (const photo of step.photos)
      if (!photo.alt.trim()) errors.push(`${at}: a step photo needs its alt text`);
  }
}
