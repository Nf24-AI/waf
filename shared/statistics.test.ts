import { describe, expect, it } from "vitest";
import { formatMinutes, sessionMinutes, summarize } from "./statistics";
import { stateOf, type Quadrant, type Task } from "./tasks";

/**
 * الإحصاء يُقرأ ولا يُراجَع: لا أحد يعدّ مهامه بيده ليكتشف أن الرقم كاذب.
 * فتُثبَّت هنا الحالات التي تُفسده بصمت — جلسة لم تُغلق، تبويب تُرك مفتوحاً
 * ليلة كاملة، ومنجَز بلا تصنيف يُسقط من التوزيع فلا يُجمع الجزء إلى الكلّ.
 */

let counter = 0;
function done(quadrant?: Quadrant): Task {
  counter += 1;
  const core = {
    id: `00000000-0000-0000-0000-00000000000${counter}`,
    title: "مهمة",
    quadrant,
    completedSessions: 0,
    createdAt: "2026-09-20T06:00:00.000Z",
    completedAt: "2026-09-22T06:00:00.000Z",
  };
  return { ...core, state: stateOf(core) } as Task;
}

describe("دقائق الجلسة", () => {
  it("تُقاس من الساعة لا من المدة المخطّطة", () => {
    expect(
      sessionMinutes({
        startedAt: "2026-09-22T09:00:00.000Z",
        endedAt: "2026-09-22T09:10:00.000Z",
        plannedMinutes: 50,
        completed: false,
      }),
    ).toBe(10);
  });

  it("تُسقَف بما خُطِّط: تبويب مفتوح ليلةً ليس ليلة تركيز", () => {
    expect(
      sessionMinutes({
        startedAt: "2026-09-22T09:00:00.000Z",
        endedAt: "2026-09-23T09:00:00.000Z",
        plannedMinutes: 25,
        completed: true,
      }),
    ).toBe(25);
  });

  it("تُهمل الجلسة التي لم تُغلق", () => {
    expect(
      sessionMinutes({ startedAt: "2026-09-22T09:00:00.000Z", plannedMinutes: 25, completed: false }),
    ).toBe(0);
  });
});

describe("ملخّص المدة", () => {
  it("يعدّ الجلسات المكتملة وحدها، ويجمع وقت كل ما بُدئ", () => {
    const stats = summarize(
      [],
      [
        { startedAt: "2026-09-22T09:00:00.000Z", endedAt: "2026-09-22T09:25:00.000Z", plannedMinutes: 25, completed: true },
        { startedAt: "2026-09-22T10:00:00.000Z", endedAt: "2026-09-22T10:05:00.000Z", plannedMinutes: 25, completed: false },
      ],
    );
    expect(stats.focusSessions).toBe(1);
    // القُطعت لا تُعدّ جلسة، لكن دقائقها قُضيت فعلاً فتُحسب.
    expect(stats.focusMinutes).toBe(30);
  });

  it("يعرض الأرباع الأربعة كلها ولو كان بعضها صفراً", () => {
    const stats = summarize([done("important_not_urgent")], []);
    expect(stats.byQuadrant).toHaveLength(4);
    expect(stats.byQuadrant.find(row => row.quadrant === "important_not_urgent")?.count).toBe(1);
    expect(stats.byQuadrant.find(row => row.quadrant === "important_urgent")?.count).toBe(0);
  });

  it("يفصل المنجَز بلا تصنيف فيُجمع الجزء إلى الكلّ", () => {
    const stats = summarize([done("important_urgent"), done(), done()], []);
    expect(stats.completedTasks).toBe(3);
    expect(stats.unclassified).toBe(2);
    expect(stats.byQuadrant.reduce((sum, row) => sum + row.count, 0) + stats.unclassified).toBe(3);
  });
});

describe("صياغة المدة", () => {
  it("تبقى بالدقائق دون الساعة", () => {
    expect(formatMinutes(0)).toBe("0 دقيقة");
    expect(formatMinutes(59)).toBe("59 دقيقة");
  });

  it("تصرّف الساعة كما تُصرَّف في العربية", () => {
    expect(formatMinutes(60)).toBe("ساعة");
    expect(formatMinutes(120)).toBe("ساعتان");
    expect(formatMinutes(180)).toBe("3 ساعات");
    expect(formatMinutes(660)).toBe("11 ساعة");
    expect(formatMinutes(135)).toBe("ساعتان و15 دقيقة");
  });
});
