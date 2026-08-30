import { IDLE_MINUTES } from "@shared/const";
import { decodeJwt } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("idle window", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // The window used to be 8 hours, and absolute. It is now the idle window,
  // slid forward by touchSession on every authenticated request.
  it("expires the token IDLE_MINUTES after it is issued", async () => {
    // ENV reads process.env once at import, so the module is loaded after the stub.
    vi.stubEnv("JWT_SECRET", "secret-used-only-by-this-test");
    vi.resetModules();
    const { createSessionToken } = await import("./access");

    const { iat, exp } = decodeJwt(await createSessionToken());

    expect(exp! - iat!).toBe(IDLE_MINUTES * 60);
  });
});
