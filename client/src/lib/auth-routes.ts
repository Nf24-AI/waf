import {
  ADD_TASK_ROUTE,
  ARCHIVE_ROUTE,
  DECISIONS_ROUTE,
  MEETING_ROUTES,
  SETTINGS_ROUTE,
  STATISTICS_ROUTE,
  STATUS_REPORT_ROUTE,
  TASKS_ROUTE,
  TIME_HOME_ROUTE,
  TIME_MANAGEMENT_ROUTE,
  TIME_METHOD_ROUTES,
} from "@shared/routes";

/**
 * حدّ العامّ والخاصّ — في موضع واحد.
 *
 * تكرار شرط «هل هو مسجَّل؟» في كل صفحة يعني أن الصفحة التي تُنسى تبقى
 * مكشوفة، ولا يُكتشف ذلك إلا بعد أن يجدها أحد. القائمة هنا، والحارس يقرأها.
 *
 * والحدّ الحقيقي في قاعدة البيانات لا هنا: RLS يمنع القراءة أصلاً. هذا
 * للتجربة — أن يُساق الزائر إلى الدخول بدل أن يرى صفحة فارغة وخطأ.
 */

export const LOGIN_ROUTE = "/login";
export const SIGNUP_ROUTE = "/signup";
export const FORGOT_PASSWORD_ROUTE = "/forgot-password";
export const RESET_PASSWORD_ROUTE = "/reset-password";
export const VERIFY_EMAIL_ROUTE = "/verify-email";
export const ABOUT_ROUTE = "/about";
export const SERVICES_ROUTE = "/services";

/** صفحات المصادقة: لا يراها من سجّل دخوله. */
export const AUTH_ROUTES = [
  LOGIN_ROUTE,
  SIGNUP_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  RESET_PASSWORD_ROUTE,
  VERIFY_EMAIL_ROUTE,
] as const;

/** ما يلزمه حساب. */
export const PRIVATE_ROUTES: string[] = [
  TIME_HOME_ROUTE,
  TASKS_ROUTE,
  ADD_TASK_ROUTE,
  TIME_MANAGEMENT_ROUTE,
  TIME_METHOD_ROUTES.eisenhower,
  TIME_METHOD_ROUTES.timeBlocking,
  TIME_METHOD_ROUTES.focus,
  STATISTICS_ROUTE,
  ARCHIVE_ROUTE,
  SETTINGS_ROUTE,
  MEETING_ROUTES.prepare,
  MEETING_ROUTES.display,
  DECISIONS_ROUTE,
  STATUS_REPORT_ROUTE,
];

export function isPrivateRoute(path: string): boolean {
  return PRIVATE_ROUTES.includes(path);
}

export function isAuthRoute(path: string): boolean {
  return (AUTH_ROUTES as readonly string[]).includes(path);
}

/**
 * رابط الدخول حاملاً الوجهة المقصودة.
 *
 * الوجهة تُرمَّز: مسارٌ فيه `?task=` يكسر الرابط بدونها. وتُقصر على مسارات
 * هذا الموقع — وجهة خارجية في `redirect` تجعل صفحة الدخول أداة تحويل إلى أي
 * عنوان، وهي ثغرة معروفة تُستعمل في التصيّد.
 */
export function loginHref(intended?: string): string {
  if (!intended || !intended.startsWith("/") || intended.startsWith("//")) return LOGIN_ROUTE;
  return `${LOGIN_ROUTE}?redirect=${encodeURIComponent(intended)}`;
}

/** الوجهة بعد الدخول: ما طُلب، وإلا الرئيسية. */
export function redirectTarget(search: string): string {
  const raw = new URLSearchParams(search).get("redirect");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return TIME_HOME_ROUTE;
  return raw;
}
