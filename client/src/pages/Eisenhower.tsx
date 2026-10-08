// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { QUADRANTS, type Quadrant, type Task } from "@shared/tasks";
import { TIME_MANAGEMENT_ROUTE } from "@shared/routes";
import LangToggle from "@/components/LangToggle";
import { useAuthSession } from "@/contexts/AuthContext";
import { errorText } from "@/lib/error-text";
import { dir, t } from "@/lib/i18n";
import { quadrantLabel, quadrantVerbLabel } from "@/lib/task-labels";
import { trpc } from "@/lib/trpc";

/**
 * مصفوفة أيزنهاور — إطار قائم بذاته.
 *
 * تُكتب المهمة هنا وتُصنَّف هنا وتُنجَز هنا: لا صفحة مهام تسبقها ولا إطار
 * يليها. والمهام مهامّ هذا الإطار وحده (انظر TASK_ORIGINS)، فما يُكتب في
 * المصفوفة لا يظهر في حجز الوقت ولا في جلسة التركيز.
 *
 * السحب للفأرة، واللمس يختار المهمة ثم رُبعها: شاشة اللمس بلا سحب HTML5.
 */

/** هذا الإطار يقرأ مهامه وحدها ويكتبها باسمه. */
const ORIGIN = "eisenhower" as const;

function TaskChip({
  task,
  onPick,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onPick: (task: Task) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      className={dragging ? "ei-chip is-dragging" : "ei-chip"}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onPick(task)}
      aria-label={t(`نقل ${task.title}`, `Move ${task.title}`)}
    >
      {task.title}
    </button>
  );
}

