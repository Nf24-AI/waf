// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useMemo } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  LayoutGrid,
  Lightbulb,
  Plus,
  Timer,
} from "lucide-react";
import { Link } from "wouter";
import { attentionList, completionRate, greeting, kpisOf, weekBars } from "@shared/dashboard";
import { lastWeekStart } from "@shared/statistics";
import { quadrantTitle, type Task } from "@shared/tasks";
import { TASKS_ROUTE, TIME_MANAGEMENT_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import tanomah from "@/assets/village-at-dusk.jpg";
import { readName } from "@/lib/preferences";
import { trpc } from "@/lib/trpc";

/**
 * الشاشة الأولى — ما يحتاج صاحب المهام أن يراه قبل أن يقرّر شيئاً.
 *
 * ليست لوحة قيادة تعرض كل ما يمكن عرضه: أربعة أرقام، ثلاث مهام تستحقّ
 * النظر، ومدخلٌ إلى الطرق. وما عدا ذلك في صفحاته — الشاشة التي تعرض كل شيء
 * لا تُقرأ منها إلا الأولى.
 *
 * وكل رقم فيها محسوب من المهام نفسها عند الفتح، لا عدّاداً محفوظاً ينحرف.
 */

const METHODS = [
  { id: "eisenhower", href: TIME_METHOD_ROUTES.eisenhower, icon: LayoutGrid, name: "مصفوفة أيزنهاور", line: "قرّر ما يهم." },
  { id: "time-blocking", href: TIME_METHOD_ROUTES.timeBlocking, icon: CalendarClock, name: "حجز الوقت", line: "خطّط لوقتك." },
  { id: "focus", href: TIME_METHOD_ROUTES.focus, icon: Timer, name: "جلسة التركيز", line: "ركّز على ما يهمّك." },
] as const;

function timeLabel(task: Task): string {
  if (!task.scheduledStart) return "بلا وقت";
  const start = new Date(task.scheduledStart);
  const today = new Date();
  const sameDay = start.toDateString() === today.toDateString();
  const clock = start.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: false });
  return sameDay ? clock : `${start.toLocaleDateString("ar-SA", { weekday: "long" })} ${clock}`;
}

/** لون الشارة من الربع: الأحمر للمهمّ العاجل وحده، وإلا فقد فقد معناه. */
function badgeTone(task: Task): "danger" | "go" | "warn" | "mute" {
  if (task.quadrant === "important_urgent") return "danger";
  if (task.quadrant === "important_not_urgent") return "go";
  if (task.quadrant === "not_important_urgent") return "warn";
  return "mute";
}

