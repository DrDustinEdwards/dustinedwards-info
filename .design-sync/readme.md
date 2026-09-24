# dustinedwards.info: Paper and Plate

The visual system for dustinedwards.info. The page is paper: warm limestone ground, ink text, dust hairlines as the only structure, purple only on what a reader can click. The drawings are plates: flat line work with oxide leaders, mono labels and a scale bar. The stylesheets are the source of truth; `templates/visual-system/VisualSystem.dc.html` draws them.

Load `styles.css`. Theme is `data-theme="light"` or `"dark"`; a themed container sets both `background: var(--paper)` and `color: var(--text)`.

## Avoid

- Cards
- Pills and capsules
- Filled boxes
- Rounded corners on the page
- Italic accent words in headlines
- Numbered section labels
- Stock photos
- Lighting on figures: gradients, glows, shadows or haze

## Where to look

- `templates/visual-system/`: the approved visual system, the design authority.
- `cards/`: preview cards for the colors, the type and every public component, rendered from the site's own stylesheets and components.
- `guidelines/`: the long notes, including what is already decided (`canvas-constraints.md`) and the vocabulary of tokens and classes (`conventions.md`).
