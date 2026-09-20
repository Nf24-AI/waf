/**
 * باب واف صار المنصّة لا الاجتماعات. من يفتح الجذر يرى الخدمات ويختار،
 * وأداة الاجتماعات انتقلت إلى مسارها الخاص بدل أن تحتلّ الجذر وحدها.
 */
export const PLATFORM_ROUTE = "/";

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
