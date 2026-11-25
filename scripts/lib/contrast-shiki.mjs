/** check:contrast's Shiki pass: every foreground in the highlighter's two themes clears the text floor on the surface it shows on. */

// Imported from the pipeline so the gate cannot check a theme the renderer does not use.
import { LANGUAGES, SHIKI_THEMES } from "@drdustinedwards/site-helpers/render/highlight";
import { contrast } from "../../app/lib/contrast.mjs";
import { TEXT } from "./contrast-matrix.mjs";
import { assert, assertPair, darkAttr, light } from "./contrast-model.mjs";

const { light: githubLight, dark: githubDark } = SHIKI_THEMES;

/** @param {any} theme */
function themeRules(theme) {
  /** @type {Array<{fg: string, bg: string | null, scope: string}>} */
  const out = [];
  /** @param {unknown} v @returns {string | null} */
  const hex = (v) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v) ? v.slice(0, 7) : null;

  const editorFg = hex(theme.fg);
  if (editorFg) out.push({ fg: editorFg, bg: null, scope: "(editor default)" });
  for (const rule of theme.settings ?? theme.tokenColors ?? []) {
    const fg = hex(rule?.settings?.foreground);
    if (!fg) continue;
    out.push({
      fg,
      bg: hex(rule?.settings?.background),
      scope: Array.isArray(rule.scope) ? rule.scope.join(", ") : String(rule.scope ?? "?"),
    });
  }
  return out;
}

/** VCS scopes are reported, not counted, only while `diff` is not in LANGUAGES. */
const VCS_SCOPE =
  /^(markup\.(deleted|inserted|changed|ignored|untracked)|carriage-return|meta\.diff)/;
const diffReachable = LANGUAGES.includes("diff");

/** @type {Array<[string, any, Record<string, string>]>} */
const shikiCases = [
  ["light", githubLight, light],
  ["dark", githubDark, darkAttr],
];

/** @returns {{ checked: number, unreachable: string[] }} */
export function checkShikiThemes() {
  let shikiTokensChecked = 0;
  /** @type {string[]} */
  const shikiUnreachable = [];

  for (const [mode, theme, block] of shikiCases) {
    const rules = themeRules(theme);
    assert(`${mode}: parsed a non-empty shiki theme`, rules.length > 10);

    for (const rule of rules) {
      if (rule.bg) {
        // Paired: measured against its own background, which is what ships.
        shikiTokensChecked += 1;
        const ratio = contrast(rule.fg, rule.bg);
        const detail =
          `${mode}: shiki ${rule.scope}\n    ${rule.fg} on its own bg ${rule.bg}` +
          `\n    ${ratio.toFixed(2)}:1, needs ${TEXT}:1`;
        const unreachable = !(ratio >= TEXT) && !diffReachable && VCS_SCOPE.test(rule.scope);
        if (unreachable) shikiUnreachable.push(detail);
        assert(detail, ratio >= TEXT || unreachable);
        continue;
      }
      for (const surfaceName of ["--page-paper", "--surface-popover"]) {
        const surface = block[surfaceName];
        shikiTokensChecked += 1;
        assertPair(`${mode}: shiki ${rule.scope}`, rule.fg, surface, TEXT, {
          bgShown: `${surfaceName} ${surface}`,
        });
      }
    }
  }
  return { checked: shikiTokensChecked, unreachable: shikiUnreachable };
}
