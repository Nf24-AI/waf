/**
 * الجذر هو الوجه العام: من يفتح العنوان يرى واف قبل أن يُسأل شيئاً.
 *
 * صفحة هبوط على مسار جانبي لا يصلها إلا من يعرف عنوانها، فلا تؤدّي عملها.
 * وهي وحدها من بين المسارات تُقرأ قبل كلمة المرور — انظر App.tsx.
 */
export const LANDING_ROUTE = "/";

/**
 * المنصّة: شبكة الخدمات خلف البوّابة. انتقلت عن الجذر ليحلّ محلّها الوجه
 * العام، ومن كان يفتح الجذر يصل إليها بضغطة «ادخل المنصّة».
 */
export const PLATFORM_ROUTE = "/platform";

/** العنوان القديم للوجه العام؛ يُبقى عاملاً فلا ينكسر رابط حُفظ أو شُورك. */
export const LEGACY_LANDING_ROUTE = "/welcome";

export const DECISIONS_ROUTE = "/decisions";
export const STATUS_REPORT_ROUTE = "/status";

export const MEETING_ROUTES = {
  prepare: "/meetings",
  display: "/display",
} as const;

/** المعامِل الذي يفتح به مسار الاجتماعات اجتماعاً بعينه. */
export const MEETING_PARAM = "meeting";

/**
 * رابط يفتح اجتماعاً محدّداً.
 *
 * سجلّ القرارات يَعِد بأن تعود إلى الاجتماع الذي اتُّخذ فيه القرار، ورابط إلى
 * القائمة وحدها يكسر هذا الوعد حين تكون القرارات من اجتماعات كثيرة. الشكل
 * معرّف هنا لا في الصفحات، فلا يتباعد الطرفان.
 */
export function meetingHref(meetingId?: string) {
  const id = (meetingId ?? "").trim();
  if (!id) return MEETING_ROUTES.prepare;
  return `${MEETING_ROUTES.prepare}?${MEETING_PARAM}=${encodeURIComponent(id)}`;
}
