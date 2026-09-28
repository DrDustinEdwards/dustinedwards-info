/**
 * The footer's private-tools marks: line drawings on a 24-unit grid, one stroke weight, drawn in
 * currentColor so the link's ink-to-purple hover (ruling 122) reaches them. Decorative: the link
 * text carries the name, so each is aria-hidden.
 *
 * Identity marks (Dustin, 2026-09-28): the lamp for Carrel, a gear for Admin, the capsid for Portal.
 * The lock after each label says the link needs a sign-in.
 */

type IconProps = { className?: string; strokeWidth?: number };

function Mark({ className, strokeWidth = 1.5, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

/** Admin: a gear, eight teeth on the same grid. */
export function GearIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <path d="M18.85 9.78L21.28 9.96L21.28 14.04L18.85 14.22L18.42 15.27L20 17.12L17.12 20L15.27 18.42L14.22 18.85L14.04 21.28L9.96 21.28L9.78 18.85L8.73 18.42L6.88 20L4 17.12L5.58 15.27L5.15 14.22L2.72 14.04L2.72 9.96L5.15 9.78L5.58 8.73L4 6.88L6.88 4L8.73 5.58L9.78 5.15L9.96 2.72L14.04 2.72L14.22 5.15L15.27 5.58L17.12 4L20 6.88L18.42 8.73z" />
      <circle cx="12" cy="12" r="3" />
    </Mark>
  );
}

/**
 * The sign-in lock after each label. Drawn smaller, so its stroke is 2 on the grid: at 12px that is the
 * same 1px line the 16px marks draw at 1.5.
 */
export function LockIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path d="M12 15v2" />
    </Mark>
  );
}

/** Portal: an icosahedron in outline, the shape of a phage capsid. */
export function CapsidIcon(props: IconProps) {
  return (
    <Mark {...props}>
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
      <path d="M12 2.5L7.5 9.5h9zM7.5 9.5L3.8 16.75M16.5 9.5l3.7 7.25M7.5 9.5L12 16.5l4.5-7M12 16.5v5M12 16.5l-8.2.25M12 16.5l8.2.25" />
    </Mark>
  );
}
