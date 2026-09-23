import { useAuthSession } from "@/contexts/AuthContext";
import { loginHref } from "@/lib/auth-routes";

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

