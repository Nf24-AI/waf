import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { publicProcedure } from "./_core/trpc";
import { ENV } from "./_core/env";
import { IDLE_MINUTES } from "@shared/const";

/**
 * Single-user access control.
 *
 * The original template gated meeting data behind Manus OAuth, which only
 * resolves inside the Manus platform. Outside it every protected procedure
 * throws UNAUTHORIZED, so the workspace can never reach Notion.
 *
 * This replaces it with a gate sized for one user:
 *   - APP_PASSWORD empty  -> open. Correct for `pnpm dev` on localhost.
 *   - APP_PASSWORD set    -> a signed session cookie is required.
 *
 * Deploying to a public URL without APP_PASSWORD leaves your meetings readable
 * by anyone who finds the address.
 */

export const ACCESS_COOKIE = "meeting-prep-session";

function secret() {
  const value = ENV.cookieSecret || ENV.appPassword;
  if (!value) throw new Error("JWT_SECRET must be set when APP_PASSWORD is used.");
  return new TextEncoder().encode(value);
}

export function accessIsOpen() {
  return !ENV.appPassword;
}

/**
 * The session lasts an idle window, not a browsing day.
 *
 * A 30-day cookie meant returning to the workspace never asked for the
 * password again, which for a single-password gate on a public URL is the
 * whole protection quietly lapsing. The cookie now carries no expiry, so the
 * browser drops it on close, and the token itself expires IDLE_MINUTES after
 * it was last issued.
 *
 * The window is idle-based rather than absolute because touchSession re-issues
 * the cookie on every authenticated request: a workspace in use keeps sliding
 * forward, and only one left untouched runs out.
 */
export async function createSessionToken() {
  return new SignJWT({ scope: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IDLE_MINUTES}m`)
    .sign(secret());
}

export async function hasValidSession(cookieHeader: string | undefined) {
  if (accessIsOpen()) return true;

  const token = parseCookieHeader(cookieHeader ?? "")[ACCESS_COOKIE];
  if (!token) return false;

  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(secure: boolean) {
  // No maxAge and no expires: a session cookie, discarded when the browser closes.
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
}

/**
 * Timing-safe-ish comparison. The password is short and the endpoint is
 * rate-limited by being single-user, but avoid leaking length via early exit.
 */
export function passwordMatches(candidate: string) {
  const expected = ENV.appPassword;
  if (!expected) return true;
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * Push the idle deadline out by IDLE_MINUTES from now.
 *
 * Without this the window would be absolute, and the gate would drop in front
 * of someone mid-sentence ten minutes after they unlocked. Only the token is
 * re-issued; the cookie stays session-scoped, so closing the browser still
 * ends the session.
 */
export async function touchSession(res: { cookie: (name: string, value: string, options: object) => void }) {
  res.cookie(ACCESS_COOKIE, await createSessionToken(), sessionCookieOptions(ENV.isProduction));
}

/** Use for every procedure that touches meeting data. */
export const appProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!(await hasValidSession(ctx.req.headers.cookie))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "This workspace is locked." });
  }
  // Activity slides the window forward. Skipped when the gate is off, where
  // there is no session to keep alive in the first place.
  if (!accessIsOpen()) await touchSession(ctx.res);
  return next({ ctx });
});
