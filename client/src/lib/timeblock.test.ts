import { describe, expect, it } from "vitest";
import type { Task } from "@shared/tasks";
import {
  blocksOn,
  clashWith,
  dayStats,
  firstFreeSlot,
  firstHour,
  formatDuration,
  formatTime,
  isoAt,
  parseDuration,
  shiftDay,
  sortTasks,
  weekOf,
} from "./timeblock";

const DAY = "2026-10-08"; // خميس

function task(title: string, extra: Partial<Task> = {}): Task {
  return { id: title, title, state: "new", completedSessions: 0, createdAt: "2026-10-01T00:00:00.000Z", ...extra };
}

/** مهمة محجوزة بساعات محلية، كما يكتبها المستخدم. */
function booked(title: string, from: number, to: number, extra: Partial<Task> = {}, day = DAY): Task {
  return task(title, { scheduledStart: isoAt(day, from * 60), scheduledEnd: isoAt(day, to * 60), ...extra });
}

describe("صيغة الوقت والمدّة", () => {
  it("يعرض 12 و24 ساعة", () => {
    expect(formatTime("09:30", 12)).toBe("9:30 ص");
    expect(formatTime("13:05", 12)).toBe("1:05 م");
    expect(formatTime(0, 12)).toBe("12:00 ص");
    expect(formatTime(13 * 60 + 5, 24)).toBe("13:05");
  });

  it("يختصر المدّة", () => {
    expect(formatDuration(45)).toBe("45د");
    expect(formatDuration(120)).toBe("2س");
    expect(formatDuration(80)).toBe("1س 20د");
  });

  it("يفهم المدّة كما تُكتب", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1h 20m")).toBe(80);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("1س 20د")).toBe(80);
    expect(parseDuration("١س ٢٠د")).toBe(80);
    expect(parseDuration("ساعتين")).toBe(120);
    expect(parseDuration("نصف ساعة")).toBe(30);
    expect(parseDuration("لاحقاً")).toBeNaN();
  });
});

describe("الأيام", () => {
  it("يزيح اليوم عبر حدّ الشهر", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("الأسبوع يبدأ الأحد", () => {
    expect(weekOf(DAY)).toEqual([
      "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10",
    ]);
  });
});

describe("حجوزات اليوم", () => {
  it("تُعرض حجوزات اليوم وحده مرتّبة", () => {
    const blocks = blocksOn([booked("ب", 13, 14), booked("أ", 9, 11), booked("غد", 9, 10, {}, "2026-10-09"), task("بلا وقت")], DAY);
    expect(blocks.map(b => b.task.title)).toEqual(["أ", "ب"]);
    expect(blocks[0]).toMatchObject({ start: 540, end: 660, ghost: false });
  });

  it("المتكرّر يُرسم شبحاً في أيامه القادمة لا الماضية", () => {
    const daily = booked("يومي", 13, 14, { repeatRule: "daily" });
    expect(blocksOn([daily], "2026-10-09")[0]).toMatchObject({ ghost: true, start: 780 });
    expect(blocksOn([daily], "2026-10-07")).toEqual([]);
  });

  it("أيام العمل تتخطّى الجمعة والسبت، والمخصّص يتبع أيامه", () => {
    const work = booked("عمل", 9, 10, { repeatRule: "weekdays" });
    expect(blocksOn([work], "2026-10-09")).toEqual([]); // جمعة
    expect(blocksOn([work], "2026-10-11")).toHaveLength(1); // أحد
    const custom = booked("مخصّص", 9, 10, { repeatRule: "custom", repeatDays: [2] });
    expect(blocksOn([custom], "2026-10-13")).toHaveLength(1); // ثلاثاء
    expect(blocksOn([custom], "2026-10-12")).toEqual([]);
  });

  it("يمدّ الجدول إلى ما قبل السادسة إن حُجز فيه", () => {
    expect(firstHour(blocksOn([booked("فجر", 4, 5)], DAY))).toBe(4);
    expect(firstHour([])).toBe(6);
  });
});

describe("الفراغ والتعارض", () => {
  const taken = [
    { start: 540, end: 660 },
    { start: 660, end: 720 },
    { start: 780, end: 840 },
  ];

  it("يجد أول فراغ يسع المدّة", () => {
    expect(firstFreeSlot(taken, 540, 60)).toBe(720);
    expect(firstFreeSlot(taken, 540, 90)).toBe(840);
    expect(firstFreeSlot(taken, 480, 30)).toBe(480);
  });

  it("يقرّب إلى ربع الساعة", () => {
    expect(firstFreeSlot([{ start: 540, end: 575 }], 547, 30)).toBe(585);
  });

  it("يعود null إن لم يسع اليوم", () => {
    expect(firstFreeSlot([{ start: 0, end: 1430 }], 0, 30)).toBeNull();
    expect(firstFreeSlot([], 1420, 60)).toBeNull();
  });

  it("يكشف التداخل ويستثني الحجز نفسه", () => {
    expect(clashWith(taken, 600, 630)).toBe(taken[0]);
    expect(clashWith(taken, 720, 780)).toBeNull();
    expect(clashWith(taken, 540, 660, block => block === taken[0])).toBeNull();
  });
});

describe("أرقام اليوم", () => {
  it("تجمع بحسب الفئة وتحسب نسبة التركيز والحرّ", () => {
    const tasks = [
      booked("عميق", 9, 11, { category: "deep" }),
      booked("اجتماع", 13, 14, { category: "meeting" }),
      booked("مشروع", 14, 15, { category: "project" }),
    ];
    const stats = dayStats(blocksOn(tasks, DAY), t => t.category ?? "other");
    expect(stats).toMatchObject({ planned: 240, focus: 180, meetings: 60, personal: 0, free: 18 * 60 - 240, focusPercent: 75 });
    expect(stats.byCategory.find(c => c.id === "deep")).toEqual({ id: "deep", minutes: 120, percent: 50 });
  });

  it("يوم فارغ بلا قسمة على صفر", () => {
    expect(dayStats([], () => "other")).toMatchObject({ planned: 0, focusPercent: 0, free: 18 * 60 });
  });
});

describe("ترتيب القائمة", () => {
  it("ما ينتظر وقتاً أولاً بالأولوية، ثم المحجوز بموعده", () => {
    const list = [
      booked("محجوز متأخّر", 15, 16),
      task("منخفضة", { priority: "low" }),
      booked("محجوز مبكّر", 9, 10),
      task("عالية", { priority: "high" }),
    ];
    expect(sortTasks(list, t => t.priority ?? "medium").map(t => t.title)).toEqual([
      "عالية", "منخفضة", "محجوز مبكّر", "محجوز متأخّر",
    ]);
  });
});