export default function TimeHome() {
  // الاسم من تفضيلات هذا المتصفّح، وبلا اسم تبقى التحيّة تحيّة.
  const name = readName();

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const enabled = status.data?.configured === true;

  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled });
  const week = trpc.tasks.listCompleted.useQuery({ since: lastWeekStart() }, { enabled });

  const complete = trpc.tasks.complete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.tasks.listOpen.invalidate(), utils.tasks.listCompleted.invalidate()]);
    },
  });

  const tasks = open.data ?? [];
  const done = week.data ?? [];

  const kpis = useMemo(() => kpisOf(tasks, done), [tasks, done]);
  const rate = completionRate(tasks.length, done.length);
  const bars = useMemo(() => weekBars(done), [done]);
  const attention = useMemo(() => attentionList(tasks), [tasks]);

  const peak = Math.max(1, ...bars.map(bar => bar.count));
  const ring = 2 * Math.PI * 54;

  return (
    <TimeLayout>
      {/*
        قراءة فاشلة تُعرض خطأً لا صفراً.

        الأصفار جوابٌ صحيح لمن لا مهام له، وكذبٌ لمن انقطع اتصاله: يقرأ
        «لا شيء يحتاج انتباهك» ويمضي في يومه وعنده ما يحتاجه.
      */}
      {(open.isError || week.isError) && (
        <p className="tp-empty tm-error" role="alert" style={{ marginBlockEnd: "var(--space-7)" }}>
          تعذّر قراءة المهام — الأرقام تحت غير صحيحة. {(open.error ?? week.error)?.message}
        </p>
      )}

      {status.data?.configured === false && (
        <p className="tp-empty" style={{ marginBlockEnd: "var(--space-7)" }}>
          المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> ثم أعد النشر.
        </p>
      )}

      <section className="tp-hero">
        <img className="tp-hero-photo" src={tanomah} alt="" aria-hidden="true" />
        <div className="tp-hero-text">
          <h1 className="tp-hello">{name ? `${greeting()}، ${name}` : greeting()}</h1>
          <p className="tp-hello-line">خطوة اليوم تصنع فرقاً أكبر غداً.</p>
        </div>
        <p className="tp-hero-quote">«كل التزام صغير يصنع طريقاً كبيراً.»</p>
      </section>

      <div className="tp-grid" style={{ marginBlockStart: "var(--space-6)" }}>
        <div className="tp-grid-wide" style={{ display: "grid", gap: "var(--space-6)" }}>
          <div className="tp-kpis">
            <p className="tp-kpi">
              <span>
                <span className="tp-kpi-num">{kpis.open}</span>
                <span className="tp-kpi-label">مهمة مفتوحة</span>
              </span>
              <span className="tp-kpi-icon" data-tone="accent" aria-hidden="true">
                <Clock size={18} />
              </span>
            </p>
            <p className="tp-kpi">
              <span>
                <span className="tp-kpi-num">{kpis.scheduled}</span>
                <span className="tp-kpi-label">مهمة مجدولة</span>
              </span>
              <span className="tp-kpi-icon" data-tone="warn" aria-hidden="true">
                <CalendarCheck size={18} />
              </span>
            </p>
            <p className="tp-kpi">
              <span>
                <span className="tp-kpi-num">{kpis.attention}</span>
                <span className="tp-kpi-label">تحتاج انتباهك</span>
              </span>
              <span className="tp-kpi-icon" data-tone="danger" aria-hidden="true">
                <CircleAlert size={18} />
              </span>
            </p>
            <p className="tp-kpi">
              <span>
                <span className="tp-kpi-num">{kpis.completedToday}</span>
                <span className="tp-kpi-label">مكتملة اليوم</span>
              </span>
              <span className="tp-kpi-icon" data-tone="go" aria-hidden="true">
                <CircleCheck size={18} />
              </span>
            </p>
          </div>

          <section className="tp-card" aria-labelledby="tp-attention">
            <h2 className="tp-card-title" id="tp-attention">
              مهام تحتاج انتباهك
            </h2>

            {attention.length === 0 ? (
              <p className="tp-empty">
                {tasks.length === 0 ? "لا مهام بعد." : "لا شيء متأخّر ولا عاجل. هذا خبر جيّد."}
              </p>
            ) : (
              <div className="tp-rows">
                {attention.map(task => (
                  <div className="tp-row" key={task.id}>
                    <button
                      type="button"
                      className="tp-check"
                      onClick={() => complete.mutate({ id: task.id })}
                      disabled={complete.isPending}
                      aria-label={`إنجاز ${task.title}`}
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>
                    <span className="tp-row-body">
                      <span className="tp-row-title">{task.title}</span>
                      {task.description && <span className="tp-row-sub">{task.description}</span>}
                    </span>
                    {task.quadrant && (
                      <span className="tp-badge" data-tone={badgeTone(task)}>
                        {quadrantTitle(task.quadrant)}
                      </span>
                    )}
                    <span className="tp-row-when">{timeLabel(task)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="tp-card-foot">
              <Link className="tp-more" href={TASKS_ROUTE}>
                <ArrowLeft size={14} aria-hidden="true" />
                عرض جميع المهام
              </Link>
            </div>
          </section>

          <section className="tp-card" aria-labelledby="tp-methods">
            <h2 className="tp-card-title" id="tp-methods">
              إدارة الوقت
            </h2>
            <p className="tp-card-sub">نفس مهامك .. بطرق مختلفة.</p>

            <div className="tp-tiles">
              {METHODS.map(method => {
                const Icon = method.icon;
                return (
                  <Link className="tp-tile" data-method={method.id} href={method.href} key={method.id}>
                    <Icon size={20} aria-hidden="true" />
                    <span className="tp-tile-name">{method.name}</span>
                    <span className="tp-tile-line">{method.line}</span>
                  </Link>
                );
              })}
            </div>

            <div className="tp-actions">
              <Link className="tp-btn tp-btn-primary" href={TIME_MANAGEMENT_ROUTE}>
                <Plus size={16} aria-hidden="true" />
                إضافة مهمة
              </Link>
              <Link className="tp-btn" href={TASKS_ROUTE}>
                متابعة المهام
                <ArrowLeft size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>

        <aside className="tp-grid-side">
          <section className="tp-card" aria-labelledby="tp-rate">
            <div className="tp-ring-wrap">
              <div className="tp-ring">
                <svg viewBox="0 0 128 128" aria-hidden="true">
                  <circle className="tp-ring-track" cx="64" cy="64" r="54" />
                  <circle
                    className="tp-ring-arc"
                    cx="64"
                    cy="64"
                    r="54"
                    style={{ strokeDasharray: ring, strokeDashoffset: ring * (1 - rate / 100) }}
                  />
                </svg>
                <p className="tp-ring-num">{rate}%</p>
              </div>
              <p className="tp-ring-label" id="tp-rate">
                معدل الإنجاز هذا الأسبوع
              </p>
            </div>

            {/* الرسم مقروء بالأعمدة لا بالأرقام، فالقيم في عنوان كل عمود. */}
            <div className="tp-week">
              {bars.map(bar => (
                <div className={bar.isToday ? "tp-week-day is-today" : "tp-week-day"} key={bar.day}>
                  <span
                    className="tp-week-bar"
                    style={{ blockSize: `${Math.max(4, (bar.count / peak) * 48)}px` }}
                    title={`${bar.count} مهمة`}
                  />
                  <span className="tp-week-letter">{bar.initial}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="tp-quote" aria-label="اقتباس اليوم">
            <img src={tanomah} alt="" aria-hidden="true" />
            <p className="tp-quote-eyebrow">اقتباس اليوم</p>
            <p className="tp-quote-text">«الوقت المناسب يبدأ من قرار بسيط.»</p>
          </section>

          <section className="tp-card tp-tip" aria-label="معلومة">
            <span className="tp-tip-icon" aria-hidden="true">
              <Lightbulb size={17} />
            </span>
            <div>
              <p className="tp-tip-eyebrow">معلومة</p>
              <p className="tp-tip-value">25 دقيقة</p>
              <p className="tp-tip-line">من التركيز العميق تكفي لإنهاء ما تؤجّله منذ أسبوع.</p>
            </div>
          </section>
        </aside>
      </div>
    </TimeLayout>
  );
}
