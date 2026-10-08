import { QUADRANTS, TASK_CATEGORIES, type Quadrant, type TaskCategory } from "@shared/tasks";
import { getLang } from "./i18n";

/**
 * تسميات نموذج المهمة بلغة الواجهة.
 *
 * النصّان يسكنان `shared/tasks.ts` بجانب ما يسمّيانه، لأن الخادم يقرأ الملف
 * نفسه ولا يعرف لغة أحد. وهنا يُختار أحدهما — في العميل وحده.
 */

export function categoryLabel(id: TaskCategory): string {
  const found = TASK_CATEGORIES.find(item => item.id === id)!;
  return getLang() === "ar" ? found.label : found.labelEn;
}

export function quadrantLabel(id: Quadrant): string {
  const found = QUADRANTS.find(item => item.id === id)!;
  return getLang() === "ar" ? found.title : found.titleEn;
}

export function quadrantVerbLabel(id: Quadrant): string {
  const found = QUADRANTS.find(item => item.id === id)!;
  return getLang() === "ar" ? found.verb : found.verbEn;
}
