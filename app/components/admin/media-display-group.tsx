import { TabsNav } from "capsomer/react/tabs";

import { TabLink } from "~/components/admin/tab-link";

// Links, not a select: each option is a URL, so display state is shareable and works with no script.
export function MediaDisplayGroup({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: Array<[string, string]>;
  current: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="cap-field">
      <span className="cap-field-label">{label}</span>
      <TabsNav aria-label={label} size="sm">
        {options.map(([id, text]) => (
          <TabLink key={id} to={hrefFor(id)} current={current === id}>
            {text}
          </TabLink>
        ))}
      </TabsNav>
    </div>
  );
}
