import { type Task } from "./tasks";

/**
 * المشروع — حاوية للمهام، لا كيان يملك تقدّماً خاصاً به.
 *
 * التقدّم لا يُخزَّن: يُحسب من مهامه عند القراءة. عمودٌ اسمه `progress`
 * يُحدَّث عند كل تغيير يتباعد أوّل ما تُحذف مهمة أو تُنقل، ولا يُكتشف
 * انحرافه لأن لا شيء يقارنه بشيء — نفس القاعدة التي بُني عليها باقي المنتج.
 */

/** ألوان المشاريع — مسمّاة لا حرّة، فتبقى اللوحة متماسكة. */
export const PROJECT_COLORS = ["accent", "go", "warn", "purple", "danger"] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
  createdAt: string;
}

export interface ProjectProgress {
  project: Project;
  total: number;
  done: number;
  /** نسبة مئوية مدوّرة. بلا مهام تساوي صفراً لا مئة. */
  percent: number;
}

/**
 * تقدّم مشروع من مهامه.
 *
 * مشروعٌ بلا مهام يقرأ صفراً لا مئة: «لا شيء فيه» و«كلّه منجَز» حالان
 * مختلفتان، وجعلهما مئةً يكافئ الفراغ.
 */
export function progressOf(project: Project, tasks: Task[]): ProjectProgress {
  const mine = tasks.filter(task => task.projectId === project.id);
  const done = mine.filter(task => task.completedAt).length;
  return {
    project,
    total: mine.length,
    done,
    percent: mine.length === 0 ? 0 : Math.round((done / mine.length) * 100),
  };
}

export function allProgress(projects: Project[], tasks: Task[]): ProjectProgress[] {
  return projects.map(project => progressOf(project, tasks));
}

/** «8 من 12 مهمة» — كما في المرجع. */
export function progressLabel(progress: ProjectProgress, lang: "ar" | "en" = "ar"): string {
  if (lang === "en") {
    if (progress.total === 0) return "No tasks yet";
    return `${progress.done} of ${progress.total} ${progress.total === 1 ? "task" : "tasks"}`;
  }
  if (progress.total === 0) return "لا مهام بعد";
  return `${progress.done} من ${progress.total} مهمة`;
}
