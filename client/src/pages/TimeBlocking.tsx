// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, Timer } from "lucide-react";
import { Link } from "wouter";
import { quadrantTitle, type Task } from "@shared/tasks";
import { TIME_METHOD_ROUTES } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import { endTime, nextHalfHour, toDateInput, toIso, toTimeInput } from "@/lib/clock";
import { useTaskParam } from "@/lib/task-param";
import { trpc } from "@/lib/trpc";

/**
 * حجز الوقت — يعطي مهمةً قائمةً وقتاً، ولا ينشئ مهمة.
 *
 * يبدأ بالمهمة التي جاء منها المستخدم إن جاء من بطاقتها، وإلا عرض مهامه
 * ليختار. والوقت المقترح من تقديره هو، فإن لم يقدّر فساعة — لا لأنها صحيحة
 * بل لأنها رقم صريح يُعدَّل، أهون من خانة فارغة.
 */

export default function TimeBlocking() {
  const preselected = useTaskParam();

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  const [taskId, setTaskId] = useState<string | null>(preselected);
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [start, setStart] = useState(() => toTimeInput(nextHalfHour()));
  const [minutes, setMinutes] = useState(60);
  const [done, setDone] = useState<Task | null>(null);

  const tasks = open.data ?? [];
  const task = useMemo(() => tasks.find(item => item.id === taskId) ?? null, [tasks, taskId]);

  // المدة المقترحة من تقدير صاحب المهمة، حين تُعرف المهمة.
  useEffect(() => {
    if (task?.estimatedMinutes) setMinutes(task.estimatedMinutes);
  }, [task?.id, task?.estimatedMinutes]);

  const schedule = trpc.tasks.schedule.useMutation({
    onSuccess: async scheduled => {
      await utils.tasks.listOpen.invalidate();
      setDone(scheduled);
    },
  });

  const endLabel = useMemo(() => endTime(day, start, minutes), [day, start, minutes]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!task || !start) return;
    const startIso = toIso(day, start);
    const endIso = new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
    schedule.mutate({ id: task.id, start: startIso, end: endIso });
  }

  return (
    <TimeLayout>
      <div className="tm-inner">
        <header className="tm-head">
          <h1>حجز الوقت</h1>
          <p>ضع لكل مهمة وقتاً واضحاً.</p>
        </header>

        {status.data?.configured === false && (
          <p className="tm-empty" style={{ marginBlockStart: "var(--space-9)" }}>
            المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> و
            <code>TASKS_OWNER_CODE</code> ثم أعد النشر.
          </p>
        )}

        {open.isSuccess && tasks.length === 0 && (
          <div className="tm-empty-state" style={{ marginBlockStart: "var(--space-9)" }}>
            <p>لا مهام تنتظر وقتاً.</p>
            <p className="tm-empty-hint">أضف مهمة من إدارة الوقت أولاً.</p>
          </div>
        )}

        {tasks.length > 0 && !done && (
          <section className="tm-section" aria-labelledby="tb-pick">
            <h2 id="tb-pick">أي مهمة؟</h2>
            <div className="ei-chips">
              {tasks.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === taskId ? "ei-chip is-current" : "ei-chip"}
                  onClick={() => setTaskId(item.id)}
                  aria-pressed={item.id === taskId}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </section>
        )}

        {task && !done && (
          <section className="tm-section" aria-labelledby="tb-when">
            <h2 id="tb-when">متى؟</h2>

            <form className="tb-card" onSubmit={submit}>
              <p className="tb-task">
                {task.title}
                <span>{task.quadrant ? quadrantTitle(task.quadrant) : "غير مصنّفة"}</span>
              </p>

              <div className="tm-field-row">
                <label className="tm-field">
                  <span>اليوم</span>
                  <input type="date" value={day} onChange={event => setDay(event.target.value)} required />
                </label>
                <label className="tm-field">
                  <span>وقت البداية</span>
                  <input type="time" value={start} onChange={event => setStart(event.target.value)} required />
                </label>
              </div>

              <div className="tm-field">
                <span>المدة</span>
                <div className="tb-durations">
                  {[25, 45, 60, 90].map(option => (
                    <button
                      key={option}
                      type="button"
                      className={minutes === option ? "tb-duration is-current" : "tb-duration"}
                      onClick={() => setMinutes(option)}
                      aria-pressed={minutes === option}
                    >
                      {option} دقيقة
                    </button>
                  ))}
                </div>
              </div>

              <p className="tb-preview">
                {start} — {endLabel}
                <span>{minutes} دقيقة</span>
              </p>

              {schedule.error && (
                <p className="tm-form-error" role="alert">
                  {schedule.error.message}
                  {schedule.error.data?.code === "CONFLICT" && " — اختر وقتاً آخر."}
                </p>
              )}

              <div className="tm-form-actions">
                <button type="submit" className="tm-btn tm-btn-primary" disabled={schedule.isPending}>
                  <CalendarClock size={16} aria-hidden="true" />
                  حجز الوقت
                </button>
              </div>
            </form>
          </section>
        )}

        {done && (
          <section className="tm-section">
            <div className="tb-done">
              <p className="tb-done-title">حُجز وقت «{done.title}».</p>
              <p className="tb-done-when">
                {done.scheduledStart && new Date(done.scheduledStart).toLocaleString("ar-SA", {
                  weekday: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </p>
              <div className="tm-form-actions">
                <Link className="tm-btn tm-btn-primary" href={`${TIME_METHOD_ROUTES.focus}?task=${done.id}`}>
                  <Timer size={16} aria-hidden="true" />
                  ابدأ التركيز الآن
                </Link>
                <button
                  type="button"
                  className="tm-btn tm-btn-ghost"
                  onClick={() => {
                    setDone(null);
                    setTaskId(null);
                  }}
                >
                  احجز لمهمة أخرى
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </TimeLayout>
  );
}
