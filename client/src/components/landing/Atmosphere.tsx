// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { prefersReducedMotion } from "@/lib/motion";
import tanomah from "@/assets/village-at-dusk.jpg";

/**
 * جبال واف: بيئة واحدة تمتدّ خلف الصفحة كلّها، لا صورة تتكرّر في كل قسم.
 *
 * الطبقة ثابتة في إطار العرض (fixed) خلف كل شيء، فلا تنقطع بين قسم وقسم
 * ولا تظهر ولا تختفي عند حدودهما. ما يحجبها هو ما فوقها: لوحة الهيرو
 * وصورة «عن واف» معتمتان، وبينهما تُرى.
 *
 * تزداد حضوراً كلّما نزل القارئ — كما يُطلب — وتنزاح انزياحاً أبطأ من
 * المحتوى بمقدار ٢٦ بكسل على طول الصفحة: يكفي ليُحسّ أن البيئة تتحرّك،
 * ولا يكفي ليُقال إن هناك parallax.
 *
 * القرية تشغل الخُمس الأسفل من الصورة ولا مكان لها هنا — مكانها «عن واف».
 * فتُمدّ الطبقة أطول من الشاشة بمقدار ذلك الخُمس ويقصّ overflow أسفلها:
 * قصٌّ لا تشويه، فالنِّسب كما هي عند كل مقاس.
 */
export default function Atmosphere() {
  const reduced = prefersReducedMotion();
  const { scrollYProgress } = useScroll();

  // أبطأ من المحتوى، وبمقدار لا يُلاحَظ إلا كإحساس.
  const y = useTransform(scrollYProgress, [0, 1], [0, 26]);
  const opacity = useTransform(scrollYProgress, [0, 0.45, 1], [0.5, 0.62, 0.74]);

  return (
    <div className="waf-atmos" aria-hidden="true">
      <motion.div
        className="waf-atmos-layer"
        style={{
          "--waf-atmos-src": `url(${tanomah})`,
          y: reduced ? 0 : y,
          opacity: reduced ? 0.6 : opacity,
        } as React.CSSProperties}
      />
      <div className="waf-atmos-veil" />
    </div>
  );
}
