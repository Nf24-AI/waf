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
  { id: "important_urgent", importance: "important", urgency: "urgent", title: "مهم وعاجل", verb: "افعل الآن" },
  { id: "important_not_urgent", importance: "important", urgency: "not-urgent", title: "مهم وغير عاجل", verb: "خطّط له" },
  { id: "not_important_urgent", importance: "not-important", urgency: "urgent", title: "غير مهم وعاجل", verb: "فوّض" },
  { id: "not_important_not_urgent", importance: "not-important", urgency: "not-urgent", title: "غير مهم وغير عاجل", verb: "احذف" },
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

/** التكرار: يوميّ أو أسبوعيّ، أو لا تكرار. أكثر من ذلك يحتاج قواعد لا عموداً. */
export type RepeatRule = "daily" | "weekly";

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
  repeatRule?: RepeatRule;
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
export function nextActionOf(task: Task): { label: string; method: "eisenhower" | "time-blocking" | "focus" } {
  if (!task.quadrant) return { label: "تصنيف المهمة", method: "eisenhower" };
  if (!task.scheduledStart) return { label: "حجز وقت", method: "time-blocking" };
  return { label: "ابدأ التركيز", method: "focus" };
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
): { start: string; end: string } {
  const step = rule === "daily" ? DAY_MS : 7 * DAY_MS;
  return {
    start: new Date(new Date(startIso).getTime() + step).toISOString(),
    end: new Date(new Date(endIso).getTime() + step).toISOString(),
  };
}
