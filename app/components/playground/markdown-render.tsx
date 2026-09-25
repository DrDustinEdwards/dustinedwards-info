import { Form } from "react-router";

import playgroundData from "../../../content/playground.json";
import { DemoHeader, Problem } from "~/components/playground/demo-parts";
import type { markdownRenderDemo } from "~/lib/playground/markdown-render";
import { PLAYGROUND_URL, demoAnchor } from "~/lib/playground-page.mjs";

const SNIPPETS = playgroundData.markdownSnippets;

type Props = Awaited<ReturnType<typeof markdownRenderDemo>> & {
  /** The other demos' state as hidden fields, so submitting this form keeps their results. */
  carry: React.ReactNode;
};

export function MarkdownRenderDemo({ markdown, markdownRefusal, snippetError, snippetSlug, snippetNote, carry }: Props) {
  return (
    <section id={demoAnchor("markdown-render")} className="playground-demo">
      <DemoHeader slug="markdown-render" />

      <Form method="get" action={PLAYGROUND_URL} className="playground-form">
        {carry}
        <fieldset className="playground-fieldset">
          <legend>Snippet</legend>
          {SNIPPETS.map((s) => (
            <label key={s.slug} className="playground-radio">
              <input
                type="radio" name="md" value={s.slug}
                defaultChecked={s.slug === snippetSlug}
              />
              {s.label}
            </label>
          ))}
        </fieldset>
        <button type="submit">Render</button>
        <p className="playground-cap">
          Enum inputs only. There is no text box here: the pipeline runs a
          syntax highlighter over a WebAssembly regex engine and a
          directive layer that resolves assets, so arbitrary text into it
          is a compute and sanitization surface that needs its own threat
          model before it reaches the public plane.
        </p>
      </Form>

      {snippetError && <Problem>{snippetError}</Problem>}

      <div className="playground-result">
        <h3 className="playground-subhead">In</h3>
        <pre className="playground-source">
          <code>{markdown?.source ?? SNIPPETS.find((s) => s.slug === snippetSlug)?.source}</code>
        </pre>
        <p className="playground-note">{snippetNote}</p>

        <h3 className="playground-subhead">Out</h3>

        {markdownRefusal && (
          <>
            <Problem>{markdownRefusal}</Problem>
            <p className="playground-note">
              That is the pipeline failing closed, before any directive
              handler runs. A directive nobody implemented is a named build
              error rather than a silent empty div in a published article,
              which is why this branch cannot be shown any other way: an
              article carrying it would never have been published.
            </p>
          </>
        )}

        {markdown && (
          <>
            {/* The same `renderBody` output an article gets; no third-party input, so it can be injected. */}
            <div
              className="prose playground-rendered"
              dangerouslySetInnerHTML={{ __html: markdown.html }}
            />

            <h3 className="playground-subhead">Collected on the way through</h3>
            <dl className="playground-metrics">
              <div>
                <dt>Heading anchors</dt>
                <dd>
                  {markdown.toc.length > 0
                    ? markdown.toc.map((h) => h.id).join(", ")
                    : "none"}
                </dd>
              </div>
              <div>
                <dt>URLs the allowlist demoted</dt>
                <dd>
                  {markdown.blockedUrls.length > 0
                    ? markdown.blockedUrls.map((b) => b.url).join(", ")
                    : "none"}
                </dd>
              </div>
            </dl>

            {markdown.blockedUrls.length > 0 && (
              <p className="playground-note">
                A refused link is demoted to the markdown that produced it
                rather than stripped or emptied, because both of those look
                to an author exactly like a link that worked. Un-rendered
                markdown is the one signal every markdown author already
                reads as "this did not become what I meant", and the
                offending URL stays in the text so the reason is legible
                without opening a console. It is emitted as a text node, so
                it cannot re-enter the document as markup. The guard runs
                LAST in the chain on purpose, after every href and src the
                pipeline can emit: markdown links and images, the figure
                directive, diagram assets, heading autolinks and footnote
                references.
              </p>
            )}

            <p className="playground-note">
              The heading anchors are collected during the same pass that
              renders, not by a second walk afterwards, which is what makes
              a post's table of contents and its heading permalinks
              incapable of disagreeing. This is one call, and it is the one
              the deploy build makes for every article, the editor preview
              makes on every keystroke and the operator API makes on every
              save.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
