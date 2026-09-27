import { type Task } from "./tasks";

/**
 * فلاتر اللوحة وأرقامها.
 *
 * منفصلة عن الرسم لأنها تُخطئ في صمت: فلترٌ يعرض مهام الأسبوع الماضي بدل
 * القادم يبدو صحيحاً تماماً. والأرقام الأربعة أعلى اللوحة تُقرأ في نصف
 * ثانية وتُصدَّق — فإن كانت خطأً لم يراجعها أحد.
 */

export const FILTERS = [
  { id: "all", label: "الكل" },
  { id: "today", label: "اليوم" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "upcoming", label: "قادمة" },
  { id: "done", label: "مكتملة" },
] as const;

export type FilterId = (typeof FILTERS)[number]["id"];

const DAY = 86_400_000;

function startOfDay(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * هل تقع المهمة في الفلتر؟
 *
 * «اليوم» تشمل ما جُدول اليوم **وما فات ولم يُنجَز** — المتأخّر شغلُ اليوم
 * سواء أردناه أو لا، وإخفاؤه يجعل القائمة تكذب بالسكوت.
 */
export function inFilter(task: Task, filter: FilterId, now: Date = new Date()): boolean {
  const done = Boolean(task.completedAt);
  if (filter === "done") return done;
  if (done) return false;
  if (filter === "all") return true;

  if (!task.scheduledStart) {
    // بلا موعد: تظهر في «الكل» وحدها. وضعُها في «اليوم» يملؤه بما لم يُخطَّط له.
    return false;
  }

  const start = new Date(task.scheduledStart).getTime();
  const dayStart = startOfDay(now);

  if (filter === "today") return start < dayStart + DAY;
  if (filter === "week") return start < dayStart + 7 * DAY;
  return start >= dayStart + DAY;
}

export function applyFilter(tasks: Task[], filter: FilterId, now: Date = new Date()): Task[] {
  return tasks.filter(task => inFilter(task, filter, now));
}

export interface BoardCounts {
  /** ما لا موعد له — العنق الحقيقي بين التصنيف والإنجاز. */
  needsTime: number;
  week: number;
  today: number;
  late: number;
}

/**
 * الأرقام الأربعة — محسوبة من المهام نفسها.
 *
 * المرجع يسمّي الأولى «أهداف قيد التنفيذ»، ولا أهداف في هذا المنتج بعد،
 * وعرضُ رقمٍ لكيان غير موجود كذبٌ مرتّب.
 *
 * وكانت «تحتاج قراراً» (بلا تصنيف وبلا موعد)، فقرأت صفراً على بيانات كلّها
 * مصنَّفة وكلّها بلا موعد — رقمٌ صادق لا يصف شيئاً. والعنق الحقيقي هناك هو
 * الجدولة، فصارت تعدّ ما لا موعد له. واللوحة تصف الحال لا تُثبت صحّتها.
 */
export function countsOf(open: Task[], completed: Task[], now: Date = new Date()): BoardCounts {
  const stamp = now.getTime();
  const dayStart = startOfDay(now);

  return {
    needsTime: open.filter(t => !t.scheduledStart).length,
    week: open.filter(t => t.scheduledStart && new Date(t.scheduledStart).getTime() < dayStart + 7 * DAY).length,
    today: open.filter(t => t.scheduledStart && new Date(t.scheduledStart).getTime() < dayStart + DAY).length,
    late: open.filter(t => t.scheduledEnd && new Date(t.scheduledEnd).getTime() < stamp).length,
  };
}

/** «10:00 ص» أو «28 سبتمبر» — الوقت لليوم، والتاريخ لما بعده. */
export function whenLabel(task: Task, now: Date = new Date()): string {
  if (!task.scheduledStart) return "بلا وقت";
  const start = new Date(task.scheduledStart);
  const sameDay = start.toDateString() === now.toDateString();
  if (sameDay) {
    const hour = start.getHours();
    const suffix = hour < 12 ? "ص" : "م";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return `${twelve}:${String(start.getMinutes()).padStart(2, "0")} ${suffix}`;
  }
  return start.toLocaleDateString("ar", { day: "numeric", month: "long" });
}