export default function Eisenhower() {
  const { signOut } = useAuthSession();
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<Quadrant | null>(null);
  const [picking, setPicking] = useState<Task | null>(null);
  const [title, setTitle] = useState("");

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery({ origin: ORIGIN }, { enabled: status.data?.configured === true });

  // كل كتابة تُحدّث القائمة وتُغلق نافذة الاختيار: ما اختير له قد تغيّر أو ذهب.
  const settle = {
    onSuccess: async () => {
      await utils.tasks.listOpen.invalidate();
      setPicking(null);
    },
  };
  const create = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      await utils.tasks.listOpen.invalidate();
      setTitle("");
    },
  });
  const classify = trpc.tasks.classify.useMutation(settle);
  const complete = trpc.tasks.complete.useMutation(settle);
  const archive = trpc.tasks.archive.useMutation(settle);
  const busy = classify.isPending || complete.isPending || archive.isPending;
  const failure = create.error ?? classify.error ?? complete.error ?? archive.error;

  const tasks = open.data ?? [];
  const unclassified = tasks.filter(task => !task.quadrant);
  const Back = dir() === "rtl" ? ArrowRight : ArrowLeft;

  function place(id: string, quadrant: Quadrant) {
    setDragged(null);
    setOver(null);
    classify.mutate({ id, quadrant });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (clean && !create.isPending) create.mutate({ title: clean, origin: ORIGIN });
  }

  return (
    <div className="tp-frame ei-frame" data-waf-theme="navy" dir={dir()}>
      <header className="ei-top">
        {/* المخرج الوحيد: إلى صفحة الإطارات، لا إلى إطارٍ آخر. */}
        <Link className="ei-top-back" href={TIME_MANAGEMENT_ROUTE}>
          <Back size={15} aria-hidden="true" />
          {t("الإطارات", "Frameworks")}
        </Link>
        <span className="ei-top-title">
          <LayoutGrid size={16} aria-hidden="true" />
          {t("مصفوفة أيزنهاور", "Eisenhower matrix")}
        </span>
        <span className="ei-top-end">
          <LangToggle className="ei-top-back" short />
          <button type="button" className="ei-top-back" onClick={() => void signOut()}>
            {t("تسجيل الخروج", "Sign out")}
          </button>
        </span>
      </header>

      <main className="tp-main">
        <div className="tm-inner">
          <header className="tp-head">
            <h1>{t("صنّف المهمة", "Classify the task")}</h1>
            <p>{t("حدّد الأولوية بوضوح.", "Set the priority clearly.")}</p>
          </header>

          <form className="ei-add" onSubmit={add}>
            <input
              type="text"
              value={title}
              maxLength={200}
              placeholder={t("اكتب مهمة ثم ضعها في رُبعها…", "Write a task, then place it in its quadrant…")}
              aria-label={t("مهمة جديدة", "New task")}
              onChange={event => setTitle(event.target.value)}
            />
            <button type="submit" className="tp-btn tp-btn-primary" disabled={!title.trim() || create.isPending}>
              <Plus size={17} aria-hidden="true" />
              {t("إضافة مهمة", "Add task")}
            </button>
          </form>

          {status.data?.configured === false && (
            <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>
              {t("المهام غير موصولة بعد. اضبط ", "Tasks are not connected yet. Set ")}<code>SUPABASE_URL</code>{t(" و", " and ")}<code>SUPABASE_ANON_KEY</code>{t(" ثم أعد النشر.", ", then redeploy.")}
            </p>
          )}

          {open.isError && (
            <p className="tm-empty tm-error" role="alert" style={{ marginBlockStart: "var(--space-9)" }}>
              {t("تعذّر قراءة المهام.", "Could not load tasks.")} {errorText(open.error)}
            </p>
          )}

          {failure && (
            <p className="tm-form-error" role="alert" dir="auto">
              {errorText(failure)}
            </p>
          )}

          {/* الصفّ المنتظر: ما لم يُصنَّف بعد. يختفي حين لا يبقى شيء. */}
          {unclassified.length > 0 && (
            <section className="ei-tray" aria-labelledby="ei-tray-title">
              <h2 id="ei-tray-title">
                {t("في انتظار التصنيف", "Waiting to be classified")}
                <span className="tm-tab-count">{unclassified.length}</span>
              </h2>
              <div className="ei-chips">
                {unclassified.map(task => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    dragging={dragged === task.id}
                    onDragStart={() => setDragged(task.id)}
                    onDragEnd={() => setDragged(null)}
                    onPick={setPicking}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="ei-matrix">
            {QUADRANTS.map(quadrant => {
              const inside = tasks.filter(task => task.quadrant === quadrant.id);
              return (
                <section
                  key={quadrant.id}
                  className={over === quadrant.id ? "ei-cell is-over" : "ei-cell"}
                  data-q={quadrant.id}
                  aria-label={quadrantLabel(quadrant.id)}
                  onDragOver={event => {
                    event.preventDefault();
                    setOver(quadrant.id);
                  }}
                  onDragLeave={() => setOver(current => (current === quadrant.id ? null : current))}
                  onDrop={event => {
                    event.preventDefault();
                    if (dragged) place(dragged, quadrant.id);
                  }}
                >
                  <header className="ei-cell-head">
                    <h3>{quadrantLabel(quadrant.id)}</h3>
                    <p>{quadrantVerbLabel(quadrant.id)}</p>
                  </header>

                  <div className="ei-chips">
                    {inside.map(task => (
                      <TaskChip
                        key={task.id}
                        task={task}
                        dragging={dragged === task.id}
                        onDragStart={() => setDragged(task.id)}
                        onDragEnd={() => setDragged(null)}
                        onPick={setPicking}
                      />
                    ))}
                    {inside.length === 0 && <p className="ei-cell-empty">{t("لا مهام هنا", "No tasks here")}</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {/* على اللمس لا سحب: تُختار المهمة ثم يُختار رُبعها — ومن هنا تُنجَز أو تُحذف. */}
      {picking && (
        <div className="tm-scrim" role="presentation" onClick={event => event.target === event.currentTarget && setPicking(null)}>
          <div className="tm-dialog" role="dialog" aria-modal="true" aria-labelledby="ei-pick-title" dir={dir()}>
            <header className="tm-dialog-head">
              <h2 id="ei-pick-title">{t(`أين تضع «${picking.title}»؟`, `Where does “${picking.title}” go?`)}</h2>
            </header>
            <div className="ei-pick">
              {QUADRANTS.map(quadrant => (
                <button
                  key={quadrant.id}
                  type="button"
                  className={picking.quadrant === quadrant.id ? "ei-pick-option is-current" : "ei-pick-option"}
                  onClick={() => place(picking.id, quadrant.id)}
                  disabled={busy}
                >
                  <span className="ei-pick-title">{quadrantLabel(quadrant.id)}</span>
                  <span className="ei-pick-verb">{quadrantVerbLabel(quadrant.id)}</span>
                </button>
              ))}
            </div>
            <div className="tm-form-actions">
              <button type="button" className="tm-btn tm-btn-ghost" onClick={() => archive.mutate({ id: picking.id })} disabled={busy}>
                <Trash2 size={15} aria-hidden="true" />
                {t("حذف", "Delete")}
              </button>
              <button type="button" className="tm-btn tm-btn-ghost" onClick={() => setPicking(null)}>
                {t("إلغاء", "Cancel")}
              </button>
              <button type="button" className="tm-btn" onClick={() => complete.mutate({ id: picking.id })} disabled={busy}>
                <Check size={15} aria-hidden="true" />
                {t("أنجزتُها", "Mark done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
