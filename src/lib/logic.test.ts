import { describe, expect, it } from "vitest";
import type { Meeting, Task } from "@/data/types";
import { createMemoryApi } from "@/data/memory-api";
import { buildStatusReport, decisionsOf, prepareSteps, readiness, shareExpired, splitAttendees } from "./meetings";
import { findClash, firstFreeSlot, ghostsOn, nextOccurrence } from "./tasks";
import { addDays, at, dayOf, isDay, parseDay, parseDuration } from "./time";

const task = (t: Partial<Task>): Task => ({
  id: Math.random().toString(36),
  title: "مهمة",
  notes: "",
  origin: "blocks",
  quadrant: null,
  startsAt: null,
  endsAt: null,
  estimateMinutes: null,
  category: "deep",
  priority: "medium",
  repeatRule: null,
  repeatDays: [],
  sourceMeetingId: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
  focusSessions: 0,
  ...t,
});

const meeting = (m: Partial<Meeting>): Meeting => ({
  id: Math.random().toString(36),
  title: "اجتماع",
  day: null,
  startTime: null,
  endTime: null,
  kind: "internal",
  status: "draft",
  attendees: [],
  goal: "",
  note: "",
  link: "",
  image: "",
  shareToken: null,
  agenda: [],
  followups: [],
  updatedAt: "",
  ...m,
});

describe("time", () => {
  it("reads free-form durations in Arabic and English", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1h 20m")).toBe(80);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("١س ٢٠د")).toBe(80);
    expect(parseDuration("ساعتين")).toBe(120);
    expect(parseDuration("ساعة ونصف")).toBe(90);
    expect(parseDuration("نصف ساعة")).toBe(30);
    expect(parseDuration("3")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  it("validates and shifts days", () => {
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-10-27")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("tasks", () => {
  const day = "2026-10-27";
  const busy = [task({ startsAt: at(day, "09:00"), endsAt: at(day, "10:00"), title: "أ" }), task({ startsAt: at(day, "10:30"), endsAt: at(day, "11:00") })];

  it("finds clashes on overlap only", () => {
    expect(findClash(busy, at(day, "09:30"), at(day, "09:45"))?.title).toBe("أ");
    expect(findClash(busy, at(day, "10:00"), at(day, "10:30"))).toBeNull();
    expect(findClash([{ ...busy[0], completedAt: "x" }], at(day, "09:30"), at(day, "09:45"))).toBeNull();
  });

  it("finds the first free quarter-hour slot", () => {
    expect(firstFreeSlot(busy, parseDay(day), 9 * 60, 30)).toBe(10 * 60);
    expect(firstFreeSlot(busy, parseDay(day), 9 * 60, 45)).toBe(11 * 60);
    expect(firstFreeSlot(busy, parseDay(day), 23 * 60 + 40, 30)).toBeNull();
  });

  it("moves weekday repeats over the weekend", () => {
    // 2026-10-29 is a Thursday → next workday is Sunday
    const t = task({ repeatRule: "weekdays", startsAt: at("2026-10-29", "08:00"), endsAt: at("2026-10-29", "09:00") });
    expect(dayOf(new Date(nextOccurrence(t)!.startsAt))).toBe("2026-11-01");
  });

  it("projects ghosts of repeating tasks onto later days", () => {
    const t = task({ repeatRule: "daily", startsAt: at(day, "08:00"), endsAt: at(day, "09:00") });
    expect(ghostsOn([t], parseDay(addDays(day, 3)))).toHaveLength(1);
    expect(ghostsOn([t], parseDay(day))).toHaveLength(0);
  });
});

describe("meetings", () => {
  it("computes readiness and the next preparation step", () => {
    const m = meeting({ title: "مراجعة", day: "2026-10-27", startTime: "10:00", goal: "نتفق على النطاق والموعد", attendees: ["سارة"] });
    expect(readiness(m)).toBe(80);
    const steps = prepareSteps(m);
    expect(steps.find((s) => !s.done)?.id).toBe("agenda");
  });

  it("splits attendees on Arabic and Latin commas", () => {
    expect(splitAttendees("سارة، خالد ,ريم\n")).toEqual(["سارة", "خالد", "ريم"]);
  });

  it("expires share links the day after the meeting, Riyadh time", () => {
    expect(shareExpired(null)).toBe(true);
    expect(shareExpired("2026-10-27", new Date("2026-10-28T20:00:00Z"))).toBe(false); // 23:00 Riyadh
    expect(shareExpired("2026-10-27", new Date("2026-10-28T21:30:00Z"))).toBe(true); // 00:30 Riyadh on the 29th
  });

  it("builds the decision log and the weekly report", () => {
    const a = meeting({
      day: "2026-10-26",
      status: "done",
      agenda: [
        { id: "1", title: "ن", context: "", goal: "", decision: "نعم", owner: "", covered: true },
        { id: "2", title: "م", context: "", goal: "", decision: "", owner: "", covered: false },
      ],
      followups: [{ id: "f", text: "أرسل المحضر", done: false }],
      attendees: ["سارة"],
    });
    const b = meeting({ day: "2026-10-27", status: "done" });
    const c = meeting({ day: "2026-10-10", status: "draft" });
    const d = meeting({ day: "2026-11-05", status: "ready" });
    expect(decisionsOf([a, b])).toHaveLength(1);
    const r = buildStatusReport([a, b, c, d], "2026-10-25", "2026-10-31");
    expect(r.held).toHaveLength(2);
    expect(r.decided).toHaveLength(1);
    expect(r.tasks).toHaveLength(1);
    expect(r.upcoming).toHaveLength(1);
    expect(r.attention.map((x) => x.kind).sort()).toEqual(["met-without-deciding", "overdue-draft", "unowned-decision"]);
  });
});

describe("memory api", () => {
  it("applies the same rules as the real source", async () => {
    const api = createMemoryApi({ persist: false, initial: { meetings: [], tasks: [], sessions: [] } });
    const today = dayOf();
    await api.tasks.create({ title: "أ", origin: "blocks", startsAt: at(today, "09:00"), endsAt: at(today, "10:00") });
    await expect(api.tasks.create({ title: "ب", origin: "blocks", startsAt: at(today, "09:30"), endsAt: at(today, "10:30") })).rejects.toMatchObject({ code: "conflict" });
    // the same hour in another framework is fine: frameworks don't share tasks
    await expect(api.tasks.create({ title: "ب", origin: "waf", startsAt: at(today, "09:30"), endsAt: at(today, "10:30") })).resolves.toBeTruthy();
    await expect(api.tasks.create({ title: "  ", origin: "matrix" })).rejects.toMatchObject({ code: "invalid" });

    const rep = await api.tasks.create({ title: "يومي", origin: "blocks", repeatRule: "daily", startsAt: at(today, "12:00"), endsAt: at(today, "12:30") });
    const { next } = await api.tasks.complete(rep.id);
    expect(next && dayOf(new Date(next.startsAt!))).toBe(addDays(today, 1));

    const m = await api.meetings.create({ title: "س" });
    await expect(api.meetings.share(m.id)).rejects.toMatchObject({ code: "invalid" });
    await api.meetings.update(m.id, { day: today, note: "سرّي" });
    const token = await api.meetings.share(m.id);
    const shared = await api.meetings.shared(token);
    expect("note" in shared).toBe(false);
    await expect(api.meetings.shared("nope")).rejects.toMatchObject({ code: "not_found" });
  });
});
