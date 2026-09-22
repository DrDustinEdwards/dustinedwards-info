/**
 * The one serializer for JSON that goes inside a `<script>` element.
 *
 * ## THE DEFECT THIS CLOSES
 *
 * Every JSON-LD block on the site was `JSON.stringify(...)` handed straight to
 * `dangerouslySetInnerHTML`. The contents of a `<script>` element are RAW TEXT:
 * the parser does not decode entities inside it, and the only thing that ends
 * it is the literal sequence `</script`. So a post title containing that
 * sequence closes the element early, and everything after it is parsed as
 * markup in a document whose CSP would then be the only thing standing between
 * that markup and execution.
 *
 * Post titles come from frontmatter, which is written by the one admin and by
 * the operator API, so this is hardening rather than a live hole. It is worth
 * the few lines anyway: the alternative is that the safety of every schema.org
 * block depends on nobody ever writing an angle bracket in a title.
 *
 * ## WHAT IS ESCAPED, AND WHY EACH ONE
 *
 * `<` and `>` are what `</script` is made of. Escaping either alone would break
 * the sequence; both are escaped so the output cannot form an opening tag
 * either, which matters if this string is ever moved into a context that does
 * decode entities.
 *
 * `&` is escaped for that same someday-context. Inside a `<script>` element it
 * is inert, and escaping it costs nothing while removing the need to reason
 * about where the string ends up.
 *
 * U+2028 and U+2029 are LINE TERMINATORS in JavaScript and are legal unescaped
 * inside a JSON string. `application/ld+json` is parsed as JSON, so they are
 * not a hazard here today. They are escaped because the failure if this output
 * is ever read as JavaScript is a syntax error at runtime with no clue in the
 * source, and the escape is free.
 *
 * ## THESE ESCAPES DO NOT CHANGE THE DATA
 *
 * `<` is a valid JSON string escape and parses back to `<`. A consumer
 * sees the identical object; only the bytes on the wire differ. That is what
 * makes this safe to apply to every emitter without auditing what each one
 * contains, and it is asserted in the test by parsing the output back.
 */

/*
 * BUILT FROM STRINGS, not written as literal characters in a regex.
 *
 * U+2028 and U+2029 are invisible in every editor, so a reviewer cannot tell a
 * correct one from a space that replaced it in transit, and this file is the
 * one place where that distinction decides whether the escape happens at all.
 * An escape sequence inside a string survives a copy; the character does not.
 * `test/json-ld.test.mjs` builds its inputs the same way, so a mangled literal
 * here fails there rather than passing silently.
 */
const LINE_SEPARATOR = new RegExp("\\u2028", "g");
const PARAGRAPH_SEPARATOR = new RegExp("\\u2029", "g");

/**
 * @param {unknown} value
 * @returns {string}
 */
export function jsonLd(value) {
  return (
    JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(LINE_SEPARATOR, "\\u2028")
      .replace(PARAGRAPH_SEPARATOR, "\\u2029")
  );
}
