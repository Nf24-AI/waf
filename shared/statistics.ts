import { QUADRANTS, type Quadrant, type Task } from "./tasks";

/**
 * أرقام إدارة الوقت — محسوبة من نفس المهام والجلسات، لا مخزّنة بجانبها.
 *
 * عدّاد يُزاد عند كل إنجاز يتباعد عن الحقيقة أول ما تُحذف مهمة أو تُلغى
 * جلسة، ولا يُكتشف انحرافه لأن لا شيء يقارنه بشيء. الأرقام هنا تُجمع من
 * الصفوف في كل مرة، فهي إمّا صحيحة أو مفقودة، ولا تكون كاذبة.
 */

/** جلسة تركيز كما تُقرأ من الجدول. */
export interface FocusSession {
  startedAt: string;
  endedAt?: string;
  plannedMinutes: number;
  completed: boolean;
}

export interface Statistics {
  /** المهام التي أُنجزت في المدة. */
  completedTasks: number;
  /** الجلسات التي بلغت آخرها — لا كل جلسة بُدئت. */
  focusSessions: number;
  /** الدقائق التي قُضيت فعلاً في التركيز، ولو قُطعت الجلسة. */
  focusMinutes: number;
  /** توزيع المنجَز على الأرباع، بترتيب المصفوفة. */
  byQuadrant: { quadrant: Quadrant; title: string; count: number }[];
  /** المنجَز بلا ربع: أُنجزت دون أن تُصنَّف يوماً. */
  unclassified: number;
}

/**
 * دقائق جلسة واحدة.
 *
 * تُقاس من الساعة لا من النيّة: من خطّط خمسين دقيقة وأغلق بعد عشر قضى عشراً.
 * ويُسقَف بما خُطِّط لأن تبويباً تُرك مفتوحاً ليلةً كاملة ليس ليلةَ تركيز —
 * والجلسة التي لم تُغلق لا تُحسب أصلاً.
 */
export function sessionMinutes(session: FocusSession): number {
  if (!session.endedAt) return 0;
  const spent = (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000;
  if (!Number.isFinite(spent) || spent <= 0) return 0;
  return Math.round(Math.min(spent, session.plannedMinutes));
}

export function summarize(completed: Task[], sessions: FocusSession[]): Statistics {
  const counts = new Map<Quadrant, number>();
  let unclassified = 0;

  for (const task of completed) {
    if (task.quadrant) counts.set(task.quadrant, (counts.get(task.quadrant) ?? 0) + 1);
    else unclassified += 1;
  }

  return {
    completedTasks: completed.length,
    focusSessions: sessions.filter(session => session.completed).length,
    focusMinutes: sessions.reduce((total, session) => total + sessionMinutes(session), 0),
    // الأرباع الأربعة كلها، ولو كان بعضها صفراً: الصفر خبر أيضاً.
    byQuadrant: QUADRANTS.map(quadrant => ({
      quadrant: quadrant.id,
      title: quadrant.title,
      count: counts.get(quadrant.id) ?? 0,
    })),
    unclassified,
  };
}

/** «ساعتان و١٥ دقيقة» — الدقائق وحدها تصير غير مقروءة بعد المئة. */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} دقيقة`;

  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  const hoursLabel = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : hours <= 10 ? `${hours} ساعات` : `${hours} ساعة`;
  return rest ? `${hoursLabel} و${rest} دقيقة` : hoursLabel;
}

/** بداية أمسِ سبعة: المدة الافتراضية للإحصاء. */
export function lastWeekStart(now: Date = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}
