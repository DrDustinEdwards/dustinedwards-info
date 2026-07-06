// Minimal endpoint to confirm the /api/* plane is wired and the Worker is live.
export function loader() {
  return Response.json({ ok: true });
}
