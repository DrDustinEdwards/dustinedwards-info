import { Link } from "react-router";

import playgroundData from "../../../content/playground.json";

const DEMOS = playgroundData.demos;

export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="playground-error" role="status">
      <strong>Cannot show that.</strong> {children}
    </p>
  );
}

/** Throws rather than defaulting: an input rendered with no value silently stops demonstrating. */
export function inputDefault(demoSlug: string, inputName: string): string {
  const demo = DEMOS.find((d) => d.slug === demoSlug);
  const input = demo?.inputs?.find((i) => i.name === inputName);
  const value = input && "default" in input ? input.default : undefined;
  if (typeof value !== "string") {
    throw new Error(`playground.json has no default for ${demoSlug}.${inputName}`);
  }
  return value;
}

/** Keyed by slug: a positional index would silently put another demo's title over this form. */
export function DemoHeader({ slug }: { slug: string }) {
  const demo = DEMOS.find((d) => d.slug === slug);
  if (!demo) return null;
  return (
    <>
      <h2 className="playground-demo-title">{demo.title}</h2>
      <p className="playground-demo-lede">{demo.lede}</p>
      <p className="playground-demo-runs">
        Runs <code>{demo.realPath.split(",")[0]}</code>.{" "}
        <Link to={`/blog/${demo.homeArticle.slug}`}>{demo.homeArticle.title}</Link>
      </p>
    </>
  );
}
