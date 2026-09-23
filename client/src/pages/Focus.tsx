// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Link } from "wouter";
import { type Task } from "@shared/tasks";
import { TIME_METHOD_ROUTES } from "@shared/routes";
import TimeLayout from "@/components/time/TimeLayout";
import { clock } from "@/lib/clock";
import { readFocusMinutes } from "@/lib/preferences";
import { useTaskParam } from "@/lib/task-param";
import { prefersReducedMotion } from "@/lib/motion";
import { trpc } from "@/lib/trpc";

/**
 * جلسة التركيز — أهدأ ما في إدارة الوقت.
 *
 * لا إحصاء ولا قوائم ولا شيء يُقرأ أثناء الجلسة: المهمة واسمها ووقتها. وما
 * عداه يصرف عن الشيء الذي جاء المستخدم ليحميه.
 *
 * وحين ينتهي الوقت لا تُعدّ المهمة منجَزة: يُسأل صاحبها. الوقت انقضى، وهذا
 * كل ما يعرفه المؤقّت — أمّا الإنجاز فيعرفه هو وحده.
 */

const DURATIONS = [25, 50] as const;

export default function Focus() {
  const preselected = useTaskParam();
  const reduced = prefersReducedMotion();

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  const [taskId, setTaskId] = useState<string | null>(preselected);
  const [minutes, setMinutes] = useState<number>(() => readFocusMinutes());
  const [custom, setCustom] = useState("");
  const [left, setLeft] = useState(() => readFocusMinutes() * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  /**
   * الموعد لا العدّ.
   *
   * المتصفّح يخنق المؤقّتات في التبويب الخفي، وجلسة خمس وعشرين دقيقة تُعدّ
   * ثانيةً ثانية تنتهي متأخّرة دقائق. فنخزّن لحظة الانتهاء ونطرح منها الآن.
   */
  const deadline = useRef<number | null>(null);

  const tasks = open.data ?? [];
  const task: Task | null = useMemo(() => tasks.find(item => item.id === taskId) ?? null, [tasks, taskId]);

  const startSession = trpc.tasks.startFocus.useMutation({
    onSuccess: ({ sessionId: id }) => {
      setSessionId(id);
      // من لحظة وصول الردّ لا من لحظة الضغط: زمن الشبكة لا يُقتطع من الجلسة.
      deadline.current = Date.now() + minutes * 60_000;
      setLeft(minutes * 60);
      setRunning(true);
    },
  });
  const endSession = trpc.tasks.endFocus.useMutation();
  const complete = trpc.tasks.complete.useMutation({
    onSuccess: () => utils.tasks.listOpen.invalidate(),
  });

  /** تُغلق الجلسة ويُسأل صاحبها — سواء انقضى الوقت أو قُطع. */
  function finish(ranOut: boolean) {
    setRunning(false);
    deadline.current = null;
    // الجلسة تُسجَّل ولو قُطعت: الوقت أُنفق، والإحصاء يقيس الوقت لا النجاح.
    if (sessionId) endSession.mutate({ sessionId, completed: ranOut });
    setSessionId(null);
    setAsking(true);
  }

  useEffect(() => {
    if (!running) return;
    const settle = () => {
      const remaining = Math.max(0, Math.round(((deadline.current ?? 0) - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) finish(true);
    };
    settle();
    const id = window.setInterval(settle, 500);
    return () => window.clearInterval(id);
  }, [running, sessionId]);

  const total = minutes * 60;
  const progress = total > 0 ? 1 - left / total : 0;
  const circumference = 2 * Math.PI * 86;

  // جلسة مفتوحة والعدّاد واقف: موقوفة مؤقتاً، لا منتهية ولا جديدة.
  const paused = sessionId !== null && !running;
  const idle = !running && !paused && !asking;

  function pick(value: number) {
    setMinutes(value);
    setLeft(value * 60);
  }

  function begin() {
    if (!task) return;
    startSession.mutate({ taskId: task.id, minutes });
  }

  function resume() {
    deadline.current = Date.now() + left * 1000;
    setRunning(true);
  }

  return (
    <TimeLayout quiet={running || paused}>
      <div className="fc-inner">

        {status.data?.configured === false && (
          <p className="tm-empty">
            المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> و
            <code>TASKS_OWNER_CODE</code> ثم أعد النشر.
          </p>
        )}

        {open.isSuccess && tasks.length === 0 && (
          <div className="tm-empty-state">
            <p>لا مهام تركّز عليها.</p>
            <p className="tm-empty-hint">أضف مهمة من إدارة الوقت لتبدأ بها.</p>
          </div>
        )}

        {/* اختيار المهمة يختفي مع بدء الجلسة: لا شيء يُقرأ وأنت تركّز. */}
        {tasks.length > 0 && idle && (
          <section className="fc-pick">
            <h2>على أي مهمة تركّز؟</h2>
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

        {task && !asking && (
          <section className="fc-stage">
            <p className="fc-task">{task.title}</p>

            <div className="fc-dial">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle className="fc-track" cx="100" cy="100" r="86" />
                <circle
                  className="fc-arc"
                  cx="100"
                  cy="100"
                  r="86"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: circumference * (1 - progress),
                    transition: reduced ? "none" : "stroke-dashoffset .5s linear",
                  }}
                />
              </svg>
              {/* لا يُعلَن كل ثانية: قارئ الشاشة لا يقاطع التركيز ستّين مرة في الدقيقة. */}
              <p className="fc-clock" role="timer" aria-live="off">
                {clock(left)}
              </p>
            </div>

            {idle && (
              <div className="fc-durations">
                {DURATIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={minutes === option ? "tb-duration is-current" : "tb-duration"}
                    onClick={() => pick(option)}
                    aria-pressed={minutes === option}
                  >
                    {option} دقيقة
                  </button>
                ))}
                <label className="fc-custom">
                  <span className="sr-only">مدة مخصّصة بالدقائق</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={custom}
                    placeholder="مخصّصة"
                    onChange={event => {
                      setCustom(event.target.value);
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value >= 1 && value <= 240) pick(value);
                    }}
                  />
                </label>
              </div>
            )}

            <div className="fc-actions">
              {idle && (
                <button
                  type="button"
                  className="fc-go"
                  onClick={begin}
                  disabled={startSession.isPending}
                  aria-label="ابدأ الجلسة"
                >
                  <Play size={26} aria-hidden="true" />
                </button>
              )}
              {running && (
                <button type="button" className="tm-btn tm-btn-ghost" onClick={() => setRunning(false)}>
                  <Pause size={16} aria-hidden="true" />
                  إيقاف مؤقت
                </button>
              )}
              {paused && (
                <button type="button" className="tm-btn tm-btn-primary" onClick={resume}>
                  <Play size={16} aria-hidden="true" />
                  استئناف
                </button>
              )}
              {(running || paused) && (
                <button type="button" className="tm-btn tm-btn-ghost" onClick={() => finish(false)}>
                  <Square size={16} aria-hidden="true" />
                  إنهاء الجلسة
                </button>
              )}
            </div>

            {startSession.error && (
              <p className="tm-form-error" role="alert">
                {startSession.error.message}
              </p>
            )}
          </section>
        )}

        {/* انتهى الوقت — ولا يعرف إن أُنجزت إلا صاحبها. */}
        {asking && task && (
          <section className="fc-ask" role="status">
            <h2>انتهى الوقت.</h2>
            <p>هل أنجزت المهمة؟</p>
            <div className="fc-ask-actions">
              <button
                type="button"
                className="tm-btn tm-btn-primary"
                disabled={complete.isPending}
                onClick={() => {
                  complete.mutate({ id: task.id });
                  setAsking(false);
                  setTaskId(null);
                  setLeft(minutes * 60);
                }}
              >
                نعم، أنجزتها
              </button>
              <button
                type="button"
                className="tm-btn tm-btn-ghost"
                onClick={() => {
                  setAsking(false);
                  setLeft(minutes * 60);
                }}
              >
                أحتاج وقتاً أكثر
              </button>
              {/* «لاحقاً» يعني وقتاً آخر، فتُعاد إلى حجز الوقت لا إلى القائمة. */}
              <Link className="tm-btn tm-btn-ghost" href={`${TIME_METHOD_ROUTES.timeBlocking}?task=${task.id}`}>
                جدولها لاحقاً
              </Link>
            </div>
          </section>
        )}
      </div>
    </TimeLayout>
  );
}
