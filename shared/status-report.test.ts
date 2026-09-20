import { describe, expect, it } from "vitest";
import { buildStatusReport, lastSevenDays, reportIsEmpty } from "./status-report";
import type { MeetingAgendaItem, MeetingRecord } from "./meeting-store";

const WINDOW = { from: "2026-09-14", to: "2026-09-20" };

function agenda(partial: Partial<MeetingAgendaItem>): MeetingAgendaItem {
  return { title: "", context: "", goal: "", decision: "", owner: "", ...partial };
}

function meeting(partial: Partial<MeetingRecord>): MeetingRecord {
  return {
    id: "m1", title: "اجتماع", date: "2026-09-16", time: "", type: "داخلي",
    status: "تم الاجتماع", attendees: [], summary: "", agenda: [], actions: [],
    note: "", link: "", image: "", ...partial,
  };
}

describe("the window", () => {
  it("covers seven days ending today, today included", () => {
    const window = lastSevenDays(new Date("2026-09-20T13:00:00Z"));
    expect(window).toEqual({ from: "2026-09-14", to: "2026-09-20" });
  });

  it("crosses a month boundary without losing days", () => {
    expect(lastSevenDays(new Date("2026-09-03T00:00:00Z"))).toEqual({
      from: "2026-08-28",
      to: "2026-09-03",
    });
  });
});

describe("what the window holds", () => {
  it("takes a meeting inside it and leaves one before it", () => {
    const report = buildStatusReport(
      [
        meeting({ id: "in", date: "2026-09-16" }),
        meeting({ id: "before", date: "2026-09-01" }),
      ],
      WINDOW,
    );
    expect(report.held.map((m) => m.id)).toEqual(["in"]);
  });

  it("includes both edges of the window", () => {
    const report = buildStatusReport(
      [meeting({ id: "first", date: "2026-09-14" }), meeting({ id: "last", date: "2026-09-20" })],
      WINDOW,
    );
    expect(report.held).toHaveLength(2);
  });

  it("puts the newest meeting first, and the soonest upcoming one first", () => {
    const report = buildStatusReport(
      [
        meeting({ id: "a", date: "2026-09-15" }),
        meeting({ id: "b", date: "2026-09-19" }),
        meeting({ id: "later", date: "2026-10-05", status: "مسودة" }),
        meeting({ id: "sooner", date: "2026-09-25", status: "مسودة" }),
      ],
      WINDOW,
    );
    expect(report.held.map((m) => m.id)).toEqual(["b", "a"]);
    expect(report.upcoming.map((m) => m.id)).toEqual(["sooner", "later"]);
  });

  it("leaves a meeting with an unreadable date out of every window", () => {
    // التقرير يعد بـ«هذه الفترة»؛ ما لا يُعرف زمنه يكسر الوعد لا يُثريه.
    const report = buildStatusReport([meeting({ id: "x", date: "قريباً" })], WINDOW);
    expect(report.held).toEqual([]);
    expect(report.upcoming).toEqual([]);
    expect(report.attention).toEqual([]);
  });

  it("does not call a finished future meeting upcoming", () => {
    const report = buildStatusReport(
      [meeting({ id: "done", date: "2026-10-01", status: "تم الاجتماع" })],
      WINDOW,
    );
    expect(report.upcoming).toEqual([]);
  });
});

