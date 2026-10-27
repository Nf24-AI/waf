// مدخل الوقت: تختار كيف تعمل. ثلاثة إطارات كلٌّ منها جزيرة مستقلة،
// و«نظام واف» طريق واحد متّصل تحمل فيه المهمة نفسها من خطوة إلى التي تليها.

import { CalendarRange, Grid2x2, Timer } from "lucide-react";
import { Link } from "wouter";
import { PageHead } from "@/app/AppShell";
import { t } from "@/lib/i18n";
import { ButtonLink } from "@/ui/Button";
import { cx } from "@/ui/cx";

const FRAMEWORKS = [
  {
    href: "/time/matrix",
    icon: Grid2x2,
    name: ["مصفوفة أيزنهاور", "Eisenhower matrix"],
    line: ["رتّب مهامك بين المهم والعاجل، فيظهر ما يستحق وقتك اليوم وما يُفوَّض أو يُترك.", "Sort your tasks by important and urgent, so you see what deserves your time today and what to delegate or drop."],
  },
  {
    href: "/time/blocks",
    icon: CalendarRange,
    name: ["حجز الوقت", "Time blocking"],
    line: ["ضع يومك على جدول واحد: لكل مهمة ساعتها، وترى أين يذهب وقتك قبل أن يذهب.", "Put your day on one schedule: each task gets its hour, and you see where your time goes before it goes."],
  },
  {
    href: "/time/focus",
    icon: Timer,
    name: ["جلسة التركيز", "Focus session"],
    line: ["مؤقّت وبومودورو وساعة إيقاف على مسرح واحد، مع أصوات تعينك على البقاء فيما بين يديك.", "Timer, Pomodoro and stopwatch on one stage, with sounds that help you stay with what’s in front of you."],
  },
] as const;

/** مثال واحد يمرّ بالخطوات الأربع: المهمة نفسها في كل مرحلة */
const FLOW = [
  { verb: ["اكتب", "Write"], line: ["كل ما عليك، مرة واحدة.", "Everything on your plate, once."], state: ["تجهيز عرض مجلس الإدارة", "Prepare the board deck"] },
  { verb: ["صنّف", "Sort"], line: ["المهم والعاجل في المصفوفة.", "Important and urgent, in the matrix."], state: ["مهم وعاجل", "Important, urgent"] },
  { verb: ["احجز", "Book"], line: ["لها ساعتها على جدول اليوم.", "It gets its hour on today’s schedule."], state: ["من 4:30 إلى 6:00 م", "4:30 – 6:00 PM"] },
  { verb: ["ركّز", "Focus"], line: ["جلسة عليها حتى تُنجَز.", "A session on it until it’s done."], state: ["جلسة 50 دقيقة", "50-minute session"] },
] as const;

export default function TimeHub() {
  return (
    <div>
      <PageHead
        title={t("إدارة الوقت", "Time")}
        lede={t("اختر كيف تعمل اليوم: إطار واحد وحده، أو الثلاثة معاً في نظام واف.", "Choose how you work today: one framework on its own, or all three together in the Waf system.")}
      />

      {/* ───── كلٌّ وحده ───── */}
      <section aria-labelledby="alone-title" className="mt-10">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="alone-title" className="font-display text-xl font-semibold">
            {t("كلٌّ وحده", "Each on its own")}
          </h2>
          <p className="text-sm text-ink-2">{t("لا إعداد قبله، ولا يحتاج أحدها الآخر. لكل إطار مهامه.", "No setup, and none needs the others. Each keeps its own tasks.")}</p>
        </div>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {FRAMEWORKS.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.href}>
                <Link href={f.href} className="press group flex h-full flex-col rounded-md border border-line bg-sheet p-5 transition-colors hover:border-line-strong">
                  <Icon className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
                  <span className="mt-6 font-display text-xl font-semibold group-hover:text-dusk">{t(f.name[0], f.name[1])}</span>
                  <span className="mt-1.5 flex-1 text-sm text-ink-2">{t(f.line[0], f.line[1])}</span>
                  <span className="mt-5 text-sm font-medium text-ink">{t("ادخل الإطار", "Open")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ───── معاً ───── */}
      <section aria-labelledby="together-title" className="mt-14 rounded-lg border border-line bg-sheet p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="max-w-xl">
            <h2 id="together-title" className="font-display text-2xl font-semibold">
              {t("معاً: نظام واف", "Together: the Waf system")}
            </h2>
            <p className="mt-2 text-ink-2">
              {t(
                "تكتب المهمة مرة، ثم تنتقل هي نفسها من التصنيف إلى الجدول إلى جلسة التركيز. مهام النظام منفصلة عن مهام الإطارات المستقلة.",
                "Write a task once, and that same task moves from sorting to the schedule to a focus session. The system keeps its tasks apart from the standalone frameworks.",
              )}
            </p>
          </div>
          <ButtonLink href="/waf/matrix" variant="saffron" className="max-sm:h-11 max-sm:w-full">
            {t("ابدأ نظام واف", "Start the Waf system")}
          </ButtonLink>
        </div>

        <ol className="relative mt-8 grid gap-6 sm:grid-cols-4 sm:gap-4">
          {FLOW.map((s, i) => (
            <li key={s.verb[0]} className="relative ps-8 sm:ps-0 sm:pt-8">
              {/* الخيط إلى الخطوة التالية */}
              {i < FLOW.length - 1 && (
                <span className="absolute start-[7px] top-4 -bottom-6 w-0.5 bg-saffron/70 sm:start-4 sm:-end-4 sm:top-[7px] sm:bottom-auto sm:h-0.5 sm:w-auto" aria-hidden />
              )}
              <span className={cx("absolute start-0 top-0 size-4 rounded-full border-2 border-saffron", i === FLOW.length - 1 ? "bg-saffron" : "bg-sheet")} aria-hidden />
              <p className="flex items-baseline gap-2">
                <span className="tnum font-display text-sm text-saffron-ink">{i + 1}</span>
                <span className="font-display text-xl font-semibold">{t(s.verb[0], s.verb[1])}</span>
              </p>
              <p className="mt-1 text-sm text-ink-2">{t(s.line[0], s.line[1])}</p>
              <p className="tnum mt-3 inline-flex max-w-full rounded-sm border border-line bg-bg px-2.5 py-1 text-xs text-ink-2">
                <span className="truncate">{t(s.state[0], s.state[1])}</span>
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-ink-3">{t("المثال: مهمة واحدة تمرّ بالخطوات الأربع.", "Example: one task carried through all four steps.")}</p>
      </section>
    </div>
  );
}
