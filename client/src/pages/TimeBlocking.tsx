// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, Timer } from "lucide-react";
import { Link } from "wouter";
import { quadrantTitle, type RepeatRule, type Task } from "@shared/tasks";
import { TIME_METHOD_ROUTES } from "@shared/routes";
import FlowSteps from "@/components/time/FlowSteps";
import TimeLayout from "@/components/time/TimeLayout";
import { flowHref, useInFlow } from "@/lib/flow";
import { dayName, dayStrip, endTime, nextHalfHour, toDateInput, toIso, toTimeInput } from "@/lib/clock";
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

  // الرحلة تُغيّر الوجهة التالية وحدها، لا ما تفعله الصفحة.
  const inFlow = useInFlow();

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  const [taskId, setTaskId] = useState<string | null>(preselected);
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [start, setStart] = useState(() => toTimeInput(nextHalfHour()));
  const [minutes, setMinutes] = useState(60);
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [done, setDone] = useState<Task | null>(null);

  // الشريط يُبنى مرّة: إعادة بنائه في كل رسم تُنشئ تواريخ جديدة بلا سبب.
  const days = useMemo(() => dayStrip(), []);

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
    schedule.mutate({ id: task.id, start: startIso, end: endIso, repeatRule: repeat });
  }

  return (
    <TimeLayout>
      <div className="tm-inner">
        <FlowSteps current="schedule" />

        <header className="tp-head">
          <h1>اختر وقتاً للمهمة</h1>
          <p>ضع لكل مهمة وقتاً مناسباً.</p>
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

              <div className="tm-field">
                <span>اليوم</span>
                <div className="tp-days" role="group" aria-label="اليوم">
                  {days.map(date => {
                    const value = toDateInput(date);
                    const current = value === day;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={current ? "tp-day is-current" : "tp-day"}
                        onClick={() => setDay(value)}
                        aria-pressed={current}
                      >
                        <span className="tp-day-name">{dayName(date)}</span>
                        <span className="tp-day-num">{date.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tm-field-row">
                <label className="tm-field">
                  <span>وقت البداية</span>
                  <input type="time" value={start} onChange={event => setStart(event.target.value)} required />
                </label>
                <label className="tm-field">
                  <span>يوم آخر</span>
                  <input type="date" value={day} onChange={event => setDay(event.target.value)} required />
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

              <div className="tm-field">
                <span>تكرار المهمة</span>
                {/*
                  ثلاث حالات لا مفتاحان: «نعم» وحدها لا تقول كل كم يتكرّر،
                  ومن يضغطها يبقى لا يعرف ماذا حجز.
                */}
                <div className="tb-durations" role="group" aria-label="تكرار المهمة">
                  {([
                    { value: null, label: "لا يتكرّر" },
                    { value: "daily" as const, label: "كل يوم" },
                    { value: "weekly" as const, label: "كل أسبوع" },
                  ]).map(option => (
                    <button
                      key={option.label}
                      type="button"
                      className={repeat === option.value ? "tb-duration is-current" : "tb-duration"}
                      onClick={() => setRepeat(option.value)}
                      aria-pressed={repeat === option.value}
                    >
                      {option.label}
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
                <button type="submit" className="tp-btn tp-btn-primary" disabled={schedule.isPending}>
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
                <Link
                  className="tp-btn tp-btn-primary"
                  href={inFlow ? flowHref(TIME_METHOD_ROUTES.focus, done.id) : `${TIME_METHOD_ROUTES.focus}?task=${done.id}`}
                >
                  <Timer size={16} aria-hidden="true" />
                  ابدأ التركيز الآن
                </Link>
                <button
                  type="button"
                  className="tp-btn"
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
