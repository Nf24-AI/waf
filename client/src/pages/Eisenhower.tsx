// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { Link } from "wouter";
import { QUADRANTS, type Quadrant, type Task } from "@shared/tasks";
import { ADD_TASK_ROUTE, TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import FlowSteps from "@/components/time/FlowSteps";
import TimeLayout from "@/components/time/TimeLayout";
import { flowHref, useInFlow } from "@/lib/flow";
import { trpc } from "@/lib/trpc";

/**
 * مصفوفة أيزنهاور — تصنّف مهامك القائمة، ولا تطلب إنشاءها من جديد.
 *
 * المهام غير المصنّفة تنتظر في صفّ أعلى المصفوفة، وتُنقل إلى رُبعها بالسحب
 * على الفأرة أو بالاختيار من قائمة على اللمس. والأربعة مرتّبة كما في الأصل:
 * المهمّ أعلى، والعاجل يمين — فالأعلى يمين هو «افعل الآن».
 *
 * والتصنيف وحده هو العمل هنا. من صنّف ولم يرد أن يجدول، انتهى — ويظهر له
 * اقتراح واحد لا أكثر، يتجاهله إن شاء.
 */

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
      aria-label={`نقل ${task.title}`}
    >
      {task.title}
    </button>
  );
}

export default function Eisenhower() {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<Quadrant | null>(null);
  const [picking, setPicking] = useState<Task | null>(null);
  const [justPlaced, setJustPlaced] = useState<Task | null>(null);

  // الرحلة تُغيّر الوجهة التالية وحدها، لا ما تفعله الصفحة.
  const inFlow = useInFlow();

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  const classify = trpc.tasks.classify.useMutation({
    onSuccess: async task => {
      await utils.tasks.listOpen.invalidate();
      // اقتراح واحد بعد التصنيف، ولمن لم يجدول بعدُ فقط.
      setJustPlaced(task.scheduledStart ? null : task);
      setPicking(null);
    },
  });

  const tasks = open.data ?? [];
  const unclassified = tasks.filter(task => !task.quadrant);

  function place(id: string, quadrant: Quadrant) {
    setDragged(null);
    setOver(null);
    classify.mutate({ id, quadrant });
  }

  return (
    <TimeLayout>
      <div className="tm-inner">
        <FlowSteps current="classify" />

        <header className="tp-head">
          <h1>صنّف المهمة</h1>
          <p>حدّد الأولوية بوضوح.</p>
        </header>

        <div className="tp-actions">
          <Link className="tp-btn" href={TASKS_ROUTE}>
            المهام المفتوحة
          </Link>
          <Link className="tp-btn tp-btn-primary" href={ADD_TASK_ROUTE}>
            <Plus size={17} aria-hidden="true" />
            إضافة مهمة
          </Link>
        </div>

        {status.data?.configured === false && (
          <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>
            المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> ثم أعد النشر.
          </p>
        )}

        {open.isError && (
          <p className="tm-empty tm-error" role="alert" style={{ marginBlockStart: "var(--space-9)" }}>
            تعذّر قراءة المهام. {open.error.message}
          </p>
        )}

        {/* الصفّ المنتظر: ما لم يُصنَّف بعد. يختفي حين لا يبقى شيء. */}
        {unclassified.length > 0 && (
          <section className="ei-tray" aria-labelledby="ei-tray-title">
            <h2 id="ei-tray-title">
              في انتظار التصنيف
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
                aria-label={quadrant.title}
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
                  <h3>{quadrant.title}</h3>
                  <p>{quadrant.verb}</p>
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
                  {inside.length === 0 && <p className="ei-cell-empty">لا مهام هنا</p>}
                </div>
              </section>
            );
          })}
        </div>

        {/* اقتراح بعد التصنيف — يُتجاهَل بلا ثمن. */}
        {justPlaced && (
          <div className="ei-suggest" role="status">
            <span>هل تريد إعطاء «{justPlaced.title}» وقتاً؟</span>
            <div className="ei-suggest-actions">
              <Link
                className="tp-btn tp-btn-primary"
                href={inFlow ? flowHref(TIME_METHOD_ROUTES.timeBlocking, justPlaced.id) : `${TIME_METHOD_ROUTES.timeBlocking}?task=${justPlaced.id}`}
              >
                <CalendarClock size={16} aria-hidden="true" />
                حجز الوقت
              </Link>
              <button type="button" className="tp-btn" onClick={() => setJustPlaced(null)}>
                لاحقاً
              </button>
            </div>
          </div>
        )}
      </div>

      {/* على اللمس لا سحب: تُختار المهمة ثم يُختار رُبعها. */}
      {picking && (
        <div className="tm-scrim" role="presentation" onClick={event => event.target === event.currentTarget && setPicking(null)}>
          <div className="tm-dialog" role="dialog" aria-modal="true" aria-labelledby="ei-pick-title" dir="rtl">
            <header className="tm-dialog-head">
              <h2 id="ei-pick-title">أين تضع «{picking.title}»؟</h2>
            </header>
            <div className="ei-pick">
              {QUADRANTS.map(quadrant => (
                <button
                  key={quadrant.id}
                  type="button"
                  className={picking.quadrant === quadrant.id ? "ei-pick-option is-current" : "ei-pick-option"}
                  onClick={() => place(picking.id, quadrant.id)}
                  disabled={classify.isPending}
                >
                  <span className="ei-pick-title">{quadrant.title}</span>
                  <span className="ei-pick-verb">{quadrant.verb}</span>
                </button>
              ))}
            </div>
            <div className="tm-form-actions">
              <button type="button" className="tm-btn tm-btn-ghost" onClick={() => setPicking(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </TimeLayout>
  );
}
