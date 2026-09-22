import { describe, expect, it } from "vitest";
import { dueNow } from "./ScheduleReminder";
import { stateOf, type Task } from "@shared/tasks";

/**
 * التنبيه يُخطئ في اتجاهين، وكلاهما يُفقده معناه: أن يسكت عن موعد حلّ، أو
 * أن ينبّه على موعد مضى أو لم يأتِ بعد. فتُثبَّت حدود النافذة: لحظة البداية
 * داخلها ولحظة النهاية خارجها.
 */

let counter = 0;
function task(fields: Partial<Task> = {}): Task {
  counter += 1;
  const core = {
    id: `00000000-0000-0000-0000-00000000000${counter}`,
    title: "إعداد العرض",
    completedSessions: 0,
    createdAt: "2026-09-22T06:00:00.000Z",
    ...fields,
  };
  return { ...core, state: stateOf(core) } as Task;
}

const at = (iso: string) => new Date(iso).getTime();

describe("المهمة التي حلّ وقتها", () => {
  const scheduled = task({
    scheduledStart: "2026-09-22T09:00:00.000Z",
    scheduledEnd: "2026-09-22T10:00:00.000Z",
  });

  it("تُنبَّه من لحظة البداية وحتى ما قبل النهاية", () => {
    expect(dueNow([scheduled], at("2026-09-22T09:00:00.000Z"))?.id).toBe(scheduled.id);
    expect(dueNow([scheduled], at("2026-09-22T09:59:59.000Z"))?.id).toBe(scheduled.id);
  });

  it("تسكت قبل الموعد وبعد انقضائه", () => {
    expect(dueNow([scheduled], at("2026-09-22T08:59:59.000Z"))).toBeNull();
    // لحظة النهاية خارج النافذة: الموعد انتهى، والتنبيه عليه تأنيب لا تذكير.
    expect(dueNow([scheduled], at("2026-09-22T10:00:00.000Z"))).toBeNull();
  });

  it("تتجاهل غير المجدولة والمنجَزة", () => {
    expect(dueNow([task()], at("2026-09-22T09:30:00.000Z"))).toBeNull();
    const finished = task({
      scheduledStart: "2026-09-22T09:00:00.000Z",
      scheduledEnd: "2026-09-22T10:00:00.000Z",
      completedAt: "2026-09-22T09:20:00.000Z",
    });
    expect(dueNow([finished], at("2026-09-22T09:30:00.000Z"))).toBeNull();
  });

  it("تختار الأسبق حين يتداخل موعدان", () => {
    const later = task({
      scheduledStart: "2026-09-22T09:30:00.000Z",
      scheduledEnd: "2026-09-22T10:30:00.000Z",
    });
    const both = [later, scheduled];
    expect(dueNow(both, at("2026-09-22T09:40:00.000Z"))?.id).toBe(scheduled.id);
  });
});
