import { describe, expect, it } from "vitest";
import { longDate, monthLabel, weekAround } from "./calendar";

/**
 * الرزنامة تُخطئ بلا صوت: يومٌ مزاح يبدو يوماً سليماً، ولا يُكتشف إلا حين
 * يُحجز موعد في الخطأ. فتُثبَّت الحدود — بداية الأسبوع، وحافّة الشهر،
 * وحافّة السنة.
 */

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m, d, h);

describe("أسبوع حول اليوم", () => {
  it("يبدأ من السبت دائماً", () => {
    // ٢٧ سبتمبر ٢٠٢٦ أحد؛ فالسبت قبله هو ٢٦.
    const week = weekAround(at(2026, 8, 27));
    expect(week).toHaveLength(7);
    expect(week[0].day).toBe(26);
    expect(week[6].day).toBe(2);
  });

  it("يضع اليوم في موضعه لا في أوّل الصفّ", () => {
    const week = weekAround(at(2026, 8, 27));
    const today = week.findIndex(d => d.isToday);
    expect(today).toBe(1);
    expect(week[today].day).toBe(27);
    expect(week.filter(d => d.isToday)).toHaveLength(1);
  });

  it("يبدأ من نفسه حين يكون اليوم سبتاً", () => {
    const week = weekAround(at(2026, 8, 26));
    expect(week[0].isToday).toBe(true);
    expect(week[0].day).toBe(26);
  });

  it("يميّز أيام الشهر المجاور فلا تُقرأ كأيام هذا الشهر", () => {
    const week = weekAround(at(2026, 8, 27));
    // الأوّل والثاني من أكتوبر يقعان في آخر الصفّ.
    expect(week[5].inMonth).toBe(false);
    expect(week[6].inMonth).toBe(false);
    expect(week[1].inMonth).toBe(true);
  });

  it("يعبر حافّة السنة", () => {
    const week = weekAround(at(2026, 11, 31));
    expect(week.map(d => d.day)).toContain(1);
    expect(week.some(d => d.key.startsWith("2027-01"))).toBe(true);
  });

  it("يبدأ كل يوم من منتصف الليل فلا تتسرّب ساعة الآن", () => {
    for (const d of weekAround(at(2026, 8, 27, 23))) {
      expect(d.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("النصوص", () => {
  it("يسمّي الشهر والسنة", () => {
    expect(monthLabel(2026, 8)).toBe("سبتمبر 2026");
    expect(monthLabel(2027, 0)).toBe("يناير 2027");
  });

  it("يكتب التاريخ الطويل بيومه الصحيح", () => {
    expect(longDate(at(2026, 8, 27))).toBe("الأحد، 27 سبتمبر 2026");
    expect(longDate(at(2026, 8, 26))).toBe("السبت، 26 سبتمبر 2026");
  });
});
