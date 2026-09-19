import { createAuthClient } from "better-auth/react";

// Same-origin client. baseURL defaults to the current origin + /api/auth.
export const authClient = createAuthClient();
