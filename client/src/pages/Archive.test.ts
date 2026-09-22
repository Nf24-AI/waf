import { describe, expect, it } from "vitest";
import { groupByDay } from "./Archive";
import { stateOf, type Task } from "@shared/tasks";

/**
 * التجميع يعتمد على أن الخادم يرتّب بـ completed_at تنازلياً. لو انكسر ذلك
 * الترتيب يوماً ظهر اليوم نفسه مرتين في الصفحة — وهو عطل يُرى ولا يُفسَّر.
 * فيُثبَّت هنا: يومان متتاليان يبقيان مجموعتين، والتكرار يُمسَك.
 */

let counter = 0;
function at(completedAt: string): Task {
  counter += 1;
  const core = {
    id: `00000000-0000-0000-0000-00000000000${counter}`,
    title: `مهمة ${counter}`,
    completedSessions: 0,
    createdAt: "2026-09-20T06:00:00.000Z",
    completedAt,
  };
  return { ...core, state: stateOf(core) } as Task;
}

describe("تجميع الأرشيف باليوم", () => {
  it("يجمع مهام اليوم الواحد ويفصل الأيام", () => {
    const days = groupByDay([
      at("2026-09-22T14:00:00.000Z"),
      at("2026-09-22T09:00:00.000Z"),
      at("2026-09-21T16:00:00.000Z"),
    ]);
    expect(days.map(day => day.day)).toEqual(["2026-09-22", "2026-09-21"]);
    expect(days[0].tasks).toHaveLength(2);
    expect(days[1].tasks).toHaveLength(1);
  });

  it("يتجاهل ما لا تاريخ إنجاز له", () => {
    const stray = at("2026-09-22T09:00:00.000Z");
    delete (stray as { completedAt?: string }).completedAt;
    expect(groupByDay([stray])).toEqual([]);
  });

  it("لا يجمع يوماً تكرّر بعد يوم آخر — ترتيب الخادم هو الشرط", () => {
    // لو عاد الترتيب مختلطاً فالنتيجة ثلاث مجموعات لا اثنتان: العطل يُرى
    // في الصفحة بدل أن يُخفيه تجميعٌ يعيد الترتيب من عنده.
    const days = groupByDay([
      at("2026-09-22T14:00:00.000Z"),
      at("2026-09-21T16:00:00.000Z"),
      at("2026-09-22T09:00:00.000Z"),
    ]);
    expect(days).toHaveLength(3);
  });
});
