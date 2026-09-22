import { describe, expect, it } from "vitest";
import {
  QUADRANTS,
  isOpen,
  nextActionOf,
  quadrantOf,
  splitQuadrant,
  stateOf,
  type Task,
} from "./tasks";

/**
 * نموذج المهمة يحمل قرارين يسهل كسرهما بصمت: الرُّبع مشتقّ من عمودين لا
 * مخزّن ثالثاً، والحالة مقروءة من الحقول لا محفوظة بجانبها. كسر أيّهما لا
 * يُرى في الشاشة — يُرى بعد أسبوع في مهمة مجدولة تدّعي أنها جديدة.
 */

function task(fields: Partial<Task> = {}): Task {
  const core = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "إعداد العرض",
    completedSessions: 0,
    createdAt: "2026-09-22T08:00:00.000Z",
    ...fields,
  };
  return { ...core, state: stateOf(core) } as Task;
}

describe("task model", () => {
  it("round-trips every quadrant through its two columns", () => {
    // الجدول يخزّن importance و urgency؛ الرُّبع يُشتقّ منهما ويعود إليهما.
    for (const q of QUADRANTS) {
      const { importance, urgency } = splitQuadrant(q.id);
      expect(quadrantOf(importance, urgency)).toBe(q.id);
    }
  });

  it("covers all four combinations exactly once", () => {
    const pairs = QUADRANTS.map(q => `${q.importance}/${q.urgency}`);
    expect(new Set(pairs).size).toBe(4);
  });

  it("reads the state from the fields rather than a stored claim", () => {
    expect(task().state).toBe("new");
    expect(task({ quadrant: "important_urgent" }).state).toBe("classified");
    expect(
      task({
        quadrant: "important_urgent",
        scheduledStart: "2026-09-22T10:00:00.000Z",
        scheduledEnd: "2026-09-22T11:30:00.000Z",
      }).state,
    ).toBe("scheduled");
    expect(task({ completedAt: "2026-09-22T12:00:00.000Z" }).state).toBe("completed");
  });

  it("lets a task be scheduled without ever being classified", () => {
    // الرحلة ليست إجبارية: من يريد أن يجدول بلا تصنيف يفعل.
    const t = task({ scheduledStart: "2026-09-22T10:00:00.000Z", scheduledEnd: "2026-09-22T11:00:00.000Z" });
    expect(t.quadrant).toBeUndefined();
    expect(t.state).toBe("scheduled");
  });

  it("treats completion as final, whatever else the task carries", () => {
    const t = task({
      quadrant: "important_urgent",
      scheduledStart: "2026-09-22T10:00:00.000Z",
      scheduledEnd: "2026-09-22T11:00:00.000Z",
      completedAt: "2026-09-22T12:00:00.000Z",
    });
    expect(t.state).toBe("completed");
    expect(isOpen(t)).toBe(false);
  });

  it("asks for the one thing the task is missing, and nothing else", () => {
    expect(nextActionOf(task()).method).toBe("eisenhower");
    expect(nextActionOf(task({ quadrant: "important_not_urgent" })).method).toBe("time-blocking");
    expect(
      nextActionOf(
        task({
          quadrant: "important_not_urgent",
          scheduledStart: "2026-09-22T10:00:00.000Z",
          scheduledEnd: "2026-09-22T11:00:00.000Z",
        }),
      ).method,
    ).toBe("focus");
  });
});
