// The owner's identity, derived from the CV (docs/CV.md): the one-line role, the Person record's job title, the
// headship, the department and the university. content/cv/profile.md holds the person (name, degree, discipline,
// department, organization) and content/cv/appointments.md holds what he is appointed to, so a change to either
// changes every place the site states them: the site settings (app/lib/seo.ts), page titles, the About text, the
// CV's own header and the structured data. scripts/build-identity.mjs runs this over the files at build and
// writes app/lib/identity.generated.mjs, which those places import.
//
// Pure and dependency-free, so the build, the CV compile and the tests share one definition.

/** The CV's section of ranks and positions, and its section of headships and other leadership. */
export const POSITIONS_SECTION = "Positions";
export const ADMIN_SECTION = "Administrative and leadership";

/**
 * "a", "a and b", "a, b, and c".
 *
 * @param {string[]} items
 */
export function joinList(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * @typedef {{ name: string, degree: string, discipline: string, department: string, org: string }} IdentityPerson
 * @typedef {{ type?: string, section?: string, title?: string, endYear?: number | "present" | null, headline?: boolean }} IdentityEntry
 *
 * @typedef {{
 *   name: string,
 *   degree: string,
 *   discipline: string,
 *   disciplineLower: string,
 *   rank: string,
 *   role: string,
 *   adminTitles: string[],
 *   adminTitle: string,
 *   jobTitle: string,
 *   cvTitle: string,
 *   department: string,
 *   departmentSubject: string,
 *   org: string,
 *   affiliation: string,
 * }} Identity
 */

/**
 * What the CV states he is now: the one current position (its rank is the first half of the role), every current
 * administrative title (the headship), and the person's discipline (the second half). Returns every problem, so
 * a CV edit that would leave the site with no role is refused where it is made.
 *
 * `role` is "<rank> and <discipline>" ("Professor and Virologist"). `jobTitle` is the Person record's, which also
 * carries the headship ("Virologist, Professor, and Department Head"). `cvTitle` is the CV header's line.
 *
 * @param {IdentityPerson} person
 * @param {IdentityEntry[]} entries every CV entry; only the appointments are read
 * @returns {{ ok: false, errors: string[] } | { ok: true, identity: Identity }}
 */
export function deriveIdentity(person, entries) {
  /** @type {string[]} */
  const errors = [];
  const current = (/** @type {string} */ section, /** @type {boolean} */ headlineOnly) =>
    entries
      .filter(
        (e) =>
          e.type === "appointment" &&
          e.section === section &&
          e.endYear === "present" &&
          typeof e.title === "string" &&
          (!headlineOnly || e.headline === true),
      )
      .map((e) => /** @type {string} */ (e.title));
  const positions = current(POSITIONS_SECTION, false);
  // Only the leadership entries marked `headline: true` are stated beside the role; the rest stay on the CV alone.
  const adminTitles = current(ADMIN_SECTION, true);
  if (positions.length !== 1) {
    errors.push(
      `the CV states ${positions.length} current positions (section "${POSITIONS_SECTION}", endYear present); the site's one-line role is built from exactly one`,
    );
  }
  for (const key of /** @type {const} */ (["name", "degree", "discipline", "department", "org"])) {
    if (typeof person?.[key] !== "string" || person[key].trim() === "") errors.push(`the profile's person.${key} is missing`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const rank = /** @type {string} */ (positions[0]);
  const role = `${rank} and ${person.discipline}`;
  return {
    ok: true,
    identity: {
      name: person.name,
      degree: person.degree,
      discipline: person.discipline,
      disciplineLower: person.discipline.toLowerCase(),
      rank,
      role,
      adminTitles,
      adminTitle: joinList(adminTitles),
      jobTitle: joinList([person.discipline, rank, ...adminTitles]),
      cvTitle: [role, ...adminTitles].join(", "),
      department: person.department,
      departmentSubject: person.department.replace(/^Department of /, ""),
      org: person.org,
      // The university alone: the profile's organization carries its system after a comma.
      affiliation: (person.org.split(",")[0] ?? person.org).trim(),
    },
  };
}
