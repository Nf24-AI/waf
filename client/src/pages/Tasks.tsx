// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Link, useSearch } from "wouter";
import { type Task } from "@shared/tasks";
import { ARCHIVE_ROUTE } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import TaskRow from "@/components/time/TaskRow";
import { pair, pick, t } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

/**
 * متابعة المهام — تعرض ولا تنشئ.
 *
 * المكتملة مخفيّة افتراضاً: هذه صفحة عمل لا سجلّ، ومكانها الأرشيف. والتبويبات
 * تصف حالة المهمة لا تصنيفاً مخترعاً، فكل واحد منها سؤال يسأله صاحب المهام
 * فعلاً: ما الذي لم أصنّفه؟ ما الذي خطّطت له؟ ما الذي فاتني؟
 */

const TABS = [
  { id: "all", label: pair("الكل", "All") },
  { id: "unclassified", label: pair("غير مصنّفة", "Unclassified") },
  { id: "planned", label: pair("مخطّطة", "Planned") },
  { id: "ready", label: pair("جاهزة للتركيز", "Ready to focus") },
  { id: "late", label: pair("متأخّرة", "Overdue") },
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
          <h1>{query ? t("نتائج البحث", "Search results") : t("مهامي المفتوحة", "My open tasks")}</h1>
          <p>
            {t("ما لم يُنجَز بعد. المكتملة في ", "Not done yet. Completed tasks are in the ")}<Link href={ARCHIVE_ROUTE}>{t("الأرشيف", "archive")}</Link>.
          </p>
        </header>

        <div className="tp-tabs" role="tablist" aria-label={t("تصفية المهام", "Filter tasks")}>
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
                {pick(item.label)}
                <span className="tp-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <section className="tm-section" aria-live="polite">
          {status.data?.configured === false && (
            <p className="tm-empty">
              {t("المهام غير موصولة بعد. اضبط ", "Tasks are not connected yet. Set ")}<code>SUPABASE_URL</code>{t(" و", " and ")}<code>SUPABASE_ANON_KEY</code>{t(" ثم أعد النشر.", ", then redeploy.")}
            </p>
          )}

          {open.isLoading && status.data?.configured && <p className="tm-empty">{t("…جارٍ التحميل", "Loading…")}</p>}

          {open.isError && (
            <p className="tm-empty tm-error" role="alert">
              {t("تعذّر قراءة المهام.", "Could not load tasks.")} {open.error.message}
            </p>
          )}

          {open.isSuccess && shown.length === 0 && (
            <div className="tm-empty-state">
              <p>{all.length === 0 ? t("لا توجد مهام بعد.", "No tasks yet.") : t("لا مهام في هذا التصنيف.", "No tasks in this tab.")}</p>
              <p className="tm-empty-hint">
                {all.length === 0 ? t("ابدأ بمهمة واحدة من إدارة الوقت.", "Start with one task from Time management.") : t("جرّب تبويباً آخر.", "Try another tab.")}
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
