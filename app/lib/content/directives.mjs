// The container and text directive plugins (:::figure, :::details, :::sidenote, :::pullquote,
// :swatch, :::chart, :::diagram) and the guard that refuses an unknown one. renderBody in
// pipeline.mjs decides their order.

import { visit } from "unist-util-visit";

import { errorMessage } from "../error-message.mjs";
import { buildChartModel, renderChartHast } from "./chart.mjs";
import { ContentError } from "./content-error.mjs";
import { buildDiagramModel, renderDiagramHast } from "./diagram.mjs";

/**
 * Valueless attributes are dropped: they are indistinguishable from absent ones.
 *
 * @param {{ attributes?: Record<string, string | null | undefined> | null | undefined }} node
 * @returns {Record<string, string>}
 */
function attributesOf(node) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * @param {string} file
 */
export function remarkFigure(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "figure") return;

      const attrs = node.attributes ?? {};
      if (!attrs.src) {
        throw new ContentError(file, ":::figure requires a src attribute");
      }
      if (!attrs.alt) {
        // A figcaption is announced separately, so it is no substitute for alt.
        throw new ContentError(file, `:::figure ${attrs.src} requires an alt attribute`);
      }

      /** @type {any[]} */
      const captionChildren = [...(node.children ?? [])];

      /** @type {any[]} */
      const figureChildren = [
        {
          type: "paragraph",
          data: { hName: "img", hProperties: { src: attrs.src, alt: attrs.alt } },
          children: [],
        },
      ];

      if (captionChildren.length > 0 || attrs.credit) {
        /** @type {any[]} */
        const caption = [...captionChildren];
        if (attrs.credit) {
          caption.push({
            type: "paragraph",
            data: { hName: "span", hProperties: { className: ["figure-credit"] } },
            children: [{ type: "text", value: attrs.credit }],
          });
        }
        figureChildren.push({
          type: "paragraph",
          data: { hName: "figcaption" },
          children: caption,
        });
      }

      node.data = { ...node.data, hName: "figure" };
      node.children = figureChildren;
    });
  };
}

// Hex only: a named color, rgb() or color-mix() makes the render depend on the UA or the cascade.
// Anchored at both ends, or #6B4FBBZZ would pass on its prefix.
const SWATCH_HEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/**
 * Uppercased so two spellings of one color render the same bytes. The chip is aria-hidden because the
 * code-span label is the second channel. The inline --swatch style is already permitted by
 * style-src-attr 'unsafe-inline' in workers/csp.mjs.
 *
 * @param {string} file
 */
export function remarkSwatch(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "textDirective" || node.name !== "swatch") return;

      const attrs = /** @type {Record<string, string>} */ (node.attributes ?? {});
      // Text children only: nested markup would put an element inside the <code> label.
      const label = (node.children ?? [])
        .map((child) => (child.type === "text" ? child.value : ""))
        .join("")
        .trim();
      // A line of the BODY: the tree is parsed without frontmatter, and the editor preview has no file.
      const line = node.position?.start?.line;
      const where = `:swatch${line ? ` on line ${line} of the body` : ""}`;

      const raw = (attrs.color ?? label).trim();
      if (raw.length === 0) {
        throw new ContentError(
          file,
          `${where} carries no color. Write :swatch[#RRGGBB], or ` +
            `:swatch[a label]{color=#RRGGBB} when the label is not the hex.`,
        );
      }
      if (!SWATCH_HEX.test(raw)) {
        throw new ContentError(
          file,
          `${where} cannot use ${JSON.stringify(raw)} as a color. Only #RGB, ` +
            `#RRGGBB and #RRGGBBAA are accepted: a named color, rgb() or ` +
            `color-mix() would make the rendered page depend on something ` +
            `outside this file.`,
        );
      }

      const hex = raw.toUpperCase();
      // Only a hex label is uppercased; a prose label stays as written.
      const text = attrs.color ? label : hex;

      node.data = {
        ...node.data,
        hName: "span",
        hProperties: { className: ["swatch"] },
      };
      node.children = /** @type {any} */ ([
        {
          // emphasis is only an inline carrier: hName replaces the tag before serialization.
          type: "emphasis",
          data: {
            hName: "span",
            hProperties: {
              className: ["swatch-chip"],
              style: `--swatch:${hex}`,
              "aria-hidden": "true",
            },
          },
          children: [],
        },
        {
          type: "inlineCode",
          value: text,
          data: { hProperties: { className: ["swatch-label"] } },
        },
      ]);
    });
  };
}

/**
 * remark-directive parses prose such as 4.5:1 and localhost:8080 as directives, and every real
 * directive name is a word. Sliced from the source so a label or attributes come back as written.
 *
 * @param {string} source the markdown these positions refer to
 */
export function remarkNumericTextDirectives(source) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "textDirective", (node, index, parent) => {
      if (!parent || index === undefined || index === null) return;
      if (!/^\d/.test(node.name ?? "")) return;
      const { start, end } = node.position ?? {};
      if (start?.offset === undefined || end?.offset === undefined) return;
      parent.children[index] = {
        type: "text",
        value: source.slice(start.offset, end.offset),
        position: node.position,
      };
    });
  };
}

