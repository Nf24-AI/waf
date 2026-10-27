// مسودة المهمة في نافذة الإضافة وتعديل الحجز: المدة، والتحقّق، والتعارض.
// الأخطاء رموز، والنص يُكتب في الواجهة بلغتها.

import type { Category, Priority, RepeatRule, Task } from "@/data/types";
import { findClash } from "@/lib/tasks";
import { fromMinutes, isTime, parseDuration, toMinutes } from "@/lib/time";
import { DAY_TO, isoAt } from "./schedule";

export const DURATIONS = [30, 45, 60, 90, 120] as const;

export interface Draft {
  title: string;
  timed: boolean;
  day: string;
  start: string;
  end: string;
  /** مدة من الأزرار، أو "custom" للنص الحرّ */
  duration: number | "custom";
  customText: string;
  repeat: RepeatRule | null;
  repeatDays: number[];
  category: Category;
  priority: Priority;
}

export type DraftError = "title" | "duration" | "start" | "end" | "days" | "clash";

/** "00:00" في خانة النهاية يعني منتصف الليل في آخر اليوم */
export function endMinute(hhmm: string): number {
  const m = toMinutes(hhmm);
  return m === 0 ? DAY_TO : m;
}

export function endText(minute: number): string {
  return minute >= DAY_TO ? "00:00" : fromMinutes(minute);
}

export function draftLength(d: Pick<Draft, "duration" | "customText">): number | null {
  return d.duration === "custom" ? parseDuration(d.customText) : d.duration;
}

/** يختار زرّ المدة المطابق، وإلا يحوّلها إلى نصّ مخصّص */
export function durationFields(minutes: number, format: (m: number) => string): Pick<Draft, "duration" | "customText"> {
  return (DURATIONS as readonly number[]).includes(minutes) ? { duration: minutes, customText: "" } : { duration: "custom", customText: format(minutes) };
}

export interface Checked {
  errors: Partial<Record<DraftError, true>>;
  clash: Task | null;
  length: number | null;
  startMin: number | null;
  endMin: number | null;
}

/** يتحقّق من المسودة مقابل مهام المصدر نفسه */
export function checkDraft(d: Draft, tasks: Task[], exceptId?: string): Checked {
  const errors: Checked["errors"] = {};
  if (!d.title.trim()) errors.title = true;
  const length = d.timed ? null : draftLength(d);
  if (!d.timed && length === null) errors.duration = true;
  if (d.repeat === "custom" && d.repeatDays.length === 0) errors.days = true;

  let startMin: number | null = null;
  let endMin: number | null = null;
  let clash: Task | null = null;
  if (d.timed) {
    if (!isTime(d.start)) errors.start = true;
    else startMin = toMinutes(d.start);
    if (!isTime(d.end)) errors.end = true;
    else endMin = endMinute(d.end);
    if (startMin !== null && endMin !== null) {
      if (endMin - startMin < 5) errors.end = true;
      else {
        clash = findClash(tasks, isoAt(d.day, startMin), isoAt(d.day, endMin), exceptId);
        if (clash) errors.clash = true;
      }
    }
  }
  return {
    errors,
    clash,
    length: d.timed && startMin !== null && endMin !== null && endMin > startMin ? endMin - startMin : length,
    startMin,
    endMin,
  };
}
