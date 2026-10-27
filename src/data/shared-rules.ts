// قواعد تُطبَّق قبل الكتابة في أيّ مصدر بيانات، حتى يتصرّف العرض التجريبي كالحقيقي.

import { findClash } from "@/lib/tasks";
import { ApiError, type Task, type TaskInput, type TaskPatch } from "./types";

export function checkTitle(title: string | undefined) {
  if (title !== undefined && !title.trim()) throw new ApiError("invalid", "المهمة تحتاج عنواناً", "The task needs a title");
}

export function checkSchedule(
  all: Task[],
  origin: Task["origin"],
  input: Pick<TaskInput, "startsAt" | "endsAt">,
  exceptId?: string,
) {
  const { startsAt, endsAt } = input;
  if (!startsAt && !endsAt) return;
  if (!startsAt || !endsAt) throw new ApiError("invalid", "الحجز يحتاج بداية ونهاية", "A booking needs a start and an end");
  if (Date.parse(endsAt) <= Date.parse(startsAt))
    throw new ApiError("invalid", "وقت الانتهاء يجب أن يلي وقت البداية", "The end time must come after the start");
  const clash = findClash(
    all.filter((t) => t.origin === origin),
    startsAt,
    endsAt,
    exceptId,
  );
  if (clash)
    throw new ApiError("conflict", `يوجد تعارض في هذا الوقت مع «${clash.title}»`, `This time clashes with “${clash.title}”`);
}

/** هل يغيّر التعديل الحجز؟ */
export function touchesSchedule(patch: TaskPatch): boolean {
  return "startsAt" in patch || "endsAt" in patch;
}
