/** What is not on this page: gaps named by a handoff or a ruling, shown so nobody builds them twice. */
export function GapsSection() {
  return (
    <section className="pgui-section" aria-labelledby="gaps-h">
      <h2 id="gaps-h">What is not on this page</h2>
      <p>
        Eight things named by a handoff or a ruling that this page does not draw. They are
        listed here rather than only in a report, because the page is the fixture and a gap
        nobody can see is a gap that gets built twice.
      </p>
      <ul>
        <li>
          <b>The overlay menu.</b> The Paper kit specified one and then deleted it: the
          header was restored on 14 September and the nav wraps instead of collapsing. There
          is no panel, no toggle and no state to close.
        </li>
        <li>
          <b>A photograph behind a fixed bar.</b> The header is static and in flow, so
          nothing scrolls behind it. The composite that remains is the caption scrim above,
          and that is the one measured here.
        </li>
        <li>
          <b>The publication entry.</b> The kit calls it a reference rather than a redraw. It
          ships on <a href="/publications">the publications page</a> with its microdata and
          its export links, and redrawing it here would make a second copy to drift.
        </li>
        <li>
          <b>Five post components the 2026-09-13 rulings name.</b> The post status tag, the
          assumed-audience line, the highlight box, the pull quote and the key-takeaways
          block. None has a component, a stylesheet rule, a markdown directive or a
          frontmatter field, and neither the Paper kit nor the post handoff specifies one:
          the post handoff predates the rulings and still rules the progress bar out. They
          are named here rather than drawn, because drawing them would be inventing a design
          and calling it an inventory.
        </li>
        <li>
          <b>The reading-progress bar</b>, which is the one component of the six that
          already ships: <code>app/enhance/blog.ts</code> creates it, and it is styled in
          <code>post-enhancements.css</code>. A specimen here costs the whole of that sheet,
          because the bar is one rule of seventeen class families in it and a copy of the
          rule would be a second owner free to drift. Measured: the import puts this route
          at 10,689 brotli bytes of stylesheet against a 10,600 ceiling and 11,503 against
          an 11,500 cold-load ceiling. Raising either is a no-framework-script rule decision, so the bar
          waits for one rather than taking it.
        </li>
        <li>
          <b>A filled error alert.</b> Ruled allowed on 13 September, and the kit refuses it
          for a reason that still holds: a tinted panel needs a measured surface pair per
          state per theme, and the palette carries none. The three bordered variants are
          above. The filled one arrives with its token, not before it.
        </li>
        <li>
          <b>The header at five widths.</b> The header is a page singleton and its widths
          are the capture widths, not copies in the page; the fixed bar those widths were
          once about was deleted on 14 September with <code>--bar-h</code>. Rendering five
          of it here would put five headers in one document and measure none of them.
        </li>
        <li>
          <b>The lamp on the search field.</b> The glass fill is legal on /search over paper
          and nowhere else, and the utility that applies it does not exist yet.
        </li>
      </ul>
    </section>
  );
}
