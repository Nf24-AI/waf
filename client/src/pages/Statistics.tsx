// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { ARCHIVE_ROUTE, TIME_MANAGEMENT_ROUTE } from "@shared/routes";
import { formatMinutes, summarize } from "@shared/statistics";
import { trpc } from "@/lib/trpc";

/**
 * الإحصاء — مرآة لا لوحة قيادة.
 *
 * لا سلاسل ولا أوسمة ولا نسبة إنجاز: من يقيس نفسه بخطّ متّصل يخاف كسره،
 * فيجامل الرقم بمهام صغيرة يعرف أنه سينهيها. الأرقام هنا تصف ما حدث في مدة،
 * ومن لم يعمل فيها يقرأ صفراً بلا تعليق — الصفر خبر لا حكم.
 */

const PERIODS = [
  { id: "week", label: "آخر أسبوع", days: 7 },
  { id: "month", label: "آخر شهر", days: 30 },
  { id: "all", label: "منذ البداية", days: 0 },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

function since(days: number): string | undefined {
  if (!days) return undefined;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export default function Statistics() {
  const [period, setPeriod] = useState<PeriodId>("week");
  const days = PERIODS.find(item => item.id === period)!.days;
  const from = useMemo(() => since(days), [days]);

  const status = trpc.tasks.status.useQuery();
  const enabled = status.data?.configured === true;
  const completed = trpc.tasks.listCompleted.useQuery({ since: from }, { enabled });
  const sessions = trpc.tasks.sessions.useQuery({ since: from }, { enabled });

  const stats = useMemo(
    () => summarize(completed.data ?? [], sessions.data ?? []),
    [completed.data, sessions.data],
  );

  const loading = enabled && (completed.isLoading || sessions.isLoading);
  const error = completed.error ?? sessions.error;
  // أعلى ربع يحدّد طول الأشرطة: النسبة بين الأرباع هي الخبر، لا الرقم المطلق.
  const peak = Math.max(1, ...stats.byQuadrant.map(row => row.count));

  return (
    <main className="tm-shell waf-dots" dir="rtl">
      <div className="tm-inner">
        <header className="tm-head">
          <Link className="tm-back" href={TIME_MANAGEMENT_ROUTE}>
            <ArrowRight size={15} aria-hidden="true" />
            إدارة الوقت
          </Link>
          <h1>الإحصاء</h1>
          <p>ما حدث فعلاً، لا ما كان مخطّطاً.</p>
        </header>

        <div className="ei-chips st-periods" role="group" aria-label="المدة">
          {PERIODS.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.id === period ? "ei-chip is-current" : "ei-chip"}
              onClick={() => setPeriod(item.id)}
              aria-pressed={item.id === period}
            >
              {item.label}
            </button>
          ))}
        </div>

        {status.data?.configured === false && (
          <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>
            المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> و
            <code>TASKS_OWNER_CODE</code> ثم أعد النشر.
          </p>
        )}

        {loading && <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>…جارٍ الحساب</p>}

        {error && (
          <p className="tm-empty tm-error" role="alert" style={{ marginBlockStart: "var(--space-9)" }}>
            تعذّر قراءة الأرقام. {error.message}
          </p>
        )}

        {enabled && !loading && !error && (
          <>
            <section className="tm-section" aria-labelledby="st-numbers">
              <h2 id="st-numbers">في هذه المدة</h2>
              <div className="st-cards">
                <p className="st-card">
                  <span className="st-value">{stats.completedTasks}</span>
                  <span className="st-label">مهمة أُنجزت</span>
                </p>
                <p className="st-card">
                  <span className="st-value">{stats.focusSessions}</span>
                  <span className="st-label">جلسة تركيز اكتملت</span>
                </p>
                <p className="st-card">
                  <span className="st-value">{formatMinutes(stats.focusMinutes)}</span>
                  <span className="st-label">قُضيت في التركيز</span>
                </p>
              </div>
            </section>

            <section className="tm-section" aria-labelledby="st-quadrants">
              <h2 id="st-quadrants">أين ذهب المنجَز</h2>
              <p className="st-note">
                {/* السؤال الوحيد الذي تستحقّ المصفوفة أن تُسأله بعد شهر. */}
                نصيب «مهم وغير عاجل» هو ما يفرّق بين من يخطّط ومن يطفئ الحرائق.
              </p>

              <ul className="st-bars">
                {stats.byQuadrant.map(row => (
                  <li key={row.quadrant} className="st-bar">
                    <span className="st-bar-label">{row.title}</span>
                    <span className="st-bar-track" aria-hidden="true">
                      <span className="st-bar-fill" style={{ inlineSize: `${(row.count / peak) * 100}%` }} />
                    </span>
                    <span className="st-bar-value">{row.count}</span>
                  </li>
                ))}
              </ul>

              {stats.unclassified > 0 && (
                <p className="st-note">
                  و{stats.unclassified} مهمة أُنجزت دون أن تُصنَّف — وهذا ليس خطأً، بعض العمل يُفعل ولا يُقاس.
                </p>
              )}
            </section>

            <div className="tm-primary">
              <Link className="tm-btn tm-btn-ghost" href={ARCHIVE_ROUTE}>
                عرض الأرشيف
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
