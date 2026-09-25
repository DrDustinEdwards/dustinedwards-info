import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { PreviewLinks, type PreviewLinkView } from "~/components/admin/preview-links";

const link = (token: string): PreviewLinkView => ({
  token,
  short: token.slice(0, 6),
  url: `https://example.test/blog/draft?preview=${token}`,
  createdAt: "2026-09-20T00:00:00.000Z",
  expiresAt: "2026-09-27T00:00:00.000Z",
  createdBy: "",
  note: "",
});

const buttonNames = (html: string) =>
  [...html.matchAll(/<button type="button" class="row-action">(.*?)<\/button>/g)].map((m) =>
    (m[1] ?? "").replace(/<[^>]+>/g, ""),
  );

it("names every Copy button by the link it copies, so a row of them is not a row of 'Copy'", () => {
  const html = renderToStaticMarkup(
    h(PreviewLinks, { links: [link("abcdef111111"), link("uvwxyz222222")], created: null }),
  );
  expect(buttonNames(html)).toEqual(["Copy the link starting abcdef", "Copy the link starting uvwxyz"]);
});

it("renders the status and alert regions before any copy, empty, so the first result is announced", () => {
  const html = renderToStaticMarkup(h(PreviewLinks, { links: [link("abcdef111111")], created: null }));
  expect(html).toContain('<div class="sr-only"><div role="status"></div><div role="alert"></div></div>');
});
