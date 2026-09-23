import { type Task } from "./tasks";

/**
 * أرقام الشاشة الرئيسية — مشتقّة من نفس المهام، كما في الإحصاء.
 *
 * لا عدّادات محفوظة ولا لقطة ليلية: الشاشة تُفتح فتُحسب. رقمٌ يُخزَّن يصير
 * كذباً في أول يوم يُحذف فيه شيء، ولا ينبّه أحدٌ إلى انحرافه.
 */

export interface Kpis {
  /** كل ما لم يُنجَز. */
  open: number;
  /** ما له وقت محجوز لم يمضِ. */
  scheduled: number;
  /** ما يستحقّ نظرةً الآن: فات وقته، أو مهمّ وعاجل. */
  attention: number;
  /** ما أُنجز منذ منتصف ليلة اليوم. */
  completedToday: number;
}

/** بداية يوم محلّي — الحدّ الذي يُقاس عليه «اليوم». */
export function startOfDay(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * المهمة تستحقّ انتباهاً إن فات وقتها أو كانت مهمّة وعاجلة.
 *
 * ليس كل عاجل مهمّاً، وليس كل متأخّر كارثة — لكن هذين وحدهما ما يخسره
 * صاحب المهام إن لم يرهما اليوم.
 */
export function needsAttention(task: Task, now: number): boolean {
  if (task.completedAt) return false;
  if (task.quadrant === "important_urgent") return true;
  return Boolean(task.scheduledEnd && new Date(task.scheduledEnd).getTime() < now);
}

export function kpisOf(open: Task[], completed: Task[], now: Date = new Date()): Kpis {
  const stamp = now.getTime();
  const dayStart = startOfDay(now).getTime();

  return {
    open: open.length,
    scheduled: open.filter(
      task => task.scheduledEnd && new Date(task.scheduledEnd).getTime() >= stamp,
    ).length,
    attention: open.filter(task => needsAttention(task, stamp)).length,
    completedToday: completed.filter(
      task => task.completedAt && new Date(task.completedAt).getTime() >= dayStart,
    ).length,
  };
}

/**
 * معدّل الإنجاز هذا الأسبوع: المنجَز من مجموع ما كان على الطاولة.
 *
 * المقام هو المنجَز زائد ما بقي مفتوحاً، لا المنجَز وحده — وإلا صار كل
 * أسبوع مئةً بالمئة، وهو رقم لا يقول شيئاً ولا يُخطئ أبداً.
 */
export function completionRate(openCount: number, completedThisWeek: number): number {
  const total = openCount + completedThisWeek;
  if (total === 0) return 0;
  return Math.round((completedThisWeek / total) * 100);
}

/** أحرف الأيام كما تُكتب في الرسم: سبت، أحد، اثنين… */
const DAY_INITIALS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

export interface DayBar {
  /** «2026-09-22» */
  day: string;
  /** حرف اليوم تحت العمود. */
  initial: string;
  count: number;
  isToday: boolean;
}

/**
 * سبعة أعمدة تنتهي باليوم.
 *
 * الأحدث في آخر الصفّ لا أوّله: العين العربية تقرأ من اليمين، والرسم يُقلب
 * بالتنسيق لا بترتيب البيانات — فيبقى الترتيب هنا زمنيّاً مقروءاً في الاختبار.
 */
export function weekBars(completed: Task[], now: Date = new Date()): DayBar[] {
  const counts = new Map<string, number>();
  for (const task of completed) {
    if (!task.completedAt) continue;
    const local = new Date(task.completedAt);
    counts.set(dayKey(local), (counts.get(dayKey(local)) ?? 0) + 1);
  }

  const today = startOfDay(now);
  const bars: DayBar[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - back);
    const key = dayKey(date);
    bars.push({
      day: key,
      initial: DAY_INITIALS[date.getDay()],
      count: counts.get(key) ?? 0,
      isToday: back === 0,
    });
  }
  return bars;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** تحيّة الوقت — بلا اسم إن لم يُعرف، فتحيّة ناقصة أهون من اسم مخترع. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "مساء الخير";
  return "مساء الخير";
}

/** أهمّ ما يستحقّ الانتباه، الأعجل أولاً. */
export function attentionList(open: Task[], now: Date = new Date(), limit = 3): Task[] {
  const stamp = now.getTime();
  return open
    .filter(task => needsAttention(task, stamp))
    .sort((a, b) => {
      const at = a.scheduledEnd ? new Date(a.scheduledEnd).getTime() : Infinity;
      const bt = b.scheduledEnd ? new Date(b.scheduledEnd).getTime() : Infinity;
      return at - bt;
    })
    .slice(0, limit);
}
