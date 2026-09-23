import { useSearch } from "wouter";
import { ADD_TASK_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";

/**
 * الرحلة المُرشِدة — اختيارية، لا هيكل المنتج.
 *
 * الطرق الثلاث أدوات لا خطوات: تُفتح كل واحدة وحدها في أي وقت، على مهمة
 * قائمة أو بلا مهمة. لكن من يضيف مهمة جديدة يستفيد من أن يُقاد مرّة —
 * فيُعرض له الطريق: أضف، صنّف، احجز، ابدأ.
 *
 * والفرق كله في `?flow=new`: بوجوده تظهر نقاط التقدّم وزرّ «التالي»، وبدونه
 * تكون الصفحة نفسها أداةً قائمة بذاتها بلا أثرٍ للرحلة. فالبيانات واحدة
 * والمسارات واحدة، والرحلة طبقة عرضٍ فوقها لا نظامٌ ثانٍ.
 */

export const FLOW_KEY = "flow";
export const FLOW_NEW = "new";

export const FLOW_STEPS = [
  { id: "add", label: "إضافة المهمة", route: ADD_TASK_ROUTE },
  { id: "classify", label: "التصنيف", route: TIME_METHOD_ROUTES.eisenhower },
  { id: "schedule", label: "حجز الوقت", route: TIME_METHOD_ROUTES.timeBlocking },
  { id: "focus", label: "التركيز", route: TIME_METHOD_ROUTES.focus },
] as const;

export type FlowStepId = (typeof FLOW_STEPS)[number]["id"];

export function stepIndex(id: FlowStepId): number {
  return FLOW_STEPS.findIndex(step => step.id === id);
}

/** الخطوة التالية، أو `null` عند آخر الطريق. */
export function nextStep(id: FlowStepId): (typeof FLOW_STEPS)[number] | null {
  return FLOW_STEPS[stepIndex(id) + 1] ?? null;
}

/**
 * رابط خطوةٍ في الرحلة، حاملاً المهمة والعَلَم.
 *
 * المهمة تُمرَّر في الرابط لا في حالة عامّة: من يحدّث الصفحة أو يفتح الرابط
 * في لسانٍ آخر يجد نفسه في نفس الموضع من نفس المهمة.
 */
export function flowHref(route: string, taskId: string): string {
  return `${route}?task=${taskId}&${FLOW_KEY}=${FLOW_NEW}`;
}

export function useInFlow(): boolean {
  const search = useSearch();
  return new URLSearchParams(search).get(FLOW_KEY) === FLOW_NEW;
}
