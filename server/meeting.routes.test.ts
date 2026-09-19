import { describe, expect, it } from "vitest";
import { MEETING_ROUTES, PLATFORM_ROUTE } from "../shared/routes";

describe("meeting workspace routes", () => {
  it("keeps preparation and presentation modes on explicit routes", () => {
    expect(MEETING_ROUTES.prepare).toBe("/meetings");
    expect(MEETING_ROUTES.display).toBe("/display");
    expect(MEETING_ROUTES.prepare).not.toBe(MEETING_ROUTES.display);
  });

  it("leaves the root to the platform, not to a single service", () => {
    expect(PLATFORM_ROUTE).toBe("/");
    expect(MEETING_ROUTES.prepare).not.toBe(PLATFORM_ROUTE);
    expect(MEETING_ROUTES.display).not.toBe(PLATFORM_ROUTE);
  });
});
