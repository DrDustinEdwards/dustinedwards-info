/**
 * Capsomer's tip for a header icon control (site-header.md, "Controls"): it repeats the control's name, so it
 * adds no description, and app/enhance/header.ts shows it on hover and keyboard focus. Hidden with no script.
 */
export function HeaderTip({ text, keys }: { text: string; keys?: string[] }) {
  return (
    <span
      className="cap-site-header-tip cap-popover"
      data-variant="tooltip"
      data-side="bottom"
      data-offset="6"
      popover="manual"
      role="tooltip"
      aria-hidden="true"
    >
      <span className="cap-site-header-tip-text">{text}</span>
      {keys ? (
        <span className="cap-keys">
          {keys.map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </span>
      ) : null}
    </span>
  );
}
