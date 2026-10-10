/**
 * نموذج المهمة — مصدر الحقيقة الوحيد في واف.
 *
 * المهمة هي الأصل، والطرق الثلاث أدوات للتعامل معها:
 *   أيزنهاور  — ماذا يستحق وقتي؟
 *   حجز الوقت — متى أعطيه وقتي؟
 *   التركيز    — كيف أحمي ذلك الوقت؟
 *
 * ولذلك لا نسخة ثانية من المهمة عند الانتقال بين الطرق: `id` واحد يعبرها
 * كلها، وكل طريقة تكتب في حقولها هي من الصفّ نفسه.
 */

/**
 * أرباع أيزنهاور.
 *
 * المعرّفات مركّبة من المهمّ والعاجل لا مخترعة، لأن الجدول في Supabase يخزّن
 * العمودين منفصلين منذ التطبيق السابق — فيُشتقّ الرُّبع منهما ولا يُخزَّن
 * مرّتين. انظر quadrantOf و splitQuadrant.
 */
export const QUADRANTS = [
  { id: "important_urgent", importance: "important", urgency: "urgent", title: "مهم وعاجل", verb: "افعل الآن", titleEn: "Important & urgent", verbEn: "Do it now" },
  { id: "important_not_urgent", importance: "important", urgency: "not-urgent", title: "مهم وغير عاجل", verb: "خطّط له", titleEn: "Important, not urgent", verbEn: "Plan it" },
  { id: "not_important_urgent", importance: "not-important", urgency: "urgent", title: "غير مهم وعاجل", verb: "فوّض", titleEn: "Urgent, not important", verbEn: "Delegate" },
  { id: "not_important_not_urgent", importance: "not-important", urgency: "not-urgent", title: "غير مهم وغير عاجل", verb: "احذف", titleEn: "Neither urgent nor important", verbEn: "Drop it" },
] as const;

export type Quadrant = (typeof QUADRANTS)[number]["id"];
export type Importance = (typeof QUADRANTS)[number]["importance"];
export type Urgency = (typeof QUADRANTS)[number]["urgency"];

/**
 * حالة المهمة.
 *
 * ليست رحلة إجبارية: المستخدم يقفز من NEW إلى FOCUSING مباشرة إن شاء، أو
 * يصنّف ولا يجدول، أو يجدول ولا يركّز. الترتيب هنا للعرض لا للإلزام.
 */
export const TASK_STATES = ["new", "classified", "scheduled", "focusing", "completed"] as const;
export type TaskState = (typeof TASK_STATES)[number];

/**
 * التكرار: يوميّ، أو أيام العمل، أو أسبوعيّ، أو أيام يختارها صاحبها.
 *
 * «أيام العمل» الأحد إلى الخميس: المنتج سعوديّ، وأسبوعٌ يبدأ الإثنين يحجز
 * الجمعة لمن لا يعمل فيها. و«custom» يقرأ أيامه من `repeatDays`.
 */
export const REPEAT_RULES = ["daily", "weekdays", "weekly", "custom"] as const;
export type RepeatRule = (typeof REPEAT_RULES)[number];

/** أيام العمل بترقيم Date.getDay(): الأحد 0 … الخميس 4. */
export const WORK_DAYS: readonly number[] = [0, 1, 2, 3, 4];

/**
 * فئة المهمة — لون الحجز في الجدول الزمني.
 *
 * خمس لا أكثر: الفئة تُقرأ بلونها من طرف العين، وسادس لونٍ لا يُميَّز عن
 * خامسه في شريط عرضه أربعة بكسلات.
 */
export const TASK_CATEGORIES = [
  { id: "deep", label: "عمل عميق", labelEn: "Deep work", tone: "purple" },
  { id: "meeting", label: "اجتماعات", labelEn: "Meetings", tone: "blue" },
  { id: "personal", label: "شخصي", labelEn: "Personal", tone: "teal" },
  { id: "project", label: "عمل على مشروع", labelEn: "Project work", tone: "orange" },
  { id: "other", label: "أخرى", labelEn: "Other", tone: "gray" },
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number]["id"];

/** «2026-10-08» — يوم بلا ساعة، فلا منطقة زمنية تزيحه. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * الإطار الذي وُلدت فيه المهمة.
 *
 * الإطارات الثلاثة تُستعمل منفصلةً: من يفتح حجز الوقت يرى ما حجزه فيه، لا
 * ما صنّفه في المصفوفة ولا ما سمّاه في جلسة تركيز. فكل مهمة تحمل اسم إطارها،
 * وكل إطار يقرأ مهامه وحدها.
 *
 * وما سبق هذا الفصل بلا إطار، فلا يظهر في أيٍّ منها: كل إطار يبدأ بمهامه هو.
 * الصفوف باقية في القاعدة لم تُمسّ، وإعادتها إلى إطارٍ سطرٌ واحد يكتب اسمه
 * في عمود `origin`.
 */
