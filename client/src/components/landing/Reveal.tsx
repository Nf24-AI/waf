// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { motion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * ظهور عند الدخول: شفافية وإزاحة رأسية صغيرة، لا أكثر.
 *
 * framer-motion مثبّت في المشروع أصلاً، فلا داعي لنظام حركة ثانٍ. و`once`
 * مقصود: الحركة التي تتكرّر كلّما مرّ المستخدم بالعنصر تصير ضجيجاً، والقسم
 * الذي قُرئ مرّة يبقى مقروءاً.
 *
 * مع تقليل الحركة يُرسم المحتوى في مكانه بلا إزاحة ولا تلاشٍ — لا ينتظر
 * مراقباً ولا مؤقّتاً.
 */
export default function Reveal({
  children,
  delay = 0,
  as = "div",
  className,
}: {
  children: React.ReactNode;
  /** تأخير بالثواني، لترتيب العناصر داخل القسم الواحد. */
  delay?: number;
  as?: "div" | "section";
  className?: string;
}) {
  const reduced = prefersReducedMotion();
  const Tag = as === "section" ? motion.section : motion.div;

  if (reduced) {
    const Plain = as === "section" ? "section" : "div";
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.68, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}
