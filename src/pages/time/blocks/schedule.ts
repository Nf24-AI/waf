// حساب جدول اليوم: مواضع الحجوزات بالبكسل، المسارات المتجاورة حين تتداخل،
// الإحصاءات، وأين تقع المهمة حين تُسقط على ساعة مأخوذة. منطق صافٍ بلا واجهة.

import type { Category, Task } from "@/data/types";
import { firstFreeSlot, ghostsOn, isOpen, isScheduled } from "@/lib/tasks";
import { addDays, MINUTE, parseDay, roundUpTo } from "@/lib/time";

export const HOUR_PX = 64;
export const PX_PER_MIN = HOUR_PX / 60;
export const DAY_FROM = 6 * 60;
export const DAY_TO = 24 * 60;
export const SNAP = 15;

export const CATEGORIES: Category[] = ["deep", "meeting", "personal", "project", "other"];

export interface Block {
  /** مفتاح فريد: معرّف المهمة، أو ghost:معرّف للموعد المتكرّر القادم */
  key: string;
  task: Task;
  /** دقائق منذ منتصف ليل اليوم المعروض، مقصوصة إلى [0، 1440] */
  start: number;
  end: number;
  ghost: boolean;
  done: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** حجوزات يوم معيّن: المهام المحجوزة (مفتوحة ومنجزة) وظلال المتكرّرة */
export function blocksOn(tasks: Task[], day: string): Block[] {
  const dayStart = parseDay(day);
  const base = dayStart.getTime();
  const out: Block[] = [];
  const span = (s: string, e: string) => [(Date.parse(s) - base) / MINUTE, (Date.parse(e) - base) / MINUTE] as const;
  for (const t of tasks) {
    if (!isScheduled(t)) continue;
    const [s, e] = span(t.startsAt, t.endsAt);
    if (e <= 0 || s >= DAY_TO) continue;
    out.push({ key: t.id, task: t, start: clamp(Math.round(s), 0, DAY_TO), end: clamp(Math.round(e), 0, DAY_TO), ghost: false, done: !isOpen(t) });
  }
  for (const g of ghostsOn(tasks, dayStart)) {
    const [s, e] = span(g.startsAt, g.endsAt);
    if (e <= 0 || s >= DAY_TO) continue;
    out.push({ key: `ghost:${g.task.id}`, task: g.task, start: clamp(Math.round(s), 0, DAY_TO), end: clamp(Math.round(e), 0, DAY_TO), ghost: true, done: false });
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end);
}

/** بداية الجدول: السادسة صباحاً، أو ساعة أبكر حجز إن كان قبلها */
export function rangeStart(blocks: Pick<Block, "start">[]): number {
  const earliest = blocks.reduce((m, b) => Math.min(m, b.start), DAY_FROM);
  return Math.floor(earliest / 60) * 60;
}

export const minuteToY = (minute: number, from: number) => (minute - from) * PX_PER_MIN;

/** موضع رأسي → دقيقة مقرّبة لربع الساعة داخل اليوم */
export function yToMinute(y: number, from: number, snap = SNAP): number {
  return clamp(Math.round((from + y / PX_PER_MIN) / snap) * snap, 0, DAY_TO);
}

/**
 * مسارات الحجوزات المتداخلة: كل مجموعة متداخلة تتقاسم العرض بالتساوي،
 * وكل حجز يأخذ أول مسار فارغ فيها.
 */
export function layoutLanes(items: { key: string; start: number; end: number }[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: { key: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    for (const g of group) out.set(g.key, { lane: g.lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    const end = Math.max(it.end, it.start + 1);
    if (it.start >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    group.push({ key: it.key, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}

/**
 * أين تُحجز مهمة طولها length إن طُلبت الدقيقة minute: في مكانها إن كان فارغاً،
 * وإلا في أول وقت فارغ بعده. null إن لم يبقَ في اليوم ما يسعها.
 */
export function resolvePlacement(tasks: Task[], day: string, minute: number, length: number, exceptId?: string): { start: number; moved: boolean } | null {
  const want = clamp(minute, 0, DAY_TO);
  const start = firstFreeSlot(tasks, parseDay(day), want, length, exceptId);
  if (start === null) return null;
  return { start, moved: start !== want };
}

/** بداية البحث الافتراضية: الربع التالي من الآن لليوم الحالي، وإلا التاسعة صباحاً */
export function defaultFrom(day: string, today: string, now: Date): number {
  if (day !== today) return 9 * 60;
  return roundUpTo(now.getHours() * 60 + now.getMinutes(), SNAP);
}

/** لحظة ISO لدقيقة من يوم محلّي؛ ١٤٤٠ = منتصف الليل التالي */
export function isoAt(day: string, minute: number): string {
  const d = parseDay(day);
  d.setMinutes(minute);
  return d.toISOString();
}

/** طول اتحاد الفترات بعد قصّها إلى [lo، hi) */
export function unionLength(intervals: { start: number; end: number }[], lo = 0, hi = DAY_TO): number {
  const xs = intervals
    .map((i) => [Math.max(lo, i.start), Math.min(hi, i.end)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cs = -1;
  let ce = -1;
  for (const [s, e] of xs) {
    if (s > ce) {
      total += ce - cs;
      cs = s;
      ce = e;
    } else ce = Math.max(ce, e);
  }
  return total + (ce - cs);
}

export interface DayStats {
  booked: number;
  focus: number;
  free: number;
}

/** محجوز / وقت التركيز (عميق + مشروع) / وقت حرّ (٦ صباحاً – منتصف الليل ناقص المحجوز) */
export function dayStats(blocks: Block[]): DayStats {
  const booked = unionLength(blocks);
  const focus = unionLength(blocks.filter((b) => b.task.category === "deep" || b.task.category === "project"));
  const free = DAY_TO - DAY_FROM - unionLength(blocks, DAY_FROM, DAY_TO);
  return { booked, focus, free };
}

/** دقائق كل فئة في اليوم */
export function categoryMinutes(blocks: Block[]): Record<Category, number> {
  const out = { deep: 0, meeting: 0, personal: 0, project: 0, other: 0 } as Record<Category, number>;
  for (const c of CATEGORIES) out[c] = unionLength(blocks.filter((b) => b.task.category === c));
  return out;
}

export type TaskFilter = "all" | "unscheduled" | "work" | "personal" | "meetings";

export function matchesFilter(task: Task, f: TaskFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "unscheduled":
      return !isScheduled(task);
    case "work":
      return task.category === "deep" || task.category === "project";
    case "personal":
      return task.category === "personal";
    case "meetings":
      return task.category === "meeting";
  }
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const QUADRANT_RANK = { do: 0, plan: 1, delegate: 2, drop: 3 } as const;

/**
 * ترتيب قائمة المهام: غير المحجوزة أولاً حسب الأولوية (وحسب الرُّبع داخل نظام واف)،
 * ثم المحجوزة حسب وقتها. المنجزة في الآخر.
 */
export function sortTasks(tasks: Task[], opts: { byQuadrant?: boolean } = {}): Task[] {
  const rank = (t: Task) => {
    if (!isOpen(t)) return 2;
    return isScheduled(t) ? 1 : 0;
  };
  return [...tasks].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 0) {
      if (opts.byQuadrant) {
        const qa = a.quadrant ? QUADRANT_RANK[a.quadrant] : 4;
        const qb = b.quadrant ? QUADRANT_RANK[b.quadrant] : 4;
        if (qa !== qb) return qa - qb;
      }
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p) return p;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
    if (rank(a) === 1) return Date.parse(a.startsAt!) - Date.parse(b.startsAt!);
    return Date.parse(b.completedAt!) - Date.parse(a.completedAt!);
  });
}

/** أيام الأسبوع الذي يقع فيه اليوم، تبدأ بالأحد */
export function weekOf(day: string): string[] {
  const start = addDays(day, -parseDay(day).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** الأيام التي فيها حجز مفتوح أو موعد متكرّر */
export function busyDays(tasks: Task[], days: string[]): Set<string> {
  const out = new Set<string>();
  for (const d of days) if (blocksOn(tasks.filter(isOpen), d).length) out.add(d);
  return out;
}
