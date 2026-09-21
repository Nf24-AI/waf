import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * تنعيم التمرير على صفحة الهبوط وحدها.
 *
 * Lenis يعترض العجلة ويستوفي الموضع بين إطار وإطار، فيزول التقطّع الذي
 * يتركه التمرير المتدرّج على سطح المكتب. أمّا اللمس فيُترك للنظام
 * (`syncTouch: false`): تنعيمه يدوياً يُدخل تأخيراً محسوساً على الجوال،
 * وتمرير الأصابع أصلاً سلس.
 *
 * المراسي تُسلَّم إلى `anchors` لا إلى معالج ضغط مكتوب بيدنا: Lenis يحتفظ
 * بموضع تمرير خاص به، وأي نداء خارجي لـ window.scrollTo ينازعه فيبتلعه —
 * وهو ما حدث فعلاً: تغيّر الـhash ولم تتحرّك الصفحة.
 *
 * ولا يعمل شيء من هذا مع prefers-reduced-motion: من طلب تقليل الحركة يريد
 * تمريرته كما تعطيه إيّاها منصّته، والمرساة تعود إلى قفز المتصفح الفوري.
 */
export function useSmoothScroll(enabled: boolean, headerOffset: number) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.05,
      // منحنى يهدأ في آخره: يصل إلى الموضع دون أن يتأرجح حوله.
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.6,
      anchors: { offset: -headerOffset },
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [enabled, headerOffset]);
}