export const TASK_ORIGINS = ["eisenhower", "timeblock", "focus"] as const;
export type TaskOrigin = (typeof TASK_ORIGINS)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description?: string;
  state: TaskState;
  /** الرُّبع إن صُنّفت. غير مصنّفة = undefined، ولا تُخترع لها قيمة. */
  quadrant?: Quadrant;
  /** الجدولة بصيغة ISO. الاثنان معاً أو لا شيء. */
  scheduledStart?: string;
  scheduledEnd?: string;
  /** المدة المتوقّعة بالدقائق، كما قدّرها صاحبها لا كما حسبناها. */
  estimatedMinutes?: number;
  /** جلسات التركيز المكتملة على هذه المهمة. */
  /** المشروع الذي تنتمي إليه، إن انتمت. مهمة بلا مشروع سليمة تماماً. */
  projectId?: string;
  repeatRule?: RepeatRule;
  /** أيام التكرار المخصّص بترقيم Date.getDay(). تُقرأ مع «custom» وحدها. */
  repeatDays?: number[];
  category?: TaskCategory;
  priority?: TaskPriority;
  /** الإطار الذي تنتمي إليه. غيابه = مهمة سبقت فصل الإطارات. */
  origin?: TaskOrigin;
  /** يوم الاستحقاق «2026-10-08» لمهمة لم تُحجز لها ساعة بعد. */
  dueDate?: string;
  /** دقائق قبل الموعد يُنبَّه فيها. صفر = عند الموعد، وغياب القيمة = بلا تذكير. */
  reminderMinutes?: number;
  completedSessions: number;
  createdAt: string;
  completedAt?: string;
}

/** جلسة تركيز واحدة. تُسجَّل ولو لم تُنجَز المهمة: الوقت أُنفق فعلاً. */
export interface FocusSession {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt?: string;
  plannedMinutes: number;
  /** هل أُكملت الجلسة أم قُطعت؟ الإحصائيات تفرّق بينهما. */
  completed: boolean;
}

export function quadrantOf(importance: Importance, urgency: Urgency): Quadrant {
  const found = QUADRANTS.find(q => q.importance === importance && q.urgency === urgency);
  if (!found) throw new Error(`لا رُبع لـ ${importance}/${urgency}`);
  return found.id;
}

export function splitQuadrant(quadrant: Quadrant): { importance: Importance; urgency: Urgency } {
  const found = QUADRANTS.find(q => q.id === quadrant);
  if (!found) throw new Error(`رُبع غير معروف: ${quadrant}`);
  return { importance: found.importance, urgency: found.urgency };
}

export function quadrantTitle(quadrant: Quadrant): string {
  return QUADRANTS.find(q => q.id === quadrant)!.title;
}

/**
 * الحالة تُشتقّ من الحقول لا تُخزَّن بجانبها.
 *
 * تخزين الحالة عموداً مستقلاً يجعلها تتباعد عمّا تصفه: مهمة مجدولة وحالتها
 * «جديدة» لأن أحداً نسي تحديث العمود. هنا الحقول هي الحقيقة، والحالة قراءة
 * لها — فلا يمكن أن تكذب.
 */
export function stateOf(task: Omit<Task, "state">): TaskState {
  if (task.completedAt) return "completed";
  if (task.scheduledStart && task.scheduledEnd) return "scheduled";
  if (task.quadrant) return "classified";
  return "new";
}

/** ما الذي تحتاجه هذه المهمة الآن؟ يحدّد زرّ البطاقة. */
export function nextActionOf(
  task: Task,
  lang: "ar" | "en" = "ar",
): { label: string; method: "eisenhower" | "time-blocking" | "focus" } {
  const ar = lang === "ar";
  if (!task.quadrant) return { label: ar ? "تصنيف المهمة" : "Classify task", method: "eisenhower" };
  if (!task.scheduledStart) return { label: ar ? "حجز وقت" : "Block time", method: "time-blocking" };
  return { label: ar ? "ابدأ التركيز" : "Start focus", method: "focus" };
}

export function isOpen(task: Task): boolean {
  return !task.completedAt;
}

const DAY_MS = 86_400_000;

/**
 * الموعد التالي لمهمة متكرّرة.
 *
 * الإزاحة بالمللي ثانية لا بتقويم: الرياض بلا توقيت صيفي، فالإضافة الثابتة
 * تعطي نفس الساعة في اليوم التالي دائماً. ولو تغيّر ذلك يوماً فهذا هو
 * الموضع الواحد الذي يُصحَّح فيه.
 */
export function nextOccurrence(
  startIso: string,
  endIso: string,
  rule: RepeatRule,
  days: readonly number[] = [],
): { start: string; end: string } {
  // «custom» بلا أيام يُعامَل أسبوعياً: قاعدةٌ لا تقع على يومٍ قط تُضيّع
  // المهمة بعد أول إنجاز، وأسبوعٌ كامل أهون من لا شيء.
  const anchor = weekdayOf(startIso);
  let step = 7;
  for (let offset = 1; offset <= 7; offset += 1) {
    if (repeatsOn(rule, (anchor + offset) % 7, anchor, days)) {
      step = offset;
      break;
    }
  }
  return {
    start: new Date(new Date(startIso).getTime() + step * DAY_MS).toISOString(),
    end: new Date(new Date(endIso).getTime() + step * DAY_MS).toISOString(),
  };
}

/** الرياض UTC+3 بلا توقيت صيفي: به يُعرف أيّ يومٍ من الأسبوع تقع فيه اللحظة. */
const RIYADH_OFFSET_MS = 3 * 3_600_000;

/** يوم الأسبوع (0 = الأحد) كما يراه صاحب الموعد، لا كما يراه الخادم. */
export function weekdayOf(iso: string): number {
  return new Date(new Date(iso).getTime() + RIYADH_OFFSET_MS).getUTCDay();
}

/** هل تقع القاعدة على هذا اليوم من الأسبوع؟ `anchor` يوم الموعد الأصلي. */
export function repeatsOn(
  rule: RepeatRule,
  weekday: number,
  anchor: number,
  days: readonly number[] = [],
): boolean {
  if (rule === "daily") return true;
  if (rule === "weekdays") return WORK_DAYS.includes(weekday);
  if (rule === "weekly") return weekday === anchor;
  return days.includes(weekday);
}
