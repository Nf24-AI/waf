import { useAuthSession } from "@/contexts/AuthContext";
import { LOGIN_ROUTE, SIGNUP_ROUTE, loginHref } from "@/lib/auth-routes";
import { TIME_HOME_ROUTE } from "@shared/routes";

/**
 * باب الخدمة — واحد لكل بطاقة، ويعرف من يقف أمامه.
 *
 * البديل أن تكتب كل بطاقة شرطها بنفسها، فتُنسى واحدة وتقود زائراً إلى صفحة
 * خاصّة يراها فارغة ومعها خطأ. الشرط هنا مرّة واحدة.
 *
 * ولا رسالة «غير مسموح»: الزائر لم يُخطئ، هو فقط لم يسجّل بعد. يُنقل إلى
 * الدخول حاملاً وجهته، فيعود إليها بعد لحظة.
 */
export function serviceHref(route: string, signedIn: boolean): string {
  return signedIn ? route : loginHref(route);
}

export function useServiceHref(route: string): string {
  const { user, loading } = useAuthSession();

  // أثناء الانتظار نفترض الحاجة إلى الدخول: الرابط يُصحَّح قبل أن يُضغط،
  // والعكس — افتراض التسجيل — يومض بصفحة خاصّة ثم يقذف.
  return serviceHref(route, !loading && Boolean(user));
}

/**
 * «ابدأ الآن» — دعوة واحدة تتصرّف بحسب حالك.
 *
 * إرسال مسجَّلٍ إلى صفحة التسجيل يقول له إن المنتج لا يعرفه، وهو يعرفه.
 */
export function useStartHref(): string {
  const { user, loading } = useAuthSession();
  if (loading) return SIGNUP_ROUTE;
  return user ? TIME_HOME_ROUTE : SIGNUP_ROUTE;
}

export { LOGIN_ROUTE, SIGNUP_ROUTE };
