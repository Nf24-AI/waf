// أفق الجلسة: خط طويل يمتلئ بالزعفران مع مرور الوقت، والنقطة المضيئة عند «الآن».
// صدى لخط اليوم في رأس التطبيق، لكنه هنا يقيس الجلسة نفسها.

import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/ui/cx";

export function Horizon({
  fraction,
  running,
  tone = "saffron",
  start,
  end,
  ticks = [],
  label,
  className,
}: {
  fraction: number;
  running: boolean;
  tone?: "saffron" | "palm";
  start?: ReactNode;
  end?: ReactNode;
  /** علامات صغيرة على الخط (نسب بين ٠ و ١) */
  ticks?: number[];
  /** وصف للقارئ الآلي */
  label: string;
  className?: string;
}) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <div className={cx("w-full", className)}>
      <div className="fh-clip">
      <div
        className="fh"
        data-tone={tone}
        data-running={running}
        style={{ "--f": f } as CSSProperties}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(f * 100)}
      >
        <div className="fh-track" />
        {ticks.map((x) => (
          <span key={x} className="fh-tick" style={{ insetInlineStart: `${x * 100}%` }} aria-hidden />
        ))}
        <div className="fh-fill" aria-hidden />
        <div className="fh-rail" aria-hidden>
          <span className="fh-dot" />
        </div>
      </div>
      </div>
      {(start || end) && (
        <div className="tnum mt-2 flex items-start justify-between gap-4 text-xs text-ink-3 sm:text-sm">
          <span>{start}</span>
          <span className="text-end">{end}</span>
        </div>
      )}
    </div>
  );
}