/**
 * Refuses a heading directly inside a container directive, naming the directive and the line.
 *
 * @param {string} file
 * @param {any} node the directive
 * @param {string} why completes the sentence that names the heading
 */
function refuseHeading(file, node, why) {
  const heading = (node.children ?? []).find((/** @type {any} */ child) => child.type === "heading");
  if (!heading) return;
  const line = heading.position?.start?.line;
  throw new ContentError(file, `:::${node.name} holds a heading${line ? ` on line ${line}` : ""}${why}`);
}

/**
 * A heading inside is refused: it would put a hidden section in the table of contents. Native
 * <details>, so the text is in the HTML without script.
 *
 * @param {string} file
 */
export function remarkDetails(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "details") return;

      const summary = (node.attributes ?? {}).summary;
      if (!summary) {
        throw new ContentError(file, ":::details requires a summary attribute");
      }

      refuseHeading(
        file,
        node,
        ", which makes it a section of the argument rather than supplementary material. A " +
          "heading is in the table of contents and is a link target, so collapsing it hides a " +
          "section a reader was sent to. Use it for long methods, raw data or an appendix, and " +
          "leave the argument open.",
      );

      node.data = { ...node.data, hName: "details", hProperties: { className: ["post-details"] } };
      node.children = [
        {
          type: "paragraph",
          data: { hName: "summary" },
          children: [{ type: "text", value: String(summary) }],
        },
        .../** @type {any[]} */ (node.children ?? []),
      ];
    });
  };
}

const PULL_QUOTE_LIMIT = 2;

/**
 * Stays in the prose flow and post-rail.css floats it into the rail: that aligns it with its paragraph
 * without measuring, on a plane that does not hydrate.
 *
 * @param {string} file
 */
export function remarkSidenote(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    let noteIndex = 0;
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "sidenote") return;

      const kind = (node.attributes ?? {}).kind;
      if (!kind) {
        throw new ContentError(
          file,
          ':::sidenote requires a kind attribute, for example :::sidenote{kind="Fallback"}. ' +
            "The label is the reader's only cue about what the note is before they read it.",
        );
      }

      refuseHeading(
        file,
        node,
        ". A heading is a section of the argument: it lands in the table of contents and is a " +
          "link target, and the rail is not where a section goes. Keep a note to prose.",
      );

      // Numbered in source order so #sn-1 stays the first note for anyone linking to it.
      noteIndex += 1;
      node.data = {
        ...node.data,
        hName: "aside",
        hProperties: { className: ["post-note"], id: `sn-${noteIndex}` },
      };
      node.children = [
        {
          type: "paragraph",
          data: { hName: "b", hProperties: { className: ["post-note-kind"] } },
          children: [{ type: "text", value: String(kind) }],
        },
        .../** @type {any[]} */ (node.children ?? []),
      ];
    });
  };
}

const PULL_QUOTE_MAX_CHARS = 160;

/**
 * Marks a sentence already in the prose instead of duplicating it, so the .md twin, which serves the
 * source verbatim, has it once. The raised copy is aria-hidden so a screen reader hears it once.
 *
 * @param {string} file
 */
export function remarkPullQuote(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    let raised = 0;
    visit(tree, (node, index, parent) => {
      if (node.type !== "paragraph" || parent?.type !== "root" || index === undefined) return;

      /** @type {any[]} */
      const marks = [];
      visit(node, "textDirective", (child) => {
        if (child.name === "pullquote") marks.push(child);
      });
      if (marks.length === 0) return;

      const line = marks[0].position?.start?.line;
      const where = `:pullquote${line ? ` on line ${line} of the body` : ""}`;

      if (marks.length > 1) {
        throw new ContentError(
          file,
          `${where}: one paragraph carries ${marks.length} pull quotes. A paragraph has one ` +
            "sentence worth raising, and two raised above the same paragraph read as a list.",
        );
      }

      const mark = marks[0];
      const text = (mark.children ?? [])
        .map((/** @type {any} */ child) => (child.type === "text" ? child.value : ""))
        .join("")
        .trim();

      if (text.length === 0) {
        throw new ContentError(
          file,
          `${where} is empty. Wrap the sentence it should raise: :pullquote[the sentence].`,
        );
      }
      if (text.length > PULL_QUOTE_MAX_CHARS) {
        throw new ContentError(
          file,
          `${where} is ${text.length} characters and the limit is ${PULL_QUOTE_MAX_CHARS}. ` +
            "A pull quote is read at a glance; mark the clause rather than the sentence.",
        );
      }

      const at = (node.children ?? []).indexOf(mark);
      if (at === -1) {
        throw new ContentError(
          file,
          `${where} is nested inside other markup. It must sit directly in the paragraph, so the ` +
            "sentence it raises is the sentence a reader reads.",
        );
      }

      raised += 1;
      if (raised > PULL_QUOTE_LIMIT) {
        throw new ContentError(
          file,
          `${where} is pull quote number ${raised} and the limit is ${PULL_QUOTE_LIMIT}. ` +
            "A third one is a page with no emphasis left to spend.",
        );
      }

      node.children.splice(at, 1, .../** @type {any[]} */ (mark.children ?? []));

      parent.children.splice(index, 0, {
        type: "paragraph",
        data: {
          hName: "p",
          hProperties: { className: ["pull-quote"], "aria-hidden": "true" },
        },
        children: [{ type: "text", value: text }],
      });

      // Skip the quote just inserted and the paragraph it came from.
      return index + 2;
    });
  };
}

