import { describe, expect, it } from "vitest";
import type { Task } from "@/data/types";
import { at } from "@/lib/time";
import { checkDraft, durationFields, endMinute, endText, type Draft } from "./draft";
import {
  blocksOn,
  busyDays,
  categoryMinutes,
  dayStats,
  defaultFrom,
  isoAt,
  layoutLanes,
  rangeStart,
  resolvePlacement,
  sortTasks,
  unionLength,
  weekOf,
  yToMinute,
} from "./schedule";

const DAY = "2026-10-27"; // الثلاثاء

const task = (p: Partial<Task>): Task => ({
  id: crypto.randomUUID(),
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
  createdAt: "2026-10-27T05:00:00.000Z",
  focusSessions: 0,
  ...p,
});

const booked = (s: string, e: string, p: Partial<Task> = {}) => task({ startsAt: at(DAY, s), endsAt: at(DAY, e), ...p });

describe("blocksOn", () => {
  it("returns the day's blocks in minutes, clipped at midnight", () => {
    const late = booked("23:45", "23:59", { id: "late" });
    late.endsAt = isoAt(DAY, 24 * 60 + 30);
    const bs = blocksOn([booked("09:00", "10:00", { id: "a" }), late, task({ id: "loose" })], DAY);
    expect(bs.map((b) => [b.key, b.start, b.end])).toEqual([
      ["a", 540, 600],
      ["late", 1425, 1440],
    ]);
  });

  it("projects repeating tasks onto later days as ghosts", () => {
    const lunch = booked("12:30", "13:15", { id: "lunch", repeatRule: "daily" });
    const next = blocksOn([lunch], "2026-10-28");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ key: "ghost:lunch", ghost: true, start: 750, end: 795 });
  });

  it("marks finished blocks as done", () => {
    const bs = blocksOn([booked("08:00", "09:00", { completedAt: "2026-10-27T07:00:00.000Z" })], DAY);
    expect(bs[0].done).toBe(true);
  });
});

