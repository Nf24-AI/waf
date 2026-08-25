import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { publicProcedure } from "./_core/trpc";
import { ENV } from "./_core/env";

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
/**
 * The session lasts the browsing session, not a month.
 *
 * A 30-day cookie meant returning to the workspace never asked for the
 * password again, which for a single-password gate on a public URL is the
 * whole protection quietly lapsing. The cookie now carries no expiry, so the
 * browser drops it on close, and the token itself expires after this window
 * as a backstop for a browser left running.
 */
const SESSION_HOURS = 8;

function secret() {
  const value = ENV.cookieSecret || ENV.appPassword;
  if (!value) throw new Error("JWT_SECRET must be set when APP_PASSWORD is used.");
  return new TextEncoder().encode(value);
}

export function accessIsOpen() {
  return !ENV.appPassword;
}

export async function createSessionToken() {
  return new SignJWT({ scope: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
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

/** Use for every procedure that touches meeting data. */
export const appProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (await hasValidSession(ctx.req.headers.cookie)) return next({ ctx });
  throw new TRPCError({ code: "UNAUTHORIZED", message: "This workspace is locked." });
});
