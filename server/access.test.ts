import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "./access";

describe("session cookie", () => {
  it("carries no lifetime, so the browser drops it on close", () => {
    const options = sessionCookieOptions(true) as Record<string, unknown>;
    // A 30-day cookie meant the password gate never asked again after the
    // first unlock — the protection lapsing without anyone noticing.
    expect(options).not.toHaveProperty("maxAge");
    expect(options).not.toHaveProperty("expires");
  });

  it("stays httpOnly and same-site, and secure in production", () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(sessionCookieOptions(false)).toMatchObject({ secure: false });
  });
});
