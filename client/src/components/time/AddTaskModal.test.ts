import { describe, expect, it } from "vitest";
import { scheduleFrom } from "./AddTaskModal";

/**
 * الموعد المقترح يُبنى من خيار ومدّة. الخطأ فيه لا يُرى في النافذة — يُرى
 * بعد يومين في مهمة حُجزت أمس، أو في موعد ينتهي قبل أن يبدأ.
 */

const NOW = new Date(2026, 8, 22, 16, 30); // الثلاثاء، الرابعة والنصف

describe("الموعد المقترح", () => {
  it("يعود فارغاً حين لا يُختار وقت", () => {
    expect(scheduleFrom("", 60, NOW)).toBeNull();
    expect(scheduleFrom("لا-وجود-له", 60, NOW)).toBeNull();
  });

  it("يضع اليوم على ساعته لا على الساعة الحالية", () => {
    const slot = scheduleFrom("today-09", 60, NOW)!;
    const start = new Date(slot.start);
    expect(start.getDate()).toBe(22);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(0);
  });

  it("يدفع «غداً» يوماً كاملاً", () => {
    const start = new Date(scheduleFrom("tomorrow-09", 60, NOW)!.start);
    expect(start.getDate()).toBe(23);
    expect(start.getHours()).toBe(9);
  });

  it("ينهي الموعد بعد بدايته بالمدّة المختارة", () => {
    for (const minutes of [25, 45, 60, 90]) {
      const slot = scheduleFrom("today-14", minutes, NOW)!;
      const span = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60_000;
      expect(span).toBe(minutes);
    }
  });

  it("يعبر حدّ الشهر في «غداً»", () => {
    const start = new Date(scheduleFrom("tomorrow-09", 60, new Date(2026, 8, 30, 20, 0))!.start);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(1);
  });
});
