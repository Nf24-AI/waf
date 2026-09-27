// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "wouter";
import { FILTERS, applyFilter, countsOf, type FilterId } from "@shared/board";
import { ADD_TASK_ROUTE } from "@shared/routes";
import { lastWeekStart } from "@shared/statistics";
import FilterBar from "@/components/board/FilterBar";
import Hero from "@/components/board/Hero";
import ProjectList from "@/components/board/ProjectList";
import QuadrantPanel from "@/components/board/QuadrantPanel";
import SummaryCards from "@/components/board/SummaryCards";
import TaskList from "@/components/board/TaskList";
import TimeLayout from "@/components/time/TimeLayout";
import { trpc } from "@/lib/trpc";

/**
 * اللوحة — أوّل ما يُفتح.
 *
 * كل رقم فيها محسوب من المهام عند الفتح، ولا رقم مكتوب بيدي. وهذا ليس
 * تشدّداً: لوحةٌ تعرض أرقاماً ثابتة تبدو حيّة وتُصدَّق، ثم تُكتشف بعد أسبوع
 * فيسقط معها كل رقم آخر في المنتج.
 *
 * ولا اسم شخص في أي موضع — الواجهة عامّة، ومن يفتحها يجدها له.
 */
export default function TimeHome() {
  const [filter, setFilter] = useState<FilterId>("all");
  const now = useMemo(() => new Date(), []);

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const enabled = status.data?.configured === true;

  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled });
  const projects = trpc.projects.list.useQuery(undefined, { enabled });
  const week = trpc.tasks.listCompleted.useQuery({ since: lastWeekStart() }, { enabled });

  const complete = trpc.tasks.complete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.tasks.listOpen.invalidate(), utils.tasks.listCompleted.invalidate()]);
    },
  });

  const tasks = open.data ?? [];
  const done = week.data ?? [];
  const everything = useMemo(() => [...tasks, ...done], [tasks, done]);

  const counts = useMemo(() => countsOf(tasks, done, now), [tasks, done, now]);

  // عدد كل فلتر يُحسب مرّة: الشريط يعرضها كلها، وحسابها عند كل رسم إسراف.
  const filterCounts = useMemo(() => {
    const out = {} as Record<FilterId, number>;
    for (const item of FILTERS) out[item.id] = applyFilter(everything, item.id, now).length;
    return out;
  }, [everything, now]);

  const shown = useMemo(() => applyFilter(everything, filter, now).slice(0, 6), [everything, filter, now]);

  const loading = enabled && (open.isLoading || week.isLoading);
  const failed = open.isError || week.isError;

  return (
    <TimeLayout>
      {status.data?.configured === false && (
        <p className="bd-notice">
          المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> ثم أعد النشر.
        </p>
      )}

      {/*
        الفشل يُقال ولا يُقرأ أصفاراً. الصفر جواب صحيح لمن لا مهام له، وكذبٌ
        لمن انقطع اتصاله — ويُكتبان بنفس الشكل.
      */}
      {failed && (
        <p className="bd-notice bd-notice-bad" role="alert">
          تعذّر قراءة المهام — الأرقام تحت غير صحيحة.
        </p>
      )}

      <Hero now={now} />

      <Link className="bd-cta" href={ADD_TASK_ROUTE}>
        <Plus size={20} aria-hidden="true" />
        إضافة مهمة
      </Link>

      <FilterBar value={filter} counts={filterCounts} onChange={setFilter} />

      <SummaryCards counts={counts} />

      <div className="bd-grid">
        <TaskList
          tasks={shown}
          now={now}
          busy={complete.isPending}
          onComplete={id => complete.mutate({ id })}
          emptyHint={
            loading
              ? "…جارٍ تحميل مهامك"
              : everything.length === 0
                ? "ابدأ بمهمة واحدة."
                : "لا مهام في هذا التصنيف."
          }
        />

        {/*
          المشاريع إن وُجدت، وإلا فتوزيع الأرباع.
          
          لا بطاقات فارغة بأسماء مخترعة: من لم ينشئ مشروعاً يرى شيئاً حقيقياً
          عن مهامه بدل هيكلٍ ينتظر أن يُملأ.
        */}
        {(projects.data?.length ?? 0) > 0 ? (
          <ProjectList projects={projects.data ?? []} tasks={everything} />
        ) : (
          <QuadrantPanel tasks={tasks} />
        )}
      </div>
    </TimeLayout>
  );
}
