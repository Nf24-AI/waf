import { describe, expect, it } from "vitest";
import { clock, endTime, nextHalfHour, toDateInput, toTimeInput } from "./clock";

/**
 * حسابات الوقت هنا تُخطئ بصمت: موعد مزاح ساعةً يبدو موعداً صحيحاً، وعدّاد
 * يعرض «‎-1:-1» لا يُرى إلا في الثانية الأخيرة من جلسة. فتُثبَّت الحدود:
 * منتصف الليل، آخر نصف ساعة في اليوم، والصفر والما‑دون.
 */

describe("عرض الوقت", () => {
  it("يصفّر الخانات فتبقى الأرقام بعرض واحد", () => {
    expect(toTimeInput(new Date(2026, 8, 22, 9, 5))).toBe("09:05");
    expect(toTimeInput(new Date(2026, 8, 22, 0, 0))).toBe("00:00");
    expect(toDateInput(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("يعدّ بالدقائق والثواني، ولا ينزل تحت الصفر", () => {
    expect(clock(25 * 60)).toBe("25:00");
    expect(clock(59)).toBe("00:59");
    expect(clock(0)).toBe("00:00");
    // الطرح من موعد ماضٍ يعطي سالباً؛ يُعرض صفراً لا «‎-1:-1».
    expect(clock(-30)).toBe("00:00");
  });
});

describe("البداية المقترحة", () => {
  it("تقفز إلى النصف أو إلى الساعة التالية", () => {
    expect(toTimeInput(nextHalfHour(new Date(2026, 8, 22, 9, 12)))).toBe("09:30");
    expect(toTimeInput(nextHalfHour(new Date(2026, 8, 22, 9, 41)))).toBe("10:00");
  });

  it("تعبر منتصف الليل إلى اليوم التالي", () => {
    const start = nextHalfHour(new Date(2026, 8, 22, 23, 47));
    expect(toDateInput(start)).toBe("2026-09-23");
    expect(toTimeInput(start)).toBe("00:00");
  });
});

describe("وقت الانتهاء", () => {
  it("يضيف المدة ويلتفّ بعد منتصف الليل", () => {
    expect(endTime("2026-09-22", "09:00", 90)).toBe("10:30");
    expect(endTime("2026-09-22", "23:30", 60)).toBe("00:30");
  });

  it("يعود فارغاً على مدخل ناقص أو مشوّه بدل أن يعرض تاريخاً باطلاً", () => {
    expect(endTime("2026-09-22", "", 60)).toBe("");
    expect(endTime("", "09:00", 60)).toBe("");
    expect(endTime("غير تاريخ", "09:00", 60)).toBe("");
  });
});
