import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { ACCESS_COOKIE } from "./access";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

function createContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    // Both the legacy Manus cookie and the single-user session cookie are cleared.
    expect(clearedCookies.map((cookie) => cookie.name)).toEqual([COOKIE_NAME, ACCESS_COOKIE]);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
    expect(clearedCookies[1]?.options).toMatchObject({ maxAge: -1, httpOnly: true, path: "/" });
  });
});
