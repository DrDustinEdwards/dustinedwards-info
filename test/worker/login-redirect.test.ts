import { describe, expect, it } from "vitest";

import { loader } from "~/routes/login";

describe("/login", () => {
  it("forwards to /admin permanently, where Cloudflare Access signs in", async () => {
    let thrown: unknown;
    try {
      loader();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/admin");
  });
});
