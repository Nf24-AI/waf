import { describe, expect, it } from "vitest";
import {
  LANDING_ROUTE,
  LEGACY_LANDING_ROUTE,
  MEETING_PARAM,
  MEETING_ROUTES,
  PLATFORM_ROUTE,
  meetingHref,
} from "../shared/routes";

describe("meeting workspace routes", () => {
  it("keeps preparation and presentation modes on explicit routes", () => {
    expect(MEETING_ROUTES.prepare).toBe("/meetings");
    expect(MEETING_ROUTES.display).toBe("/display");
    expect(MEETING_ROUTES.prepare).not.toBe(MEETING_ROUTES.display);
  });

  it("leaves the root to the public face, and gives the platform its own path", () => {
    // الجذر لمن لم يدخل بعد؛ والمنصّة خلف البوّابة على مسارها.
    expect(LANDING_ROUTE).toBe("/");
    expect(PLATFORM_ROUTE).not.toBe("/");
    expect(MEETING_ROUTES.prepare).not.toBe(PLATFORM_ROUTE);
    expect(MEETING_ROUTES.display).not.toBe(PLATFORM_ROUTE);
  });

  it("keeps the old public address working, so a shared link does not break", () => {
    expect(LEGACY_LANDING_ROUTE).toBe("/welcome");
    expect(LEGACY_LANDING_ROUTE).not.toBe(LANDING_ROUTE);
  });
});

describe("linking to one meeting", () => {
  it("carries the meeting id, so a decision leads to the meeting it was taken in", () => {
    expect(meetingHref("abc123")).toBe(`${MEETING_ROUTES.prepare}?${MEETING_PARAM}=abc123`);
  });

  it("escapes an id rather than letting it break the query", () => {
    expect(meetingHref("a b&c=d")).toBe(`${MEETING_ROUTES.prepare}?${MEETING_PARAM}=a%20b%26c%3Dd`);
  });

  it("falls back to the plain route when there is no id to open", () => {
    expect(meetingHref()).toBe(MEETING_ROUTES.prepare);
    expect(meetingHref("")).toBe(MEETING_ROUTES.prepare);
    expect(meetingHref("   ")).toBe(MEETING_ROUTES.prepare);
  });
});
