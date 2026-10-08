// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { Link } from "wouter";
import { type Task } from "@shared/tasks";
import { STATISTICS_ROUTE } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import { locale, t } from "@/lib/i18n";
import { quadrantLabel } from "@/lib/task-labels";
import { trpc } from "@/lib/trpc";

/**
 * الأرشيف — ما أُنجز، مرتّباً بيومه.
 *
 * صفحة المتابعة تَعِد بهذه الصفحة («المكتملة في الأرشيف»)، وصفحة تَعِد بما لا
 * يوجد أسوأ من غياب الميزة. وهنا تُقرأ فقط: لا إعادة فتح ولا حذف — المنجَز
 * حدث، والسجلّ الذي يُعدَّل ليس سجلّاً.
 */

/** «الثلاثاء ٢٢ سبتمبر» — العنوان الذي يُفصل به اليوم عمّا قبله. */
function dayTitle(iso: string): string {
  return new Date(iso).toLocaleDateString(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** المنجَز مجموعاً بيومه، بالترتيب الذي جاء به من الخادم (الأحدث أولاً). */
export function groupByDay(tasks: Task[]): { day: string; tasks: Task[] }[] {
  const days: { day: string; tasks: Task[] }[] = [];

  for (const task of tasks) {
    if (!task.completedAt) continue;
    const day = task.completedAt.slice(0, 10);
    const last = days[days.length - 1];
    if (last?.day === day) last.tasks.push(task);
    else days.push({ day, tasks: [task] });
  }

  return days;
}

export default function Archive() {
  const status = trpc.tasks.status.useQuery();
  const enabled = status.data?.configured === true;
  const completed = trpc.tasks.listCompleted.useQuery(undefined, { enabled });

  const days = useMemo(() => groupByDay(completed.data ?? []), [completed.data]);

  return (
    <TimeLayout>
      <div className="tm-inner">
        <header className="tm-head">
          <h1>{t("الأرشيف", "Archive")}</h1>
          <p>{t("ما أنجزته، بيومه.", "What you completed, day by day.")}</p>
        </header>

        {status.data?.configured === false && (
          <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>
            {t("المهام غير موصولة بعد. اضبط ", "Tasks are not connected yet. Set ")}<code>SUPABASE_URL</code>{t(" و", " and ")}<code>SUPABASE_ANON_KEY</code>{t(" ثم أعد النشر.", ", then redeploy.")}
          </p>
        )}

        {enabled && completed.isLoading && (
          <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>{t("…جارٍ التحميل", "Loading…")}</p>
        )}

        {completed.isError && (
          <p className="tm-empty tm-error" role="alert" style={{ marginBlockStart: "var(--space-9)" }}>
            {t("تعذّر قراءة الأرشيف.", "Could not load the archive.")} {completed.error.message}
          </p>
        )}

        {completed.isSuccess && days.length === 0 && (
          <div className="tm-empty-state" style={{ marginBlockStart: "var(--space-9)" }}>
            <p>{t("لم يُنجَز شيء بعد.", "Nothing completed yet.")}</p>
            <p className="tm-empty-hint">{t("أوّل مهمة تُنهيها تظهر هنا.", "The first task you finish will show up here.")}</p>
          </div>
        )}

        {days.map(group => (
          <section className="tm-section ar-day" key={group.day} aria-label={dayTitle(group.tasks[0].completedAt!)}>
            <h2 className="ar-day-title">{dayTitle(group.tasks[0].completedAt!)}</h2>

            <ul className="ar-list">
              {group.tasks.map(task => (
                <li className="ar-row" key={task.id}>
                  <Check size={16} aria-hidden="true" className="ar-check" />
                  <span className="ar-title">{task.title}</span>
                  <span className="ar-meta">
                    {task.quadrant ? quadrantLabel(task.quadrant) : t("غير مصنّفة", "Unclassified")}
                    {task.completedSessions > 0 && t(` · ${task.completedSessions} جلسة`, ` · ${task.completedSessions} ${task.completedSessions === 1 ? "session" : "sessions"}`)}
                  </span>
                  <time className="ar-time" dateTime={task.completedAt}>
                    {timeOf(task.completedAt!)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {days.length > 0 && (
          <div className="tm-primary">
            <Link className="tm-btn tm-btn-ghost" href={STATISTICS_ROUTE}>
              {t("عرض الإحصاء", "View statistics")}
            </Link>
          </div>
        )}
      </div>
    </TimeLayout>
  );
}
