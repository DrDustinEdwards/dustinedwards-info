import { createContext } from "react-router";

/**
 * The part of a session the admin plane reads: who. Cloudflare Access fills it for a person.
 *
 * Set for the human admin only: the smoke credential has no session, so reading this asserts a
 * human is present, and a write path reached by a machine throws rather than attributing to nobody.
 * Code that only needs to know who is asking reads `adminActorContext`.
 */
export type AdminSession = { user: { email: string } };

export const adminSessionContext = createContext<AdminSession>();

/**
 * `email` is a realistic length for the smoke actor too, so the smoke render is the page Dustin sees
 * and layout numbers measured through it are true.
 */
type AdminActor =
  | { kind: "admin"; email: string }
  | { kind: "smoke"; id: string; email: string };

export const adminActorContext = createContext<AdminActor>();
