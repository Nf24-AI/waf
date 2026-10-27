// خطوات التحضير الخمس: الخطوة التالية بسؤالها ومثالها، والجاهزية بنسبتها.
// الخطوة النشطة بالزعفران لأنها «ما يحتاج انتباهك الآن».

import { Check } from "lucide-react";
import type { Meeting } from "@/data/types";
import { t } from "@/lib/i18n";
import { prepareSteps, readiness, type PrepareStepId } from "@/lib/meetings";
import { cx } from "@/ui/cx";
import { stepCopy } from "./model";

const TARGET: Record<PrepareStepId, string> = {
  basics: "sec-basics",
  goal: "sec-goal",
  agenda: "sec-agenda",
  people: "sec-people",
  followups: "sec-followups",
};

function goTo(step: PrepareStepId) {
  const el = document.getElementById(TARGET[step]);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  const field = el.querySelector<HTMLElement>("input, textarea, select");
  field?.focus({ preventScroll: true });
}

export function PrepRail({ meeting, className }: { meeting: Meeting; className?: string }) {
  const steps = prepareSteps(meeting);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const pct = readiness(meeting);
  const nextCopy = next ? stepCopy(next.id) : null;

  return (
    <aside className={cx("min-w-0 self-start xl:sticky xl:top-[5.5rem]", className)} aria-labelledby="prep-h">
      <div className="rounded-md border border-line bg-sheet p-4 sm:p-5 xl:border-0 xl:bg-transparent xl:p-0 xl:pt-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="prep-h" className="font-display text-base font-semibold">
              {t("التحضير", "Preparation")}
            </h2>
            <p className="tnum text-xs text-ink-3">{t(`${done} من 5 خطوات`, `${done} of 5 steps`)}</p>
          </div>
          <p className="text-end">
            <span className="tnum font-display text-3xl leading-none font-semibold">{pct}%</span>
            <span className="block text-xs text-ink-3">{t("جاهزية الاجتماع", "Readiness")}</span>
          </p>
        </div>

        {/* الخطوات قطعاً متجاورة على الشاشات الصغيرة */}
        <ol className="mt-4 flex gap-1 xl:hidden" aria-label={t("خطوات التحضير", "Preparation steps")}>
          {steps.map((s) => {
            const c = stepCopy(s.id);
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  aria-current={isNext ? "step" : undefined}
                  aria-label={`${c.name}${s.done ? t(" (تمّت)", " (done)") : ""}`}
                  className="press flex h-11 w-full flex-col justify-center gap-1.5"
                >
                  <span className={cx("block h-1 w-full rounded-full", isNext ? "bg-saffron" : s.done ? "bg-palm" : "bg-line-strong/70")} />
                  <span className={cx("truncate text-[11px] leading-none", isNext ? "font-medium text-ink" : "text-ink-3")}>{c.name}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* القائمة الكاملة بجانب المحرّر على الشاشات العريضة */}
        <ol className="mt-6 hidden xl:block" aria-label={t("خطوات التحضير", "Preparation steps")}>
          {steps.map((s, i) => {
            const c = stepCopy(s.id);
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} className="relative">
                {i < steps.length - 1 && <span className={cx("absolute start-[11px] top-8 bottom-0 w-px", s.done ? "bg-palm/40" : "bg-line")} aria-hidden />}
                <button type="button" onClick={() => goTo(s.id)} aria-current={isNext ? "step" : undefined} className="press group flex w-full items-start gap-3 rounded-sm py-1.5 text-start">
                  <span
                    className={cx(
                      "tnum mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      s.done ? "bg-palm-wash text-palm" : isNext ? "bg-saffron text-on-saffron" : "border border-line-strong text-ink-3",
                    )}
                  >
                    {s.done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span className={cx("pt-0.5 text-sm group-hover:text-ink", isNext ? "font-medium text-ink" : s.done ? "text-ink-2" : "text-ink-3")}>
                    {c.name}
                    {s.done && <span className="sr-only">{t(" (تمّت)", " (done)")}</span>}
                  </span>
                </button>
                <div className={cx("ms-9 pb-4", isNext ? "pt-1" : "pb-3")}>
                  {isNext && (
                    <>
                      <p className="text-sm leading-relaxed text-ink">{c.question}</p>
                      <p className="mt-2 text-xs leading-relaxed text-ink-3">{c.example}</p>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* الخطوة التالية بسؤالها على الشاشات الصغيرة */}
        <div className="mt-3 xl:hidden" aria-live="polite">
          {nextCopy && next ? (
            <button type="button" onClick={() => goTo(next.id)} className="press block w-full rounded-sm text-start">
              <p className="text-sm font-medium">{nextCopy.question}</p>
              <p className="mt-1 text-xs text-ink-3">{nextCopy.example}</p>
            </button>
          ) : (
            <p className="text-sm text-palm">{t("الاجتماع جاهز. اعرضه حين يبدأ.", "The meeting is ready. Present it when it starts.")}</p>
          )}
        </div>
        {!next && <p className="mt-2 hidden text-sm text-palm xl:block">{t("الاجتماع جاهز. اعرضه حين يبدأ.", "The meeting is ready. Present it when it starts.")}</p>}
      </div>
    </aside>
  );
}