// Adding a directive means adding it here, or remarkUnknownDirectives fails the build.
export const KNOWN_DIRECTIVES = [
  "chart",
  "details",
  "diagram",
  "figure",
  "pullquote",
  "sidenote",
  "swatch",
];

/**
 * An unhandled directive becomes a silent empty <div>, so a typo such as :::figrue loses the figure.
 * Runs after remarkNumericTextDirectives, so prose like 12:30 is already text.
 *
 * @param {string} file
 */
export function remarkUnknownDirectives(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      // Named rather than matched on a suffix, so TypeScript narrows the union.
      if (
        node.type !== "containerDirective" &&
        node.type !== "leafDirective" &&
        node.type !== "textDirective"
      ) {
        return;
      }
      const type = node.type;
      const name = node.name ?? "";
      if (KNOWN_DIRECTIVES.includes(name)) return;

      const marker =
        type === "containerDirective" ? ":::" : type === "leafDirective" ? "::" : ":";
      const line = node.position?.start?.line;
      throw new ContentError(
        file,
        `unknown directive "${marker}${name}"${line ? ` on line ${line}` : ""}. ` +
          `Known directives: ${KNOWN_DIRECTIVES.join(", ")}. ` +
          "If this is ordinary prose, escape the colon as \\: or wrap it in a code span.",
      );
    });
  };
}

/**
 * Split across remark and rehype: validation must fail the build in remark, but the caption only
 * becomes hast after remark-rehype. The remark half of a model directive: a container holding
 * exactly one fenced block, built into a model and marked with the model's index for the rehype half.
 *
 * @param {{
 *   name: string,
 *   marker: string,
 *   className: string,
 *   what: string,
 *   lang?: string,
 *   build: (attributes: any, source: string) => any,
 * }} kind `what` names the fence's content in the refusal; `lang` is the fence language required, if any
 */
function remarkModelDirective(kind) {
  /**
   * @param {string} file
   * @param {any[]} sink models, indexed by the marker written onto the node
   */
  return (file, sink) =>
    (/** @type {import("mdast").Root} */ tree) => {
      visit(tree, (node) => {
        if (node.type !== "containerDirective" || node.name !== kind.name) return;

        const children = node.children ?? [];
        const fences = children.filter((c) => c.type === "code");
        const fence = fences[0];
        if (fences.length !== 1 || !fence) {
          throw new ContentError(
            file,
            `:::${kind.name} requires exactly one fenced code block of ${kind.what}, found ${fences.length}`,
          );
        }
        // The mermaid fence is also what renders the source as a diagram in the .md twin and on GitHub.
        const lang = fence.lang ?? "";
        if (kind.lang !== undefined && lang !== kind.lang) {
          throw new ContentError(
            file,
            `:::${kind.name} source must be a \`\`\`${kind.lang} fenced block, found \`\`\`${lang || "(none)"}`,
          );
        }

        /** @type {any} */
        let model;
        try {
          model = kind.build(attributesOf(node), fence.value);
        } catch (error) {
          throw new ContentError(file, errorMessage(error));
        }

        const index = sink.push(model) - 1;
        node.data = {
          ...node.data,
          hName: "figure",
          hProperties: { className: [kind.className], [kind.marker]: String(index) },
        };
        node.children = children.filter((/** @type {any} */ c) => c.type !== "code");
      });
    };
}

/**
 * The rehype half: renders each marked figure from its model and drops the marker.
 *
 * @param {string} marker
 * @param {(model: any, caption: any[]) => any[]} render
 */
function rehypeModelMarker(marker, render) {
  /** @param {any[]} models */
  return (models) =>
    (/** @type {import("hast").Root} */ tree) => {
      visit(tree, "element", (node) => {
        const at = node.properties?.[marker];
        if (at === undefined) return;
        const model = models[Number(at)];
        delete node.properties[marker];
        node.children = render(model, node.children ?? []);
      });
    };
}

export const remarkChart = remarkModelDirective({
  name: "chart",
  marker: "data-chart",
  className: "chart-figure",
  what: "data",
  build: buildChartModel,
});
export const rehypeChart = rehypeModelMarker("data-chart", renderChartHast);

export const remarkDiagram = remarkModelDirective({
  name: "diagram",
  marker: "data-diagram",
  className: "diagram-figure",
  what: "mermaid source",
  lang: "mermaid",
  build: buildDiagramModel,
});
export const rehypeDiagram = rehypeModelMarker("data-diagram", renderDiagramHast);
