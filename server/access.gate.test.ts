import { IDLE_MINUTES } from "@shared/const";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The gate, end to end on the server side.
 *
 * The browser half is covered by useIdleLock's tests; this covers what the
 * server actually enforces, which is the half that decides whether a request
 * touches the meetings. It loads `access.ts` fresh under a stubbed environment
 * because ENV reads process.env once at import.
 */
const PASSWORD = "gate-test-password";
const SECRET = "gate-test-signing-secret";

async function loadAccess(appPassword: string) {
  vi.stubEnv("APP_PASSWORD", appPassword);
  vi.stubEnv("JWT_SECRET", SECRET);
  vi.resetModules();
  return import("./access");
}

/** Whatever `res.cookie` was handed, as the header a browser would send back. */
function fakeRes() {
  const set: Record<string, string> = {};
  return {
    set,
    cookie: (name: string, value: string) => {
      set[name] = value;
    },
    header: () => Object.entries(set).map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

describe("the gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("is open when no password is configured", async () => {
    const access = await loadAccess("");

    expect(access.accessIsOpen()).toBe(true);
    await expect(access.hasValidSession(undefined)).resolves.toBe(true);
  });

  it("is shut when a password is configured", async () => {
    const access = await loadAccess(PASSWORD);

    expect(access.accessIsOpen()).toBe(false);
    await expect(access.hasValidSession(undefined)).resolves.toBe(false);
  });

  it("turns the right password into a session, and refuses the wrong one", async () => {
    const access = await loadAccess(PASSWORD);

    expect(access.passwordMatches(PASSWORD)).toBe(true);
    expect(access.passwordMatches(PASSWORD.toUpperCase())).toBe(false);
    expect(access.passwordMatches(PASSWORD.slice(0, -1))).toBe(false);
    expect(access.passwordMatches("")).toBe(false);

    const res = fakeRes();
    await access.touchSession(res);

    await expect(access.hasValidSession(res.header())).resolves.toBe(true);
  });

  it("refuses a session signed with someone else's secret", async () => {
    const access = await loadAccess(PASSWORD);

    const forged = await new SignJWT({ scope: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-the-secret"));

    await expect(access.hasValidSession(`${access.ACCESS_COOKIE}=${forged}`)).resolves.toBe(false);
  });

  it("refuses a session once the idle window has run out", async () => {
    vi.useFakeTimers();
    const access = await loadAccess(PASSWORD);

    const res = fakeRes();
    await access.touchSession(res);
    const cookie = res.header();

    vi.advanceTimersByTime((IDLE_MINUTES - 1) * 60 * 1000);
    await expect(access.hasValidSession(cookie)).resolves.toBe(true);

    // jose allows a small clock skew, so step well past the boundary.
    vi.advanceTimersByTime(3 * 60 * 1000);
    await expect(access.hasValidSession(cookie)).resolves.toBe(false);
  });

  it("slides the window forward, so a session in use never runs out", async () => {
    vi.useFakeTimers();
    const access = await loadAccess(PASSWORD);

    const res = fakeRes();
    await access.touchSession(res);

    // Half an hour of work, with a touch every few minutes — what the browser's
    // keep-alive does while someone types a note that is never saved.
    for (let minute = 0; minute < 30; minute += 3) {
      vi.advanceTimersByTime(3 * 60 * 1000);
      await expect(access.hasValidSession(res.header())).resolves.toBe(true);
      await access.touchSession(res);
    }

    // And it still expires once the touching stops.
    vi.advanceTimersByTime((IDLE_MINUTES + 2) * 60 * 1000);
    await expect(access.hasValidSession(res.header())).resolves.toBe(false);
  });
});
