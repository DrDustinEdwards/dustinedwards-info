import { redirect } from "react-router";

/** Permanent: this address held the Google sign-in page until Cloudflare Access took over /admin. */
export function loader() {
  throw redirect("/admin", 301);
}
