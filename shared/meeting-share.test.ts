import { describe, expect, it } from "vitest";
import {
  canShare,
  isShareExpired,
  shareExpiresOn,
  shareToday,
  shareUrl,
  toSharedMeeting,
} from "./meeting-share";
import type { MeetingRecord } from "./meeting-store";

const meeting: MeetingRecord = {
  id: "page-1",
  title: "مراجعة الربع الثالث",
  date: "الثلاثاء، ٨ سبتمبر ٢٠٢٦",
  time: "١٠:٠٠ ص",
  type: "مع شريك",
  status: "جاهز للعرض",
  attendees: ["سارة"],
  summary: "الهدف.",
  agenda: [{ title: "المحور", context: "سياق", goal: "هدف", decision: "قرار", owner: "سارة" }],
  actions: ["متابعة"],
  note: "ملاحظاتي التحضيرية الخاصة",
  link: "https://example.com/deck",
  image: "",
  share: "tok_secret",
};

describe("share expiry", () => {
  it("lasts through the day after the meeting", () => {
    expect(shareExpiresOn("الثلاثاء، ٨ سبتمبر ٢٠٢٦")).toBe("2026-09-09");
  });

  it("is still live on the meeting day itself", () => {
    expect(isShareExpired(meeting.date, new Date("2026-09-08T06:00:00Z"))).toBe(false);
  });

  it("is still live on the grace day", () => {
    expect(isShareExpired(meeting.date, new Date("2026-09-09T20:00:00Z"))).toBe(false);
  });

  it("is dead the day after the grace day", () => {
    expect(isShareExpired(meeting.date, new Date("2026-09-10T06:00:00Z"))).toBe(true);
  });

  it("reads the calendar in Riyadh, not UTC", () => {
    // 2026-09-09T21:30Z is already the 10th in Riyadh (UTC+3), so a link that
    // expired on the 9th must be dead — UTC would still call it the 9th.
    expect(shareToday(new Date("2026-09-09T21:30:00Z"))).toBe("2026-09-10");
    expect(isShareExpired("الثلاثاء، ٨ سبتمبر ٢٠٢٦", new Date("2026-09-09T21:30:00Z"))).toBe(true);
  });

  it("crosses a month boundary", () => {
    expect(shareExpiresOn("الاثنين، ٣٠ سبتمبر ٢٠٢٦")).toBe("2026-10-01");
  });

  it("treats an undated meeting as expired, not as forever", () => {
    expect(shareExpiresOn("اختر التاريخ")).toBeNull();
    expect(isShareExpired("اختر التاريخ")).toBe(true);
    expect(canShare({ date: "اختر التاريخ" })).toBe(false);
  });

  it("allows sharing a meeting that has a date", () => {
    expect(canShare(meeting)).toBe(true);
  });
});

describe("what leaves the workspace", () => {
  it("keeps the meeting page a reader is meant to see", () => {
    const shared = toSharedMeeting(meeting);
    expect(shared.title).toBe(meeting.title);
    expect(shared.summary).toBe(meeting.summary);
    expect(shared.attendees).toEqual(meeting.attendees);
    expect(shared.agenda[0].decision).toBe("قرار");
    expect(shared.agenda[0].owner).toBe("سارة");
    expect(shared.actions).toEqual(meeting.actions);
  });

  it("withholds the private preparation notes", () => {
    expect("note" in toSharedMeeting(meeting)).toBe(false);
  });

  it("withholds the token, so a reader cannot re-issue the link", () => {
    expect("share" in toSharedMeeting(meeting)).toBe(false);
  });

  it("leaks nothing beyond the named fields", () => {
    // A field added to MeetingRecord must be named in toSharedMeeting before
    // it can reach a stranger; this is what makes that a build-time promise.
    const extra = { ...meeting, secretInternal: "must not travel" } as MeetingRecord;
    expect(Object.keys(toSharedMeeting(extra))).not.toContain("secretInternal");
  });
});

describe("shareUrl", () => {
  it("builds the address to hand over", () => {
    expect(shareUrl("https://waf.example.com", "abc")).toBe("https://waf.example.com/s/abc");
  });

  it("does not double the slash when the origin has one", () => {
    expect(shareUrl("https://waf.example.com/", "abc")).toBe("https://waf.example.com/s/abc");
  });
});
