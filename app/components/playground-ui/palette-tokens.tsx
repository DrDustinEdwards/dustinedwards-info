/* Generated from app.css by build:tokens: a Worker cannot read a stylesheet. */
import tokenData from "../../../content/tokens.json";

/** One swatch per palette token, in both themes, from the list build:tokens generates. */
export function PaletteTokensSection() {
  return (
    <section className="pgui-section" aria-labelledby="tokens-h">
      <h2 id="tokens-h">Palette tokens</h2>
      <p>
        One swatch per palette token, in both themes. The chip paints the live token and the
        hex beside it is the value read out of app.css when the list was generated, so a
        chip and its hex disagreeing is a fact the page shows rather than hides. A token that
        resolves to nothing paints no chip at all.
      </p>

      <h3>Light</h3>
      <ul className="pgui-swatches" data-theme="light">
        {tokenData.tokens.map((token) => (
          <li className="pgui-swatch" key={`l-${token.name}`}>
            <span className="pgui-swatch-chip" style={{ background: `var(${token.name})` }} />
            <span className="pgui-swatch-text">
              <span className="pgui-swatch-name">{token.name}</span>
              <span className="pgui-swatch-hex">{token.light}</span>
            </span>
          </li>
        ))}
      </ul>

      <h3>Dark</h3>
      <ul className="pgui-swatches" data-theme="dark">
        {tokenData.tokens.map((token) => (
          <li className="pgui-swatch" key={`d-${token.name}`}>
            <span className="pgui-swatch-chip" style={{ background: `var(${token.name})` }} />
            <span className="pgui-swatch-text">
              <span className="pgui-swatch-name">{token.name}</span>
              <span className="pgui-swatch-hex">{token.dark}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
