import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverflowMenu } from "~/components/admin/overflow-menu";
import { RowMenu } from "~/components/admin/row-menu";

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("the overflow and row menus", () => {
  it("open without script: a button names its panel by popovertarget and the panel is a popover", () => {
    const html = render(
      createElement(RowMenu, { label: "Actions for A post", children: createElement("a", { href: "/x" }, "Edit") }),
    );
    const target = html.match(/<button[^>]*popovertarget="([^"]+)"/i)?.[1];
    expect(target).toBeTruthy();
    expect(html).toContain(`id="${target}" popover="auto"`);
    expect(html).toMatch(/<button type="button" class="cap-btn"[^>]*aria-label="Actions for A post"/);
    expect(html).not.toMatch(/<details|<summary/);
  });

  it("gives every menu its own popover, or one button would open another's panel", () => {
    const html = render(
      createElement(
        "div",
        null,
        createElement(OverflowMenu, { label: "More", children: "one" }),
        createElement(OverflowMenu, { label: "Maintenance", children: "two" }),
      ),
    );
    const targets = [...html.matchAll(/popovertarget="([^"]+)"/gi)].map((m) => m[1]);
    expect(new Set(targets).size).toBe(2);
  });
});
