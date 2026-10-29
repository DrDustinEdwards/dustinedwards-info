import { createContext } from "react-router";

/**
 * `email` is a realistic length for the smoke actor too, so the smoke render is the page Dustin sees
 * and layout numbers measured through it are true.
 */
type AdminActor =
  | { kind: "admin"; email: string }
  | { kind: "smoke"; id: string; email: string };

export const adminActorContext = createContext<AdminActor>();
