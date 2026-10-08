import { describe, expect, it } from "vitest";
import {
  DAY_PATTERN,
  QUADRANTS,
  isOpen,
  nextActionOf,
  nextOccurrence,
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

describe("تكرار المهمة", () => {
  it("يزيح الموعد يوماً أو أسبوعاً ويحفظ طوله", () => {
    const daily = nextOccurrence("2026-09-22T09:00:00.000Z", "2026-09-22T10:00:00.000Z", "daily");
    expect(daily.start).toBe("2026-09-23T09:00:00.000Z");
    expect(daily.end).toBe("2026-09-23T10:00:00.000Z");

    const weekly = nextOccurrence("2026-09-22T09:00:00.000Z", "2026-09-22T10:00:00.000Z", "weekly");
    expect(weekly.start).toBe("2026-09-29T09:00:00.000Z");
  });

  it("يعبر حدّ الشهر والسنة", () => {
    expect(nextOccurrence("2026-12-31T22:00:00.000Z", "2026-12-31T23:00:00.000Z", "daily").start).toBe(
      "2027-01-01T22:00:00.000Z",
    );
  });

  it("يبقى الفارق بين البداية والنهاية كما هو", () => {
    const start = "2026-09-22T09:15:00.000Z";
    const end = "2026-09-22T11:45:00.000Z";
    const next = nextOccurrence(start, end, "weekly");
    const before = new Date(end).getTime() - new Date(start).getTime();
    const after = new Date(next.end).getTime() - new Date(next.start).getTime();
    expect(after).toBe(before);
  });
});

describe("نمط اليوم", () => {
  // سقطت الشرطة من النمط مرّة فرُفض كل تاريخ، وفشل إنشاء كل مهمة من الدرج.
  it("يقبل يوماً صحيحاً ويرفض غيره", () => {
    expect(DAY_PATTERN.test("2026-10-08")).toBe(true);
    expect(DAY_PATTERN.test("2026-10-8")).toBe(false);
    expect(DAY_PATTERN.test("dddd-dd-dd")).toBe(false);
    expect(DAY_PATTERN.test("2026-10-08T09:00:00.000Z")).toBe(false);
  });
});

describe("تكرار أيام العمل والمخصّص", () => {
  // 2026-10-08 خميس. 09:00Z = 12:00 في الرياض.
  const start = "2026-10-08T09:00:00.000Z";
  const end = "2026-10-08T10:00:00.000Z";

  it("أيام العمل تقفز من الخميس إلى الأحد", () => {
    expect(nextOccurrence(start, end, "weekdays").start).toBe("2026-10-11T09:00:00.000Z");
    expect(nextOccurrence("2026-10-11T09:00:00.000Z", "2026-10-11T10:00:00.000Z", "weekdays").start).toBe(
      "2026-10-12T09:00:00.000Z",
    );
  });

  it("المخصّص يذهب إلى أقرب يومٍ مختار", () => {
    expect(nextOccurrence(start, end, "custom", [0, 2]).start).toBe("2026-10-11T09:00:00.000Z");
    expect(nextOccurrence(start, end, "custom", [4]).start).toBe("2026-10-15T09:00:00.000Z");
  });

  it("المخصّص بلا أيام يُعامَل أسبوعياً", () => {
    expect(nextOccurrence(start, end, "custom").start).toBe("2026-10-15T09:00:00.000Z");
  });

  it("يوم الأسبوع بتوقيت الرياض لا UTC", () => {
    // 22:00Z الخميس = 01:00 الجمعة في الرياض: ليس يوم عمل، فالتالي الأحد.
    expect(nextOccurrence("2026-10-08T22:00:00.000Z", "2026-10-08T23:00:00.000Z", "weekdays").start).toBe(
      "2026-10-10T22:00:00.000Z",
    );
  });
});
