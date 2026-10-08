/**
 * حساب صفحة حجز الوقت — خالصاً من الواجهة ليُختبر وحده.
 *
 * الحجز مهمةٌ لها بداية ونهاية، لا كائنٌ ثانٍ: `id` واحد يعبر الطرق الثلاث
 * (انظر shared/tasks.ts). فكل ما هنا يقرأ المهام ويشتقّ منها ما تعرضه
 * الصفحة: حجوزات اليوم، وأول فراغ، وأرقام البطاقات.
 */
import { repeatsOn, type Task, type TaskCategory, type TaskPriority } from "@shared/tasks";
import { toDateInput } from "./clock";
import { getLang, pair, type Pair } from "./i18n";

export type TimeFormat = 12 | 24;

/** اليوم المعروض يبدأ السادسة: ما قبلها نوم عند أغلب الناس، ويُمدّ إن حُجز فيه. */
export const DAY_START_HOUR = 6;
export const DAY_END_MIN = 24 * 60;

export const SECTIONS = [
  { id: "morning", label: pair("الصباح", "Morning"), icon: "☀️", from: 6, to: 12 },
  { id: "afternoon", label: pair("الظهيرة", "Afternoon"), icon: "🌤️", from: 12, to: 18 },
  { id: "evening", label: pair("المساء", "Evening"), icon: "🌇", from: 18, to: 22 },
  { id: "night", label: pair("الليل", "Night"), icon: "🌙", from: 22, to: 24 },
] as const;

export const DURATIONS = [30, 45, 60, 90, 120] as const;

export const PRIORITY_LABEL: Record<TaskPriority, Pair> = {
  low: pair("منخفضة", "Low"),
  medium: pair("متوسطة", "Medium"),
  high: pair("عالية", "High"),
};

const WEEKDAY_SHORT = {
  ar: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
} as const;

/** أسماء الأيام القصيرة بلغة الواجهة، بترقيم Date.getDay(). */
export function weekdayShort(): readonly string[] {
  return WEEKDAY_SHORT[getLang()];
}

