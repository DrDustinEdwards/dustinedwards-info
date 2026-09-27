/**
 * The footer's private-tools marks: line drawings on a 24-unit grid, one stroke weight, drawn in
 * currentColor so the link's ink-to-purple hover (ruling 122) reaches them. Decorative: the link
 * text carries the name, so each is aria-hidden.
 *
 * The chosen set is the lamp, the padlock and the capsid. The alternatives (nib, gear, hexagon) are
 * kept beside them until Dustin picks, so the shots compare like with like.
 */

type IconProps = { className?: string };

function Mark({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Carrel: a desk lamp, the study-carrel light. */
export function LampIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <path d="M5 21h8" />
      <path d="M9 21v-2l-3-7 5-5" />
      <path d="M11 7l2.5-2.5 6 6L17 13z" />
      <path d="M17 13l-1.5 2" />
    </Mark>
  );
}

/** Admin: a padlock. */
export function PadlockIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path d="M12 15v2" />
    </Mark>
  );
}

/** Console: an icosahedron in outline, the shape of a phage capsid. */
export function CapsidIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
      <path d="M12 2.5L7.5 9.5h9zM7.5 9.5L3.8 16.75M16.5 9.5l3.7 7.25M7.5 9.5L12 16.5l4.5-7M12 16.5v5M12 16.5l-8.2.25M12 16.5l8.2.25" />
    </Mark>
  );
}

/** Alternative for Carrel: a pen nib. */
export function NibIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <path d="M12 21l-6-8 3-9h6l3 9z" />
      <path d="M12 21v-8" />
      <circle cx="12" cy="11" r="1.5" />
    </Mark>
  );
}

/** Alternative for Admin: a gear. */
export function GearIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
      <circle cx="12" cy="12" r="6.5" />
    </Mark>
  );
}

/** Alternative for Console: a plain hexagon. */
export function HexagonIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
    </Mark>
  );
}