describe("geometry", () => {
  it("starts at 06:00 or the earliest block's hour", () => {
    expect(rangeStart([])).toBe(360);
    expect(rangeStart([{ start: 330 }])).toBe(300);
    expect(rangeStart([{ start: 600 }])).toBe(360);
  });

  it("snaps y to quarter hours", () => {
    // ٦٤ بكسل للساعة: ٣٢ = نصف ساعة
    expect(yToMinute(32, 360)).toBe(390);
    expect(yToMinute(36, 360)).toBe(390);
    expect(yToMinute(-500, 360)).toBe(0);
    expect(yToMinute(99999, 360)).toBe(1440);
  });

  it("lays overlapping blocks side by side", () => {
    const l = layoutLanes([
      { key: "a", start: 540, end: 600 },
      { key: "b", start: 570, end: 630 },
      { key: "c", start: 600, end: 660 },
      { key: "d", start: 700, end: 760 },
    ]);
    expect(l.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(l.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(l.get("c")).toEqual({ lane: 0, lanes: 2 });
    expect(l.get("d")).toEqual({ lane: 0, lanes: 1 });
  });
});

describe("resolvePlacement", () => {
  const tasks = [booked("09:00", "10:00", { id: "a" }), booked("10:00", "11:00", { id: "b" })];

  it("keeps a free slot", () => {
    expect(resolvePlacement(tasks, DAY, 8 * 60, 60)).toEqual({ start: 480, moved: false });
  });

  it("moves to the first free slot after a clash", () => {
    expect(resolvePlacement(tasks, DAY, 9 * 60 + 30, 30)).toEqual({ start: 660, moved: true });
  });

  it("ignores the moving task itself", () => {
    expect(resolvePlacement(tasks, DAY, 9 * 60, 45, "a")).toEqual({ start: 540, moved: false });
  });

  it("returns null when nothing fits before midnight", () => {
    expect(resolvePlacement(tasks, DAY, 23 * 60 + 45, 30)).toBeNull();
  });

  it("allows a block that ends exactly at midnight", () => {
    expect(resolvePlacement(tasks, DAY, 23 * 60 + 45, 15)).toEqual({ start: 1425, moved: false });
  });
});

describe("stats", () => {
  it("counts overlap once and splits focus time", () => {
    const bs = blocksOn(
      [booked("09:00", "10:00", { category: "deep" }), booked("09:30", "10:30", { category: "meeting" }), booked("15:00", "16:00", { category: "project" })],
      DAY,
    );
    expect(dayStats(bs)).toEqual({ booked: 150, focus: 120, free: 1080 - 150 });
    expect(categoryMinutes(bs)).toMatchObject({ deep: 60, meeting: 60, project: 60, personal: 0 });
  });

  it("free time only counts 06:00–24:00", () => {
    const bs = blocksOn([booked("05:00", "07:00")], DAY);
    expect(dayStats(bs).free).toBe(1080 - 60);
    expect(unionLength([])).toBe(0);
  });
});

describe("lists and calendar", () => {
  it("sorts unscheduled by priority, then scheduled by time, then done", () => {
    const list = sortTasks([
      booked("15:00", "16:00", { id: "late" }),
      task({ id: "low", priority: "low" }),
      booked("09:00", "10:00", { id: "early" }),
      task({ id: "done", completedAt: "2026-10-27T06:00:00.000Z" }),
      task({ id: "high", priority: "high" }),
    ]);
    expect(list.map((t) => t.id)).toEqual(["high", "low", "early", "late", "done"]);
  });

  it("ranks by quadrant inside the Waf system", () => {
    const list = sortTasks([task({ id: "plan", quadrant: "plan", priority: "high" }), task({ id: "do", quadrant: "do", priority: "low" })], { byQuadrant: true });
    expect(list.map((t) => t.id)).toEqual(["do", "plan"]);
  });

  it("weeks start on Sunday", () => {
    expect(weekOf(DAY)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });

  it("marks busy days including repeats", () => {
    const busy = busyDays([booked("12:00", "13:00", { repeatRule: "weekdays" })], weekOf(DAY));
    expect([...busy]).toEqual(["2026-10-27", "2026-10-28", "2026-10-29"]);
  });

  it("default search starts at the next quarter today, 09:00 otherwise", () => {
    expect(defaultFrom(DAY, DAY, new Date(2026, 9, 27, 14, 7))).toBe(14 * 60 + 15);
    expect(defaultFrom("2026-10-28", DAY, new Date(2026, 9, 27, 14, 7))).toBe(540);
  });
});

describe("draft", () => {
  const base: Draft = {
    title: "كتابة",
    timed: true,
    day: DAY,
    start: "09:00",
    end: "10:00",
    duration: 60,
    customText: "",
    repeat: null,
    repeatDays: [],
    category: "deep",
    priority: "medium",
  };

  it("passes a valid booking", () => {
    const c = checkDraft(base, []);
    expect(c.errors).toEqual({});
    expect(c.length).toBe(60);
  });

  it("requires a title, a valid custom duration and repeat days", () => {
    const c = checkDraft({ ...base, title: "  ", timed: false, duration: "custom", customText: "غداً", repeat: "custom" }, []);
    expect(c.errors).toEqual({ title: true, duration: true, days: true });
  });

  it("reads Arabic custom durations", () => {
    expect(checkDraft({ ...base, timed: false, duration: "custom", customText: "ساعة ونصف" }, []).length).toBe(90);
  });

  it("needs the end at least 5 minutes after the start", () => {
    expect(checkDraft({ ...base, end: "09:03" }, []).errors.end).toBe(true);
    expect(checkDraft({ ...base, end: "08:00" }, []).errors.end).toBe(true);
  });

  it("treats 00:00 as midnight at the end of the day", () => {
    expect(endMinute("00:00")).toBe(1440);
    expect(endText(1440)).toBe("00:00");
    const c = checkDraft({ ...base, start: "23:45", end: "00:00" }, []);
    expect(c.errors).toEqual({});
    expect(c.length).toBe(15);
  });

  it("reports the clashing task, ignoring itself", () => {
    const other = booked("09:30", "10:30", { id: "other", title: "اجتماع" });
    expect(checkDraft(base, [other]).clash?.title).toBe("اجتماع");
    expect(checkDraft(base, [other], "other").clash).toBeNull();
  });

  it("maps a length to a chip or a custom text", () => {
    expect(durationFields(45, String)).toEqual({ duration: 45, customText: "" });
    expect(durationFields(50, (m) => `${m}m`)).toEqual({ duration: "custom", customText: "50m" });
  });
});
