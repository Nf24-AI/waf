import { describe, expect, it } from "vitest";
import { MEETING_ROUTES } from "../shared/routes";

describe("meeting workspace routes", () => {
  it("keeps preparation and presentation modes on explicit routes", () => {
    expect(MEETING_ROUTES.prepare).toBe("/");
    expect(MEETING_ROUTES.display).toBe("/display");
    expect(MEETING_ROUTES.prepare).not.toBe(MEETING_ROUTES.display);
  });
});
