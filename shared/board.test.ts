import { describe, expect, it } from "vitest";
import { applyFilter, countsOf, inFilter, whenLabel } from "./board";
import { stateOf, type Task } from "./tasks";

/**
 * الفلتر والأرقام يُقرآن في نصف ثانية ويُصدَّقان. فلترٌ يعرض الأسبوع الماضي
 * بدل القادم يبدو سليماً تماماً، ورقمٌ خاطئ فوق اللوحة لا يراجعه أحد.
 */

let n = 0;
function task(fields: Partial<Task> = {}): Task {
  n += 1;
  const core = {
    id: `00000000-0000-0000-0000-00000000000${n}`,
    title: `مهمة ${n}`,
    completedSessions: 0,
    createdAt: "2026-09-01T06:00:00.000Z",
    ...fields,
  };
  return { ...core, state: stateOf(core) } as Task;
}

const NOW = new Date(2026, 8, 27, 14, 0);
const local = (d: number, h = 10) => new Date(2026, 8, d, h).toISOString();

describe("الفلاتر", () => {
  const today = task({ scheduledStart: local(27, 16), scheduledEnd: local(27, 17) });
  const late = task({ scheduledStart: local(25), scheduledEnd: local(25, 11) });
  const soon = task({ scheduledStart: local(29), scheduledEnd: local(29, 11) });
  const far = task({ scheduledStart: local(30 + 12), scheduledEnd: local(30 + 12, 11) });
  const unplanned = task();
  const done = task({ scheduledStart: local(26), completedAt: local(26, 12) });
  const all = [today, late, soon, far, unplanned, done];

  it("«اليوم» تشمل المتأخّر — هو شغل اليوم شئنا أم أبينا", () => {
    const list = applyFilter(all, "today", NOW);
    expect(list).toContain(today);
    expect(list).toContain(late);
    expect(list).not.toContain(soon);
  });

  it("«هذا الأسبوع» تسع القادم القريب لا البعيد", () => {
    const list = applyFilter(all, "week", NOW);
    expect(list).toContain(soon);
    expect(list).not.toContain(far);
  });

  it("«قادمة» تبدأ من الغد لا من اليوم", () => {
    const list = applyFilter(all, "upcoming", NOW);
    expect(list).toContain(soon);
    expect(list).not.toContain(today);
    expect(list).not.toContain(late);
  });

  it("«مكتملة» تعرض المنجَز وحده، وبقيّة الفلاتر تُخفيه", () => {
    expect(applyFilter(all, "done", NOW)).toEqual([done]);
    for (const f of ["all", "today", "week", "upcoming"] as const) {
      expect(applyFilter(all, f, NOW)).not.toContain(done);
    }
  });

  it("بلا موعد تظهر في «الكل» وحدها", () => {
    expect(applyFilter(all, "all", NOW)).toContain(unplanned);
    expect(inFilter(unplanned, "today", NOW)).toBe(false);
    expect(inFilter(unplanned, "week", NOW)).toBe(false);
  });
});

describe("أرقام اللوحة", () => {
  it("تُحسب كلٌّ من معناها لا من بعضها", () => {
    const counts = countsOf(
      [
        task(),
        task({ quadrant: "important_urgent" }),
        task({ scheduledStart: local(27, 9), scheduledEnd: local(27, 10) }),
        task({ scheduledStart: local(25), scheduledEnd: local(25, 11) }),
        task({ scheduledStart: local(29), scheduledEnd: local(29, 11) }),
      ],
      [],
      NOW,
    );
    expect(counts.needsTime).toBe(2);
    expect(counts.today).toBe(2);
    expect(counts.week).toBe(3);
    expect(counts.late).toBe(2);
  });

  it("تقرأ أصفاراً بلا انهيار", () => {
    expect(countsOf([], [], NOW)).toEqual({ needsTime: 0, week: 0, today: 0, late: 0 });
  });
});

describe("عرض الوقت", () => {
  it("ساعةً لليوم وتاريخاً لما بعده", () => {
    expect(whenLabel(task({ scheduledStart: local(27, 10) }), NOW)).toBe("10:00 ص");
    expect(whenLabel(task({ scheduledStart: local(27, 13) }), NOW)).toBe("1:00 م");
    expect(whenLabel(task({ scheduledStart: local(28, 9) }), NOW)).toMatch(/28/);
  });

  it("منتصف الليل والظهر لا يُكتبان صفراً", () => {
    expect(whenLabel(task({ scheduledStart: local(27, 0) }), NOW)).toBe("12:00 ص");
    expect(whenLabel(task({ scheduledStart: local(27, 12) }), NOW)).toBe("12:00 م");
  });

  it("بلا موعد يقول ذلك", () => {
    expect(whenLabel(task(), NOW)).toBe("بلا وقت");
  });
});
