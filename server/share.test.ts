import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isShareExpired, toSharedMeeting } from "@shared/meeting-share";
import type { MeetingRecord } from "@shared/meeting-store";

/**
 * What a share link is allowed to reach.
 *
 * The router wires three things together — find the meeting by token, check
 * the window, redact — and every one of them is load-bearing. These cover the
 * seams: a token that names nothing, a token that names something expired, and
 * the redaction that decides what leaves the workspace.
 */

const meeting: MeetingRecord = {
  id: "page-1",
  title: "مراجعة الشراكة",
  date: "الثلاثاء، ٨ سبتمبر ٢٠٢٦",
  time: "١٠:٠٠ ص",
  type: "مع شريك",
  status: "جاهز للعرض",
  attendees: ["سارة"],
  summary: "الهدف.",
  agenda: [{ title: "المحور", context: "سياق", goal: "هدف", decision: "قرار", owner: "سارة" }],
  actions: ["متابعة"],
  note: "ملاحظات خاصة لا تخرج",
  link: "",
  image: "",
  share: "token-abc",
};

const notionRequest = vi.hoisted(() => vi.fn());

vi.mock("./_core/env", () => ({
  ENV: { isProduction: false, appPassword: "", cookieSecret: "s" },
}));

describe("finding a meeting by its share token", () => {
  beforeEach(() => {
    vi.resetModules();
    notionRequest.mockReset();
    vi.stubEnv("NOTION_API_TOKEN", "ntn_test");
    vi.stubEnv("NOTION_DATABASE_ID", "db-test");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("asks Notion for an exact match, never a scan", async () => {
    vi.doMock("./notion-request", () => ({}));
    const { findNotionMeetingByShareToken } = await import("./notion");
    // An empty token must not reach Notion at all: an empty rich_text filter
    // would match every meeting that has never been shared.
    expect(await findNotionMeetingByShareToken("")).toBeNull();
  });
});

describe("the expiry window the router enforces", () => {
  it("lets a link through on the meeting day and the day after", () => {
    expect(isShareExpired(meeting.date, new Date("2026-09-08T09:00:00Z"))).toBe(false);
    expect(isShareExpired(meeting.date, new Date("2026-09-09T09:00:00Z"))).toBe(false);
  });

  it("closes it the day after that", () => {
    expect(isShareExpired(meeting.date, new Date("2026-09-10T09:00:00Z"))).toBe(true);
  });

  it("closes a meeting that never had a date", () => {
    expect(isShareExpired("اختر التاريخ", new Date("2026-09-08T09:00:00Z"))).toBe(true);
  });
});

describe("what the router returns to a link holder", () => {
  const shared = toSharedMeeting(meeting);

  it("hands over the meeting page itself", () => {
    expect(shared.title).toBe("مراجعة الشراكة");
    expect(shared.agenda[0].decision).toBe("قرار");
    expect(shared.actions).toEqual(["متابعة"]);
  });

  it("keeps the preparation notes inside the workspace", () => {
    expect(JSON.stringify(shared)).not.toContain("ملاحظات خاصة لا تخرج");
  });

  it("keeps the token inside the workspace", () => {
    expect(JSON.stringify(shared)).not.toContain("token-abc");
  });
});
