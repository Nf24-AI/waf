// شريط «نظام واف»: يظهر فقط حين يعمل الإطار داخل النظام المترابط (origin = "waf").
// الخطوات تسلسل حقيقي، فالترقيم هنا معلومة لا زينة.

import { Link, useLocation } from "wouter";
import type { TaskOrigin } from "@/data/types";
import { t } from "@/lib/i18n";
import { cx } from "@/ui/cx";

const STEPS = [
  { href: "/waf/matrix", ar: "صنّف", en: "Sort", hint: ["اكتب مهامك وضعها في رُبعها", "Write your tasks and place each one"] },
  { href: "/waf/blocks", ar: "احجز", en: "Book", hint: ["أعطِ كل مهمة ساعتها", "Give each task its hour"] },
  { href: "/waf/focus", ar: "ركّز", en: "Focus", hint: ["اعمل على المهمة حتى تُنجَز", "Work the task until it’s done"] },
] as const;

/** رابط الإطار حسب المصدر: داخل النظام أو مستقلاً */
export function frameworkHref(origin: TaskOrigin, kind: "matrix" | "blocks" | "focus"): string {
  return origin === "waf" ? `/waf/${kind}` : `/time/${kind}`;
}

export function FlowSteps({ origin, className }: { origin: TaskOrigin; className?: string }) {
  const [path] = useLocation();
  if (origin !== "waf") return null;
  const current = STEPS.findIndex((s) => path.startsWith(s.href));
  return (
    <nav aria-label={t("خطوات نظام واف", "Waf system steps")} className={cx("no-print mb-6", className)}>
      <ol className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
        {STEPS.map((s, i) => {
          const on = i === current;
          const done = i < current;
          return (
            <li key={s.href} className="bg-sheet">
              <Link href={s.href} aria-current={on ? "step" : undefined} className={cx("relative flex h-full flex-col gap-0.5 px-3 py-2.5 transition-colors sm:px-4", on ? "bg-sheet" : "hover:bg-sunk")}>
                <span className="flex items-baseline gap-2">
                  <span className={cx("tnum font-display text-xs", on || done ? "text-saffron-ink" : "text-ink-3")}>{i + 1}</span>
                  <span className={cx("font-display text-base font-semibold", on ? "text-ink" : "text-ink-2")}>{t(s.ar, s.en)}</span>
                </span>
                <span className="hidden text-xs text-ink-3 sm:block">{t(s.hint[0], s.hint[1])}</span>
                <span className={cx("absolute inset-x-0 bottom-0 h-0.5", on ? "bg-saffron" : done ? "bg-saffron/40" : "bg-transparent")} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
