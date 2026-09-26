// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Link, useSearch } from "wouter";
import { type Task } from "@shared/tasks";
import { ARCHIVE_ROUTE } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import TaskRow from "@/components/time/TaskRow";
import { trpc } from "@/lib/trpc";

/**
 * متابعة المهام — تعرض ولا تنشئ.
 *
 * المكتملة مخفيّة افتراضاً: هذه صفحة عمل لا سجلّ، ومكانها الأرشيف. والتبويبات
 * تصف حالة المهمة لا تصنيفاً مخترعاً، فكل واحد منها سؤال يسأله صاحب المهام
 * فعلاً: ما الذي لم أصنّفه؟ ما الذي خطّطت له؟ ما الذي فاتني؟
 */

const TABS = [
  { id: "all", label: "الكل" },
  { id: "unclassified", label: "غير مصنّفة" },
  { id: "planned", label: "مخطّطة" },
  { id: "ready", label: "جاهزة للتركيز" },
  { id: "late", label: "متأخّرة" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * البحث: تطابق جزئي بلا حساسية لحالة الأحرف، على الاسم والوصف.
 *
 * الكلمة تأتي من الشريط العلوي في `?q=`، فالنتيجة قابلة للمشاركة ولا تضيع
 * بتحديث الصفحة. ولا ترتيب بالصلة: من له عشرون مهمة لا يحتاج محرّك بحث.
 */
export function search(tasks: Task[], query: string): Task[] {
  const needle = query.trim().toLocaleLowerCase("ar");
  if (!needle) return tasks;
  return tasks.filter(task =>
    `${task.title} ${task.description ?? ""}`.toLocaleLowerCase("ar").includes(needle),
  );
}

function matches(task: Task, tab: TabId, now: number): boolean {
  if (tab === "all") return true;
  if (tab === "unclassified") return !task.quadrant;
  if (tab === "planned") return Boolean(task.scheduledStart);
  if (tab === "ready") return Boolean(task.quadrant && task.scheduledStart);
  // متأخّرة: مرّ وقتها ولم تُنجَز. الحساب من الآن لا من لحظة التحميل.
  return Boolean(task.scheduledEnd && new Date(task.scheduledEnd).getTime() < now);
}

export default function Tasks() {
  const [tab, setTab] = useState<TabId>("all");

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });
  const complete = trpc.tasks.complete.useMutation({
    onSuccess: () => utils.tasks.listOpen.invalidate(),
  });

  const query = new URLSearchParams(useSearch()).get("q") ?? "";

  const now = Date.now();
  const all = search(open.data ?? [], query);
  const shown = all.filter(task => matches(task, tab, now));

  return (
    <TimeLayout>
      <div className="tm-inner">
        <header className="tp-head">
          <h1>{query ? "نتائج البحث" : "مهامي المفتوحة"}</h1>
          <p>
            ما لم يُنجَز بعد. المكتملة في <Link href={ARCHIVE_ROUTE}>الأرشيف</Link>.
          </p>
        </header>

        <div className="tp-tabs" role="tablist" aria-label="تصفية المهام">
          {TABS.map(item => {
            const count = all.filter(task => matches(task, item.id, now)).length;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "tp-tab is-current" : "tp-tab"}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                <span className="tp-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <section className="tm-section" aria-live="polite">
          {status.data?.configured === false && (
            <p className="tm-empty">
              المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> ثم أعد النشر.
            </p>
          )}

          {open.isLoading && status.data?.configured && <p className="tm-empty">…جارٍ التحميل</p>}

          {open.isError && (
            <p className="tm-empty tm-error" role="alert">
              تعذّر قراءة المهام. {open.error.message}
            </p>
          )}

          {open.isSuccess && shown.length === 0 && (
            <div className="tm-empty-state">
              <p>{all.length === 0 ? "لا توجد مهام بعد." : "لا مهام في هذا التصنيف."}</p>
              <p className="tm-empty-hint">
                {all.length === 0 ? "ابدأ بمهمة واحدة من إدارة الوقت." : "جرّب تبويباً آخر."}
              </p>
            </div>
          )}

          {shown.length > 0 && (
            <div className="tm-tasks">
              {shown.map(task => (
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