/** «09:30» ← 570 */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 570 ← «09:30». والأربع والعشرون تُكتب «24:00» للعرض، و«23:59» لخانة الوقت. */
export function timeOf(minutes: number): string {
  const safe = Math.max(0, Math.min(DAY_END_MIN, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** «9:30 ص» أو «09:30» بحسب اختيار المستخدم. */
export function formatTime(time: string | number, format: TimeFormat): string {
  const total = typeof time === "number" ? time : minutesOf(time);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const mm = String(m).padStart(2, "0");
  if (format === 24) return `${String(h).padStart(2, "0")}:${mm}`;
  const [am, pm] = getLang() === "ar" ? ["ص", "م"] : ["AM", "PM"];
  return `${h % 12 || 12}:${mm} ${h >= 12 ? pm : am}`;
}

/** «1س 30د» — قصير ليسع بطاقة المهمة. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  const [hour, minute] = getLang() === "ar" ? ["س", "د"] : ["h", "m"];
  if (!h) return `${m}${minute}`;
  return m ? `${h}${hour} ${m}${minute}` : `${h}${hour}`;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * مدّة كما يكتبها الناس: «90»، «1h 20m»، «1.5h»، «١س ٢٠د»، «ساعتين».
 *
 * رقمٌ وحده دقائق. وما لا يُفهم يعود NaN ليُقال لصاحبه، لا صفراً يُحجز به.
 */
export function parseDuration(input: string): number {
  const text = String(input)
    .trim()
    .toLowerCase()
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/ساعتين|ساعتان/g, "2h")
    .replace(/ساعة ونصف/g, "1.5h")
    .replace(/نصف ساعة/g, "30m")
    .replace(/ساعات|ساعة|س/g, "h")
    .replace(/دقائق|دقيقة|د/g, "m");
  if (/^\d+$/.test(text)) return Number(text);
  const h = text.match(/(\d+(?:\.\d+)?)\s*h/)?.[1];
  const m = text.match(/(\d+)\s*m/)?.[1];
  if (!h && !m) return Number.NaN;
  return Math.round(Number(h ?? 0) * 60 + Number(m ?? 0));
}

/** يوم محليّ «2026-10-08» مزاحاً بعدد أيام. */
export function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toDateInput(new Date(y, m - 1, d + by));
}

export function dateOf(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** أسبوع اليوم، من الأحد: أسبوع العمل هنا يبدأ به. */
export function weekOf(day: string): string[] {
  const start = shiftDay(day, -dateOf(day).getDay());
  return Array.from({ length: 7 }, (_, index) => shiftDay(start, index));
}

export function greeting(hour: number): string {
  const arabic = getLang() === "ar";
  if (hour < 12) return arabic ? "صباح الخير" : "Good morning";
  if (hour < 18) return arabic ? "مساء الخير" : "Good afternoon";
  return arabic ? "مساء النور" : "Good evening";
}

export interface Block {
  task: Task;
  /** دقائق من منتصف ليل اليوم المعروض. */
  start: number;
  end: number;
  /** موعدٌ متوقَّع من تكرار، لا صفّ قائم: يُعرض ولا يُعدَّل. */
  ghost: boolean;
}

function localBlock(task: Task): { day: string; start: number; end: number } | null {
  if (!task.scheduledStart || !task.scheduledEnd) return null;
  const from = new Date(task.scheduledStart);
  const to = new Date(task.scheduledEnd);
  const start = from.getHours() * 60 + from.getMinutes();
  // ما يعبر منتصف الليل يُقصّ عنده: اليوم المعروض ينتهي هناك.
  const end = toDateInput(to) === toDateInput(from) ? to.getHours() * 60 + to.getMinutes() : DAY_END_MIN;
  return { day: toDateInput(from), start, end: Math.max(end, start + 1) };
}

/**
 * حجوزات يومٍ بعينه، مرتّبةً، ومعها ما سيقع فيه من المتكرّر.
 *
 * المتكرّر صفٌّ واحد حتى يُنجَز فتُنشأ نسخته التالية. فلو عُرض الصفّ وحده
 * لبدا غدُ من يجتمع كل يوم فارغاً — فيُرسم الموعد المتوقَّع شبحاً.
 */
export function blocksOn(tasks: readonly Task[], day: string): Block[] {
  const weekday = dateOf(day).getDay();
  const blocks: Block[] = [];
  for (const task of tasks) {
    const at = localBlock(task);
    if (!at) continue;
    if (at.day === day) {
      blocks.push({ task, start: at.start, end: at.end, ghost: false });
    } else if (
      task.repeatRule &&
      at.day < day &&
      repeatsOn(task.repeatRule, weekday, dateOf(at.day).getDay(), task.repeatDays ?? [])
    ) {
      blocks.push({ task, start: at.start, end: at.end, ghost: true });
    }
  }
  return blocks.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * أول فراغ يسع المدّة، من `from` فصاعداً. `null` إن امتلأ اليوم.
 *
 * يُقرَّب إلى ربع الساعة: حجزٌ يبدأ 10:07 لأن ما قبله انتهى فيها يبدو خطأً.
 */
export function firstFreeSlot(
  blocks: readonly Pick<Block, "start" | "end">[],
  from: number,
  duration: number,
  except?: (block: Pick<Block, "start" | "end">) => boolean,
): number | null {
  const taken = blocks.filter(block => !except?.(block)).sort((a, b) => a.start - b.start);
  let cursor = Math.ceil(from / 15) * 15;
  for (const block of taken) {
    if (block.end <= cursor) continue;
    if (block.start >= cursor + duration) break;
    cursor = Math.ceil(block.end / 15) * 15;
  }
  return cursor + duration <= DAY_END_MIN ? cursor : null;
}

/** هل يتداخل [start, end) مع حجزٍ قائم؟ يعيده إن تداخل. */
export function clashWith<T extends Pick<Block, "start" | "end">>(
  blocks: readonly T[],
  start: number,
  end: number,
  except?: (block: T) => boolean,
): T | null {
  return blocks.find(block => !except?.(block) && block.start < end && block.end > start) ?? null;
}

export interface DayStats {
  planned: number;
  focus: number;
  meetings: number;
  personal: number;
  free: number;
  /** نسبة التركيز من المحجوز، 0–100. */
  focusPercent: number;
  byCategory: { id: TaskCategory; minutes: number; percent: number }[];
}

/**
 * أرقام اليوم من حجوزاته.
 *
 * التركيز = العمل العميق والعمل على مشروع: ما يحتاج ذهناً متّصلاً. والوقت
 * الحرّ ما بقي من نافذة اليوم (6 ص – 12 م) بلا حجز، فلا يَعِد بساعات النوم.
 */
export function dayStats(blocks: readonly Block[], categoryOf: (task: Task) => TaskCategory): DayStats {
  const minutes: Record<TaskCategory, number> = { deep: 0, meeting: 0, personal: 0, project: 0, other: 0 };
  for (const block of blocks) minutes[categoryOf(block.task)] += block.end - block.start;

  const planned = Object.values(minutes).reduce((sum, value) => sum + value, 0);
  const focus = minutes.deep + minutes.project;
  const window = DAY_END_MIN - DAY_START_HOUR * 60;
  const inWindow = blocks.reduce(
    (sum, block) => sum + Math.max(0, block.end - Math.max(block.start, DAY_START_HOUR * 60)),
    0,
  );

  return {
    planned,
    focus,
    meetings: minutes.meeting,
    personal: minutes.personal,
    free: Math.max(0, window - inWindow),
    focusPercent: planned ? Math.round((focus / planned) * 100) : 0,
    byCategory: (Object.keys(minutes) as TaskCategory[]).map(id => ({
      id,
      minutes: minutes[id],
      percent: planned ? Math.round((minutes[id] / planned) * 100) : 0,
    })),
  };
}

/** أول ساعة تُرسم: السادسة، أو أبكر إن حُجز قبلها. */
export function firstHour(blocks: readonly Block[]): number {
  return blocks.reduce((hour, block) => Math.min(hour, Math.floor(block.start / 60)), DAY_START_HOUR);
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** ما ينتظر وقتاً أولاً، ثم الأعلى أولوية؛ والمحجوز بعده بترتيب موعده. */
export function sortTasks(tasks: readonly Task[], priorityOf: (task: Task) => TaskPriority): Task[] {
  return [...tasks].sort((a, b) => {
    const scheduled = Number(Boolean(a.scheduledStart)) - Number(Boolean(b.scheduledStart));
    if (scheduled) return scheduled;
    if (a.scheduledStart && b.scheduledStart) return a.scheduledStart.localeCompare(b.scheduledStart);
    return PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)];
  });
}

/** لحظة ISO من يوم محليّ ودقائق من منتصف ليله. 1440 تقع على منتصف الليل التالي. */
export function isoAt(day: string, minutes: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, minutes).toISOString();
}
