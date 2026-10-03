/**
 * An address no route claims. A route of its own, inside the legacy public layout (delete with it), so the 404 page carries the
 * public stylesheets: an unmatched URL would otherwise match only the root, which has none. It needs a
 * component to count as a page; the loader throws first, so the root's boundary is what renders.
 */
export function loader(): never {
  throw new Response("Not Found", { status: 404, statusText: "Not Found" });
}

export default function NotFound() {
  return null;
}
