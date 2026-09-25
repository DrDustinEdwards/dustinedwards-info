import type { ReactNode } from "react";

/** Ids are per panel: the same specimen renders twice and labels need targets. */
type Ids = (name: string) => string;

function Pair({ id, children }: { id: string; children: (ids: Ids) => ReactNode }) {
  return (
    <div className="pgui-pair">
      <div className="pgui pgui-panel" data-theme="light">
        <span className="pgui-panel-tag">Light</span>
        {children((name) => `${id}-l-${name}`)}
      </div>
      <div className="pgui pgui-panel" data-theme="dark">
        <span className="pgui-panel-tag">Dark</span>
        {children((name) => `${id}-d-${name}`)}
      </div>
    </div>
  );
}

export function Spec({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: (ids: Ids) => ReactNode;
}) {
  return (
    <section className="pgui-spec" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{title}</h3>
      {note ? <p>{note}</p> : null}
      <Pair id={id}>{children}</Pair>
    </section>
  );
}

export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pgui-state">
      <span>{label}</span>
      {children}
    </div>
  );
}

/** Inline: an icon font fails to tofu and a sprite is a second request. */
export function Icon({ name, className = "icon" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

type IconName = keyof typeof ICONS;

const ICONS = {
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  "check-circle": (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m22 4-10 10.01-3-3" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
} as const;

export function Select({ id, disabled }: { id: string; disabled?: boolean }) {
  return (
    <div className="select-wrap">
      <select className="field-input field-select" id={id} name="sort" disabled={disabled}>
        <option>Newest first</option>
        <option>Oldest first</option>
      </select>
      <Icon name="chevron-down" className="icon select-chevron" />
    </div>
  );
}
