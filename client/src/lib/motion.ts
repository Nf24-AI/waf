/**
 * هل طلب المستخدم تقليل الحركة؟
 *
 * jsdom لا يعرّف matchMedia، فنداؤه مباشرةً يُسقط أي مكوّن متحرّك في
 * الاختبارات بـ«window.matchMedia is not a function». الفحص هنا مرّة واحدة
 * بدل تكراره عند كل استعمال، والافتراض عند غيابه «لا تقليل»: بيئة بلا
 * matchMedia ليست بيئة عرض أصلاً.
 */
export function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
