import { TASK_CATEGORIES, type TaskCategory } from "@shared/tasks";
import { supabase } from "./supabase";

/**
 * أسماء الفئات كما سمّاها صاحبها — محفوظةً في حسابه لا في متصفّحه.
 *
 * تُكتب في `user_metadata` من حساب Supabase: خمسة أسماء قصيرة لا تستحقّ جدولاً
 * ولا ترحيلاً، وهي لصاحب الحساب وحده بحكم مكانها. والمتصفّح يبقى نسخةً
 * قريبة تُعرض فوراً، فلا ترتدّ الأسماء إلى أصلها لحظةَ فتح الصفحة.
 */

export type CategoryLabels = Partial<Record<TaskCategory, string>>;

const KEY = "timeblock_labels";
export const LABEL_MAX = 24;

const DEFAULTS = Object.fromEntries(TASK_CATEGORIES.map(item => [item.id, item.label])) as Record<TaskCategory, string>;

/**
 * ما يصحّ حفظه من الأسماء.
 *
 * الفارغ والمطابق للأصل يسقطان: اسمٌ هو الأصل نفسه ليس تسميةً، وحفظه يجمّد
 * الأصل على صاحبه لو تغيّر يوماً. وما ليس فئةً نعرفها لا يُكتب أصلاً.
 */
export function cleanLabels(input: unknown): CategoryLabels {
  if (!input || typeof input !== "object") return {};
  const labels: CategoryLabels = {};
  for (const { id } of TASK_CATEGORIES) {
    const raw = (input as Record<string, unknown>)[id];
    if (typeof raw !== "string") continue;
    const name = raw.trim().slice(0, LABEL_MAX);
    if (name && name !== DEFAULTS[id]) labels[id] = name;
  }
  return labels;
}

/**
 * الأسماء من الحساب. `null` حين لا حساب أو لم يُحفظ فيه شيء بعد — وهو غير
 * «حُفظ ولا تسمية»: الأول يترك ما في المتصفّح، والثاني يمحوه.
 *
 * `getUser` لا الجلسة المخزّنة: الجلسة تحمل ما كان عند آخر تجديد للرمز، فمن
 * سمّى فئةً على جوّاله لا يراها على حاسوبه إلا بعد ساعة.
 */
export async function loadAccountLabels(): Promise<CategoryLabels | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const saved = data.user.user_metadata?.[KEY];
  return saved === undefined || saved === null ? null : cleanLabels(saved);
}

/** يحفظ الأسماء في الحساب. `false` حين لا حساب يُحفظ فيه (المعاينة المحلية). */
export async function saveAccountLabels(labels: CategoryLabels): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.auth.updateUser({ data: { [KEY]: cleanLabels(labels) } });
  if (error) throw new Error("تعذّر حفظ أسماء الفئات في حسابك. حاول مرة أخرى.");
  return true;
}
