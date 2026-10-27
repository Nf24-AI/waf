// قواعد المهام: التعارض، أول وقت فارغ، والموعد التالي للمهمة المتكرّرة.

import type { Quadrant, RepeatRule, Task } from "@/data/types";
import { MINUTE, roundUpTo } from "./time";

export const QUADRANTS: Quadrant[] = ["do", "plan", "delegate", "drop"];

export function isOpen(task: Task): boolean {
  return task.completedAt === null;
}

export function isScheduled(task: Task): task is Task & { startsAt: string; endsAt: string } {
  return task.startsAt !== null && task.endsAt !== null;
}

/** مدة المهمة: طول حجزها إن حُجزت، وإلا تقديرها، وإلا ٣٠ دقيقة */
export function lengthOf(task: Pick<Task, "startsAt" | "endsAt" | "estimateMinutes">): number {
  if (task.startsAt && task.endsAt) return Math.round((Date.parse(task.endsAt) - Date.parse(task.startsAt)) / MINUTE);
  return task.estimateMinutes ?? 30;
}

/** أول مهمة مفتوحة محجوزة تتقاطع مع [start, end) غير المهمة المستثناة */
export function findClash(tasks: Task[], startIso: string, endIso: string, exceptId?: string): Task | null {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  for (const t of tasks) {
    if (t.id === exceptId || !isOpen(t) || !isScheduled(t)) continue;
    if (Date.parse(t.startsAt) < e && Date.parse(t.endsAt) > s) return t;
  }
  return null;
}

/**
 * أول فراغ يتّسع لـ length دقيقة في يوم dayStart (منتصف الليل)، يبدأ البحث من fromMinute
 * ويُقرَّب لربع الساعة، ولا يتجاوز منتصف الليل. يعيد دقيقة البداية أو null.
 */
export function firstFreeSlot(tasks: Task[], dayStart: Date, fromMinute: number, length: number, exceptId?: string): number | null {
  const base = dayStart.getTime();
  const busy = tasks
    .filter((t) => t.id !== exceptId && isOpen(t) && isScheduled(t))
    .map((t) => [(Date.parse(t.startsAt!) - base) / MINUTE, (Date.parse(t.endsAt!) - base) / MINUTE] as const)
    .filter(([s, e]) => e > 0 && s < 1440)
    .sort((a, b) => a[0] - b[0]);

  let cursor = roundUpTo(Math.max(0, fromMinute), 15);
  for (;;) {
    if (cursor + length > 1440) return null;
    const hit = busy.find(([s, e]) => s < cursor + length && e > cursor);
    if (!hit) return cursor;
    cursor = roundUpTo(hit[1], 15);
  }
}

/** هل يوم الأسبوع (0 = الأحد) يطابق قاعدة التكرار؟ أيام العمل: الأحد–الخميس. */
export function matchesRule(rule: RepeatRule, days: number[], weekday: number, originWeekday: number): boolean {
  switch (rule) {
    case "daily":
      return true;
    case "weekdays":
      return weekday >= 0 && weekday <= 4;
    case "weekly":
      return weekday === originWeekday;
    case "custom":
      return days.length ? days.includes(weekday) : weekday === originWeekday;
  }
}

/** عدد الأيام حتى الموعد التالي بعد start، أو null لمهمة غير متكرّرة */
export function nextOffsetDays(task: Pick<Task, "repeatRule" | "repeatDays" | "startsAt">): number | null {
  if (!task.repeatRule || !task.startsAt) return null;
  const origin = new Date(task.startsAt).getDay();
  for (let i = 1; i <= 7; i++) {
    if (matchesRule(task.repeatRule, task.repeatDays, (origin + i) % 7, origin)) return i;
  }
  return 7;
}

/** حقول الموعد التالي لمهمة متكرّرة محجوزة */
export function nextOccurrence(task: Task): { startsAt: string; endsAt: string } | null {
  const offset = nextOffsetDays(task);
  if (offset === null || !isScheduled(task)) return null;
  const shift = (iso: string) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + offset);
    return d.toISOString();
  };
  return { startsAt: shift(task.startsAt), endsAt: shift(task.endsAt) };
}

/** مواعيد متكرّرة قادمة (ظلال) تقع في يوم معيّن ولم تُنشأ بعد */
export function ghostsOn(tasks: Task[], dayStart: Date): { task: Task; startsAt: string; endsAt: string }[] {
  const out: { task: Task; startsAt: string; endsAt: string }[] = [];
  const target = dayStart.getTime();
  for (const t of tasks) {
    if (!isOpen(t) || !isScheduled(t) || !t.repeatRule) continue;
    const start = new Date(t.startsAt);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const diff = Math.round((target - startDay) / 86_400_000);
    if (diff < 1 || diff > 60) continue;
    if (!matchesRule(t.repeatRule, t.repeatDays, dayStart.getDay(), start.getDay())) continue;
    const s = new Date(t.startsAt);
    s.setDate(s.getDate() + diff);
    const e = new Date(t.endsAt);
    e.setDate(e.getDate() + diff);
    out.push({ task: t, startsAt: s.toISOString(), endsAt: e.toISOString() });
  }
  return out;
}
