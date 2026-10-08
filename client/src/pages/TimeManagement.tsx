// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, LayoutGrid, ListChecks, Plus, Timer } from "lucide-react";
import { Link } from "wouter";
import { ADD_TASK_ROUTE, PLATFORM_ROUTE, TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import TaskRow from "@/components/time/TaskRow";
import { dir, pair, pick, t } from "@/lib/i18n";
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
  { id: "eisenhower", href: TIME_METHOD_ROUTES.eisenhower, icon: LayoutGrid, title: pair("مصفوفة أيزنهاور", "Eisenhower matrix"), line: pair("قرّر ما يستحق وقتك.", "Decide what deserves your time.") },
  { id: "time-blocking", href: TIME_METHOD_ROUTES.timeBlocking, icon: CalendarClock, title: pair("حجز الوقت", "Time blocking"), line: pair("ضع لكل مهمة وقتاً واضحاً.", "Give every task a clear time.") },
  { id: "focus", href: TIME_METHOD_ROUTES.focus, icon: Timer, title: pair("جلسة التركيز", "Focus session"), line: pair("ركّز على ما بين يديك.", "Focus on what is in front of you.") },
] as const;

export default function TimeManagement() {

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });
  const complete = trpc.tasks.complete.useMutation({
    onSuccess: () => utils.tasks.listOpen.invalidate(),
  });

  const tasks = open.data ?? [];
  const configured = status.data?.configured;

  return (
    <TimeLayout>
      <div className="tm-inner">
        <header className="tp-head">
          {/* على المكتب يحمل الشريط الجانبي هذا المخرج؛ هنا للجوّال. */}
          <Link className="tm-back tl-only-phone" href={PLATFORM_ROUTE}>
            {dir() === "rtl" ? <ArrowRight size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}
            {t("المنصّة", "Platform")}
          </Link>
          <h1>{t("إدارة الوقت", "Time management")}</h1>
          <p>{t("نفس مهامك .. بطرق مختلفة.", "The same tasks, different methods.")}</p>
        </header>

        <div className="tp-actions">
          <Link className="tp-btn tp-btn-primary tp-btn-wide" href={ADD_TASK_ROUTE}>
            <Plus size={17} aria-hidden="true" />
            {t("إضافة مهمة", "Add task")}
          </Link>
          <Link className="tp-btn tp-btn-wide" href={TASKS_ROUTE}>
            <ListChecks size={17} aria-hidden="true" />
            {t("متابعة المهام", "Track tasks")}
          </Link>
        </div>

        <section className="tm-section" aria-labelledby="tm-methods">
          <h2 id="tm-methods">{t("اختر طريقتك", "Choose your method")}</h2>
          {/* لا ترقيم ولا أسهم بينها: ثلاث أدوات لا ثلاث خطوات. */}
          <div className="tp-tiles">
            {METHODS.map((method, index) => {
              const Icon = method.icon;
              return (
                <Link
                  key={method.id}
                  className={index === 2 ? "tp-tile tp-tile-wide" : "tp-tile"}
                  data-method={method.id}
                  href={method.href}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className="tp-tile-name">{pick(method.title)}</span>
                  <span className="tp-tile-line">{pick(method.line)}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="tm-section" aria-labelledby="tm-open">
          <h2 id="tm-open">{t("مهامك المفتوحة", "Your open tasks")}</h2>

          {configured === false && (
            <p className="tm-empty">
              {t("المهام غير موصولة بعد. اضبط ", "Tasks are not connected yet. Set ")}<code>SUPABASE_URL</code>{t(" و", " and ")}<code>SUPABASE_ANON_KEY</code>{t(" ثم أعد النشر.", ", then redeploy.")}
            </p>
          )}

          {open.isLoading && configured && <p className="tm-empty">{t("…جارٍ التحميل", "Loading…")}</p>}

          {open.isError && (
            <p className="tm-empty tm-error" role="alert">
              {t("تعذّر قراءة المهام.", "Could not load tasks.")} {open.error.message}
            </p>
          )}

          {open.isSuccess && tasks.length === 0 && (
            <div className="tm-empty-state">
              <p>{t("لا توجد مهام بعد.", "No tasks yet.")}</p>
              <p className="tm-empty-hint">{t("ابدأ بمهمة واحدة.", "Start with one task.")}</p>
              <Link className="tp-btn tp-btn-primary" href={ADD_TASK_ROUTE}>
                <Plus size={17} aria-hidden="true" />
                {t("إضافة مهمة", "Add task")}
              </Link>
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
    </TimeLayout>
  );
}
