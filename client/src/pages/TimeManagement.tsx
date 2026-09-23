// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Archive, ArrowRight, BarChart3, CalendarClock, LayoutGrid, ListChecks, Plus, Timer } from "lucide-react";
import { Link } from "wouter";
import { ARCHIVE_ROUTE, PLATFORM_ROUTE, STATISTICS_ROUTE, TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import AddTaskDialog from "@/components/time/AddTaskDialog";
import TaskRow from "@/components/time/TaskRow";
import { trpc } from "@/lib/trpc";

/**
 * بوّابة إدارة الوقت.
 *
 * المهمة هي الأصل، والطرق الثلاث أدوات للتعامل معها — فلا تُفتح إحداها
 * مباشرة ولا يُساق المستخدم فيها بالترتيب. تبدأ الصفحة بما يستطيع فعله
 * (إضافة، متابعة)، ثم الطرق، ثم مهامه المفتوحة فعلاً.
 *
 * ولا تبدأ فارغة: من يدخل ولديه مهام يراها، ومن لا مهام له يرى دعوة واحدة
 * واضحة لا إطاراً خاوياً.
 */

const METHODS = [
  { id: "eisenhower", href: TIME_METHOD_ROUTES.eisenhower, icon: LayoutGrid, title: "مصفوفة أيزنهاور", line: "قرّر ما يستحق وقتك." },
  { id: "time-blocking", href: TIME_METHOD_ROUTES.timeBlocking, icon: CalendarClock, title: "حجز الوقت", line: "ضع لكل مهمة وقتاً واضحاً." },
  { id: "focus", href: TIME_METHOD_ROUTES.focus, icon: Timer, title: "جلسة التركيز", line: "ركّز على ما بين يديك." },
] as const;

export default function TimeManagement() {
  const [adding, setAdding] = useState(false);

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  // الإضافة والإنجاز يُبطلان القائمة نفسها، فلا تبقى شاشة تعرض ما لم يعد قائماً.
  const create = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      await utils.tasks.listOpen.invalidate();
      setAdding(false);
    },
  });
  const complete = trpc.tasks.complete.useMutation({
    onSuccess: () => utils.tasks.listOpen.invalidate(),
  });

  const tasks = open.data ?? [];
  const configured = status.data?.configured;

  return (
    <TimeLayout>
      <div className="tm-inner">
        <header className="tm-head">
          {/* على المكتب يحمل الشريط الجانبي هذا المخرج؛ هنا للجوّال. */}
          <Link className="tm-back tl-only-phone" href={PLATFORM_ROUTE}>
            <ArrowRight size={15} aria-hidden="true" />
            المنصّة
          </Link>
          <h1>إدارة الوقت</h1>
          <p>نفس مهامك، بثلاث طرق مختلفة.</p>
        </header>

        <div className="tm-primary">
          <button type="button" className="tm-btn tm-btn-primary" onClick={() => setAdding(true)} disabled={!configured}>
            <Plus size={17} aria-hidden="true" />
            إضافة مهمة
          </button>
          <Link className="tm-btn tm-btn-ghost" href={TASKS_ROUTE}>
            <ListChecks size={17} aria-hidden="true" />
            متابعة المهام
          </Link>
          <Link className="tm-btn tm-btn-ghost" href={STATISTICS_ROUTE}>
            <BarChart3 size={17} aria-hidden="true" />
            الإحصاء
          </Link>
          <Link className="tm-btn tm-btn-ghost" href={ARCHIVE_ROUTE}>
            <Archive size={17} aria-hidden="true" />
            الأرشيف
          </Link>
        </div>

        <section className="tm-section" aria-labelledby="tm-methods">
          <h2 id="tm-methods">اختر طريقتك</h2>
          {/* لا ترقيم ولا أسهم بينها: ثلاث أدوات لا ثلاث خطوات. */}
          <div className="tm-methods">
            {METHODS.map(method => {
              const Icon = method.icon;
              return (
                <Link key={method.id} className="tm-method" href={method.href}>
                  <span className="tm-method-icon" aria-hidden="true">
                    <Icon size={19} />
                  </span>
                  <span className="tm-method-title">{method.title}</span>
                  <span className="tm-method-line">{method.line}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="tm-section" aria-labelledby="tm-open">
          <h2 id="tm-open">مهامك المفتوحة</h2>

          {configured === false && (
            <p className="tm-empty">
              المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> و
              <code>TASKS_OWNER_CODE</code> ثم أعد النشر.
            </p>
          )}

          {open.isLoading && configured && <p className="tm-empty">…جارٍ التحميل</p>}

          {open.isError && (
            <p className="tm-empty tm-error" role="alert">
              تعذّر قراءة المهام. {open.error.message}
            </p>
          )}

          {open.isSuccess && tasks.length === 0 && (
            <div className="tm-empty-state">
              <p>لا توجد مهام بعد.</p>
              <p className="tm-empty-hint">ابدأ بمهمة واحدة.</p>
              <button type="button" className="tm-btn tm-btn-primary" onClick={() => setAdding(true)}>
                <Plus size={17} aria-hidden="true" />
                إضافة مهمة
              </button>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="tm-tasks">
              {tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={id => complete.mutate({ id })}
                  completing={complete.isPending}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <AddTaskDialog
        open={adding}
        pending={create.isPending}
        error={create.error?.message ?? null}
        onClose={() => setAdding(false)}
        onSubmit={input => create.mutate(input)}
      />
    </TimeLayout>
  );
}