describe("decisions and actions in the window", () => {
  it("collects decisions taken inside it only", () => {
    const report = buildStatusReport(
      [
        meeting({ id: "in", date: "2026-09-17", agenda: [agenda({ decision: "قرار داخل" })] }),
        meeting({ id: "out", date: "2026-08-01", agenda: [agenda({ decision: "قرار خارج" })] }),
      ],
      WINDOW,
    );
    expect(report.decisions.map((d) => d.decision)).toEqual(["قرار داخل"]);
  });

  it("carries each action with the meeting it came from", () => {
    const report = buildStatusReport(
      [meeting({ id: "m", title: "مراجعة", actions: ["ترسل العقد", "  ", "تحجز القاعة"] })],
      WINDOW,
    );
    expect(report.actions).toEqual([
      { text: "ترسل العقد", meetingId: "m", meetingTitle: "مراجعة" },
      { text: "تحجز القاعة", meetingId: "m", meetingTitle: "مراجعة" },
    ]);
  });

  it("counts attendees and decisions per meeting", () => {
    const [held] = buildStatusReport(
      [
        meeting({
          attendees: ["نواف", "سارة", "  "],
          agenda: [agenda({ decision: "س" }), agenda({ decision: "" })],
        }),
      ],
      WINDOW,
    ).held;
    expect(held.attendees).toBe(2);
    expect(held.decisions).toBe(1);
  });

  it("lists each person once across the window", () => {
    const report = buildStatusReport(
      [
        meeting({ id: "a", attendees: ["نواف", "سارة"] }),
        meeting({ id: "b", attendees: ["نواف"] }),
      ],
      WINDOW,
    );
    expect(report.people).toHaveLength(2);
    expect(new Set(report.people)).toEqual(new Set(["نواف", "سارة"]));
  });
});

describe("what needs attention", () => {
  it("raises a decision nobody owns, naming its meeting", () => {
    const report = buildStatusReport(
      [
        meeting({
          id: "m", title: "مراجعة التأمين",
          agenda: [agenda({ decision: "نغيّر المزوّد", owner: "" })],
        }),
      ],
      WINDOW,
    );
    const item = report.attention.find((a) => a.kind === "unowned-decision");
    expect(item?.what).toBe("نغيّر المزوّد");
    expect(item?.meetingTitle).toBe("مراجعة التأمين");
  });

  it("says nothing about a decision that has an owner", () => {
    const report = buildStatusReport(
      [meeting({ agenda: [agenda({ decision: "قرار", owner: "نواف" })] })],
      WINDOW,
    );
    expect(report.attention.filter((a) => a.kind === "unowned-decision")).toEqual([]);
  });

  it("raises a meeting that was held and decided nothing", () => {
    const report = buildStatusReport(
      [meeting({ id: "m", title: "وقفة", status: "تم الاجتماع", agenda: [agenda({ title: "بند" })] })],
      WINDOW,
    );
    expect(report.attention.some((a) => a.kind === "met-without-deciding")).toBe(true);
  });

  it("does not raise a meeting that has not happened yet", () => {
    const report = buildStatusReport(
      [meeting({ date: "2026-09-19", status: "جاهز للعرض", agenda: [agenda({ title: "بند" })] })],
      WINDOW,
    );
    expect(report.attention.filter((a) => a.kind === "met-without-deciding")).toEqual([]);
  });

  it("raises a draft whose date has passed, from outside the window", () => {
    const report = buildStatusReport(
      [meeting({ id: "old", title: "منسيّ", date: "2026-07-02", status: "مسودة" })],
      WINDOW,
    );
    const item = report.attention.find((a) => a.kind === "overdue-draft");
    expect(item?.what).toBe("منسيّ");
    expect(report.held).toEqual([]);
  });

  it("does not call a past meeting that actually happened overdue", () => {
    const report = buildStatusReport(
      [meeting({ date: "2026-07-02", status: "تم الاجتماع" })],
      WINDOW,
    );
    expect(report.attention.filter((a) => a.kind === "overdue-draft")).toEqual([]);
  });
});

describe("a quiet window", () => {
  it("reports emptiness as a fact rather than a failure", () => {
    const report = buildStatusReport([], WINDOW);
    expect(reportIsEmpty(report)).toBe(true);
    expect(report.window).toEqual(WINDOW);
  });

  it("is not empty when the only thing in it needs attention", () => {
    const report = buildStatusReport(
      [meeting({ date: "2026-07-02", status: "مسودة" })],
      WINDOW,
    );
    expect(reportIsEmpty(report)).toBe(false);
  });
});
