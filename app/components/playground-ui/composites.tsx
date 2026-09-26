/** Composited pixels: contrast that is a property of the image, not of a token pair. */
export function CompositesSection() {
  return (
    <section className="pgui-section" aria-labelledby="composite-h">
      <h2 id="composite-h">Composited pixels</h2>
      <p>
        Three things whose contrast is a property of the pixels rather than of a token pair.
        A gate that measures tokens alone cannot see any of them.
      </p>

      <figure className="pgui-shot">
        <img
          src="/phage-hunters/dustin-edwards-2024.webp"
          alt="The 2024 Phage Hunters cohort in the teaching lab."
          width={1200}
          height={800}
        />
        <figcaption>
          Phage Hunters, 2024. The caption scrim is opaque on purpose: fading it to
          transparent would make the photograph the backdrop, and the ratio would vary by
          image.
        </figcaption>
      </figure>

      <div className="pgui-og">
        <img
          src="/dustin-edwards-og-image.png"
          alt="The site's default social card: the mark, the site name and a gold rule."
          width={1200}
          height={630}
        />
      </div>

      <div className="prose">
        <h3>A code block inside prose</h3>
        <p>
          The block below is the prose sheet&rsquo;s, not a lookalike. A post&rsquo;s
          highlighted code carries its colors inline from the build, so what is measurable
          here is the block itself: mono type on the code surface, inside a run of body text.
        </p>
        {/* Focusable so a keyboard can scroll it (WCAG 2.1.1), and named so the stop says what it is. */}
        <pre tabIndex={0} role="region" aria-label="Code sample">
          <code>
            {"export function headers() {\n  return new Headers(publicHtmlHeaders());\n}"}
          </code>
        </pre>
        <p>
          The paragraph after it exists so the block has text on both sides, which is the
          arrangement a reader actually meets.
        </p>
      </div>
    </section>
  );
}
