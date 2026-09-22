import { useSearch } from "wouter";

/**
 * المهمة التي جاء إليها المستخدم، إن جاء من بطاقتها.
 *
 * الطرق الثلاث تُفتح وحدها أو من صفّ مهمة بعينها — و`?task=` هو ما يفرّق
 * بينهما. لا يُنشئ شيئاً ولا يغيّر شيئاً: يقول أيّ مهمة قائمة يُبدأ بها.
 */
export function useTaskParam(): string | null {
  const search = useSearch();
  const id = new URLSearchParams(search).get("task");
  // معرّف مشوّه في الرابط يُعامَل كلا شيء، فلا تُفتح الصفحة على خطأ.
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
