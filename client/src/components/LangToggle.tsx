import React from "react";
import { getLang, setLang } from "@/lib/i18n";

/**
 * مبدّل اللغة: زرّ واحد يعرض اللغة التي ستنتقل إليها.
 *
 * «English» مكتوبة بالإنجليزية و«العربية» بالعربية: من لا يقرأ لغة الواجهة
 * الحالية هو بالذات من يبحث عن هذا الزرّ، فيجب أن يقرأه بلغته.
 */
export default function LangToggle({ className, short = false }: { className?: string; short?: boolean }) {
  const next = getLang() === "ar" ? "en" : "ar";
  const label = next === "en" ? (short ? "EN" : "English") : short ? "ع" : "العربية";

  return (
    <button
      type="button"
      className={className}
      lang={next}
      aria-label={next === "en" ? "Switch to English" : "التبديل إلى العربية"}
      onClick={() => setLang(next)}
    >
      {label}
    </button>
  );
}
