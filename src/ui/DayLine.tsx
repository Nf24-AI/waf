// «خط اليوم»: الأفق في صورة تنومة صار مسطرة للوقت. يمتدّ من السادسة صباحاً
// إلى منتصف الليل، يمتلئ بالزعفران حتى الآن، وتظهر عليه مواعيد اليوم علاماتٍ صغيرة.

import { useEffect, useState } from "react";
import { formatClock, t } from "@/lib/i18n";
import { cx } from "./cx";

export const DAY_START = 6 * 60;
export const DAY_END = 24 * 60;

export function useNow(stepMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), stepMs);
    const onVis = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stepMs]);
  return now;
}

/** موضع دقيقة من اليوم على الخط بين ٠ و ١ */
export function dayFraction(minute: number): number {
  return Math.min(1, Math.max(0, (minute - DAY_START) / (DAY_END - DAY_START)));
}

export interface DayMark {
  minute: number;
  label: string;
  tone?: "saffron" | "dusk" | "palm";
}

export function DayLine({
  marks = [],
  draw = false,
  showNow = true,
  className,
  thickness = 2,
}: {
  marks?: DayMark[];
  /** يرسم الخط مرة واحدة عند الظهور (للصفحة الأولى فقط) */
  draw?: boolean;
  showNow?: boolean;
  className?: string;
  thickness?: number;
}) {
  const now = useNow();
  const minute = now.getHours() * 60 + now.getMinutes();
  const f = dayFraction(minute);
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      className={cx("relative w-full", draw && "dayline-draw", className)}
      role="img"
      aria-label={t(`خط اليوم: الساعة الآن ${formatClock(hhmm)}`, `Day line: it is ${formatClock(hhmm)}`)}
      style={{ height: Math.max(thickness, 10) }}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-line" style={{ height: thickness }} />
      <div className="dayline-fill absolute top-1/2 -translate-y-1/2 bg-saffron start-0" style={{ height: thickness, width: `${f * 100}%` }} />
      {marks.map((m, i) => (
        <span
          key={i}
          title={m.label}
          className={cx(
            "absolute top-1/2 h-2.5 w-px -translate-y-1/2",
            m.tone === "dusk" ? "bg-dusk" : m.tone === "palm" ? "bg-palm" : "bg-ink-3",
          )}
          style={{ insetInlineStart: `${dayFraction(m.minute) * 100}%` }}
        />
      ))}
      {showNow && f > 0 && f < 1 && (
        <span
          className="dayline-now absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-saffron ring-4 ring-saffron/20"
          style={{ insetInlineStart: `calc(${f * 100}% - 5px)` }}
          aria-hidden
        />
      )}
    </div>
  );
}
