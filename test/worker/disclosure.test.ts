import { createElement } from "react";
// jsx(), what `<OverflowMenu label="More">...</OverflowMenu>` compiles to, so the menu's children are nested as JSX nests
// them; createElement's typing would demand them as a prop as well. A .ts file, as the worker suite's pattern is.
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverflowMenu } from "~/components/admin/overflow-menu";

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("the overflow menu", () => {
  it("open without script: a button names its panel by popovertarget and the panel is a popover", () => {
    const html = render(
      jsx(OverflowMenu, { label: "More", children: createElement("a", { href: "/x" }, "Edit") }),
    );
    const target = html.match(/<button[^>]*popovertarget="([^"]+)"/i)?.[1];
    expect(target).toBeTruthy();
    expect(html).toContain(`id="${target}" popover="auto"`);
    expect(html).not.toMatch(/<details|<summary/);
  });

  it("gives every menu its own popover, or one button would open another's panel", () => {
    const html = render(
      createElement(
        "div",
        null,
        jsx(OverflowMenu, { label: "More", children: "one" }),
        jsx(OverflowMenu, { label: "Maintenance", children: "two" }),
      ),
    );
    const targets = [...html.matchAll(/popovertarget="([^"]+)"/gi)].map((m) => m[1]);
    expect(new Set(targets).size).toBe(2);
  });
});
