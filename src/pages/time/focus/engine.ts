// منطق المؤقّتات الخالص: لا React ولا متصفّح. كل مؤقّت مربوط بلحظات زمنية
// (startedAt + banked) لا بعدّاد يزيد كل ثانية، فيبقى صحيحاً في تبويب خامل
// أو بعد إعادة تحميل الصفحة.

export type TimedMode = "timer" | "pomodoro" | "stopwatch";
export type View = TimedMode | "clock";
export type Phase = "work" | "short" | "long";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
/** هدف ساعة الإيقاف اليومي */
export const GOAL_MS = 8 * HOUR_MS;
/** كل ساعتين تتوقّف ساعة الإيقاف وتسأل «ما زلت تعمل؟» */
export const CHECK_EVERY_MS = 2 * HOUR_MS;
/** أطول مؤقّت: ٢٣:٥٩:٥٩ */
export const TIMER_MAX_MS = (23 * 3600 + 59 * 60 + 59) * 1000;
export const TIMER_PRESETS_MIN = [15, 25, 45, 60, 120] as const;

export interface Run {
  /** لحظة آخر تشغيل (ms)، أو null إن كان متوقّفاً */
  startedAt: number | null;
  /** الوقت المنقضي قبل آخر تشغيل */
  banked: number;
  /** مدة العدّ التنازلي، أو null لساعة الإيقاف */
  total: number | null;
}

export interface Session {
  id: string;
  taskId: string | null;
}

export interface PomoSettings {
  work: number;
  short: number;
  long: number;
  every: number;
  autoBreaks: boolean;
}

export const POMO_DEFAULTS: PomoSettings = { work: 25, short: 5, long: 15, every: 4, autoBreaks: false };
export const POMO_RANGES = { work: [1, 240], short: [1, 120], long: [1, 120], every: [1, 12] } as const;

export interface FocusState {
  v: 1;
  view: View;
  timer: { run: Run };
  pomodoro: { run: Run; phase: Phase; rounds: number };
  stopwatch: { run: Run; nextCheck: number; checkPending: boolean };
  sessions: Record<TimedMode, Session | null>;
  taskId: string | null;
}

export type FocusEvent =
  | { type: "finished"; mode: TimedMode; phase: Phase | null; at: number; workedMs: number; session: Session | null }
  | { type: "breakOver"; at: number }
  | { type: "check"; at: number };

// ───────── التشغيلة الواحدة ─────────

export const idleRun = (total: number | null): Run => ({ startedAt: null, banked: 0, total });

export function elapsed(run: Run, now: number): number {
  return Math.max(0, run.banked + (run.startedAt == null ? 0 : now - run.startedAt));
}

export function remaining(run: Run, now: number): number {
  return run.total == null ? 0 : Math.max(0, run.total - elapsed(run, now));
}

export const isRunning = (run: Run) => run.startedAt != null;
/** لم يبدأ بعد: لا يعمل ولم يُحسب منه شيء */
export const isIdle = (run: Run) => run.startedAt == null && run.banked === 0;

/** نسبة التقدّم بين ٠ و ١ */
export function progress(run: Run, now: number, span: number | null = run.total): number {
  if (!span) return 0;
  return Math.min(1, Math.max(0, elapsed(run, now) / span));
}

function startRunAt(run: Run, now: number): Run {
  return run.startedAt != null ? run : { ...run, startedAt: now };
}

function pauseRunAt(run: Run, now: number): Run {
  if (run.startedAt == null) return run;
  const e = elapsed(run, now);
  return { ...run, startedAt: null, banked: run.total == null ? e : Math.min(run.total, e) };
}

// ───────── الإعدادات ─────────

export function phaseMinutes(phase: Phase, s: PomoSettings): number {
  return phase === "work" ? s.work : phase === "short" ? s.short : s.long;
}

function inRange(v: unknown, [lo, hi]: readonly [number, number]): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

/** يقرأ إعدادات بومودورو: القيمة الخارجة عن المدى تُبقي القيمة السابقة */
export function sanitizeSettings(raw: unknown, prev: PomoSettings = POMO_DEFAULTS): PomoSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    work: inRange(r.work, POMO_RANGES.work) ? r.work : prev.work,
    short: inRange(r.short, POMO_RANGES.short) ? r.short : prev.short,
    long: inRange(r.long, POMO_RANGES.long) ? r.long : prev.long,
    every: inRange(r.every, POMO_RANGES.every) ? r.every : prev.every,
    autoBreaks: typeof r.autoBreaks === "boolean" ? r.autoBreaks : prev.autoBreaks,
  };
}

/** الإعدادات الجديدة تسري فوراً فقط إن كان بومودورو لم يبدأ */
export function applySettings(state: FocusState, s: PomoSettings): FocusState {
  const p = state.pomodoro;
  if (!isIdle(p.run)) return state;
  return { ...state, pomodoro: { ...p, run: idleRun(phaseMinutes(p.phase, s) * MINUTE_MS) } };
}

/** الاستراحة التالية بعد جلسة عمل رقمها rounds */
export function breakAfter(rounds: number, every: number): Phase {
  return rounds > 0 && rounds % every === 0 ? "long" : "short";
}

// ───────── الحالة ─────────

export function initialState(s: PomoSettings = POMO_DEFAULTS, timerMs = 25 * MINUTE_MS): FocusState {
  return {
    v: 1,
    view: "pomodoro",
    timer: { run: idleRun(timerMs) },
    pomodoro: { run: idleRun(s.work * MINUTE_MS), phase: "work", rounds: 0 },
    stopwatch: { run: idleRun(null), nextCheck: CHECK_EVERY_MS, checkPending: false },
    sessions: { timer: null, pomodoro: null, stopwatch: null },
    taskId: null,
  };
}

export function runOf(state: FocusState, mode: TimedMode): Run {
  return state[mode].run;
}

function withRun(state: FocusState, mode: TimedMode, run: Run): FocusState {
  if (mode === "timer") return { ...state, timer: { ...state.timer, run } };
  if (mode === "pomodoro") return { ...state, pomodoro: { ...state.pomodoro, run } };
  return { ...state, stopwatch: { ...state.stopwatch, run } };
}

function withSession(state: FocusState, mode: TimedMode, session: Session | null): FocusState {
  return { ...state, sessions: { ...state.sessions, [mode]: session } };
}

/** هل التشغيلة الحالية لهذا الوضع وقت عمل (تُسجَّل) لا استراحة؟ */
export function isWork(state: FocusState, mode: TimedMode): boolean {
  return mode !== "pomodoro" || state.pomodoro.phase === "work";
}

/** المدة المخطّطة بالدقائق لتسجيل الجلسة: ١–٢٤٠، وساعة الإيقاف ٢٤٠ */
export function plannedMinutes(run: Run): number {
  if (run.total == null) return 240;
  return Math.min(240, Math.max(1, Math.round(run.total / MINUTE_MS)));
}

export function start(state: FocusState, mode: TimedMode, now: number, session?: Session | null): FocusState {
  let next = withRun(state, mode, startRunAt(runOf(state, mode), now));
  if (session !== undefined) next = withSession(next, mode, session);
  if (mode === "stopwatch") next = { ...next, stopwatch: { ...next.stopwatch, checkPending: false } };
  return next;
}

export function pause(state: FocusState, mode: TimedMode, now: number): FocusState {
  return withRun(state, mode, pauseRunAt(runOf(state, mode), now));
}

export interface Ended {
  session: Session;
  workedMs: number;
  completed: boolean;
}

/** إعادة ضبط: تُغلق الجلسة المفتوحة غير مكتملة وتعيد التشغيلة إلى بدايتها */
export function reset(state: FocusState, mode: TimedMode, now: number): { state: FocusState; ended: Ended | null } {
  const run = runOf(state, mode);
  const session = state.sessions[mode];
  const ended = session ? { session, workedMs: elapsed(run, now), completed: false } : null;
  let next = withSession(withRun(state, mode, idleRun(run.total)), mode, null);
  if (mode === "stopwatch") next = { ...next, stopwatch: { ...next.stopwatch, nextCheck: CHECK_EVERY_MS, checkPending: false } };
  return { state: next, ended };
}

/** تخطّي مرحلة بومودورو: لا تُحسب جولة، والجلسة تُغلق غير مكتملة */
export function skip(state: FocusState, now: number, s: PomoSettings): { state: FocusState; ended: Ended | null } {
  const p = state.pomodoro;
  const session = state.sessions.pomodoro;
  const ended = session ? { session, workedMs: elapsed(p.run, now), completed: false } : null;
  const phase: Phase = p.phase === "work" ? breakAfter(p.rounds + 1, s.every) : "work";
  const next = { ...state, pomodoro: { ...p, phase, run: idleRun(phaseMinutes(phase, s) * MINUTE_MS) } };
  return { state: withSession(next, "pomodoro", null), ended };
}

/** يضبط مدة المؤقّت (قبل البدء فقط) */
export function setTimerDuration(state: FocusState, ms: number): FocusState {
  if (!isIdle(state.timer.run)) return state;
  const total = Math.min(TIMER_MAX_MS, Math.max(1000, Math.round(ms / 1000) * 1000));
  return { ...state, timer: { run: idleRun(total) } };
}

/** يُنهي الجلسات المرتبطة بمهمة (حين تُنجَز المهمة من القائمة) */
export function endTaskSessions(state: FocusState, taskId: string, now: number): { state: FocusState; ended: Ended[] } {
  let next = state;
  const ended: Ended[] = [];
  for (const mode of ["timer", "pomodoro", "stopwatch"] as const) {
    if (next.sessions[mode]?.taskId === taskId) {
      const r = reset(next, mode, now);
      next = r.state;
      if (r.ended) ended.push(r.ended);
    }
  }
  return { state: { ...next, taskId: next.taskId === taskId ? null : next.taskId }, ended };
}

export function hasOpenSession(state: FocusState): boolean {
  return Object.values(state.sessions).some(Boolean);
}

/**
 * يقدّم الحالة حتى اللحظة now ويعيد ما حدث في الطريق. يعالج كل الانتهاءات
 * المتتالية (عمل ← استراحة تلقائية ← نهايتها) بلحظاتها الحقيقية، فيصحّ بعد
 * تبويب خامل أو إعادة تحميل.
 */
export function advance(state: FocusState, now: number, s: PomoSettings): { state: FocusState; events: FocusEvent[] } {
  const events: FocusEvent[] = [];
  let next = state;

  // المؤقّت
  {
    const run = next.timer.run;
    if (run.startedAt != null && run.total != null && remaining(run, now) <= 0) {
      const at = run.startedAt + (run.total - run.banked);
      events.push({ type: "finished", mode: "timer", phase: null, at, workedMs: run.total, session: next.sessions.timer });
      next = withSession({ ...next, timer: { run: idleRun(run.total) } }, "timer", null);
    }
  }

  // بومودورو: قد تنتهي أكثر من مرحلة
  for (let guard = 0; guard < 50; guard++) {
    const p = next.pomodoro;
    const run = p.run;
    if (run.startedAt == null || run.total == null || remaining(run, now) > 0) break;
    const at = run.startedAt + (run.total - run.banked);
    if (p.phase === "work") {
      const rounds = p.rounds + 1;
      const phase = breakAfter(rounds, s.every);
      events.push({ type: "finished", mode: "pomodoro", phase: "work", at, workedMs: run.total, session: next.sessions.pomodoro });
      const breakRun: Run = { startedAt: s.autoBreaks ? at : null, banked: 0, total: phaseMinutes(phase, s) * MINUTE_MS };
      next = withSession({ ...next, pomodoro: { phase, rounds, run: breakRun } }, "pomodoro", null);
    } else {
      events.push({ type: "breakOver", at });
      next = { ...next, pomodoro: { ...p, phase: "work", run: idleRun(s.work * MINUTE_MS) } };
    }
  }

  // ساعة الإيقاف: تتوقّف عند كل نقطة تحقّق
  {
    const sw = next.stopwatch;
    if (sw.run.startedAt != null && elapsed(sw.run, now) >= sw.nextCheck) {
      const at = sw.run.startedAt + (sw.nextCheck - sw.run.banked);
      events.push({ type: "check", at });
      next = { ...next, stopwatch: { run: { ...sw.run, startedAt: null, banked: sw.nextCheck }, nextCheck: sw.nextCheck + CHECK_EVERY_MS, checkPending: true } };
    }
  }

  return { state: next, events };
}

/** الوقت المسجَّل الجاري الآن (جلسات العمل المفتوحة فقط) */
export function openWorkMs(state: FocusState, now: number): number {
  let sum = 0;
  for (const mode of ["timer", "pomodoro", "stopwatch"] as const) {
    if (state.sessions[mode] && isWork(state, mode)) sum += elapsed(runOf(state, mode), now);
  }
  return sum;
}

// ───────── التخزين ─────────

const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;

function sanitizeRun(raw: unknown, fallbackTotal: number | null, now: number, maxTotal = 240 * MINUTE_MS): Run {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const total = fallbackTotal == null ? null : num(r.total, fallbackTotal, 1000, Math.max(maxTotal, fallbackTotal));
  let startedAt = r.startedAt == null ? null : num(r.startedAt, NaN);
  if (startedAt != null && Number.isNaN(startedAt)) startedAt = null;
  // ساعة الجهاز رجعت للخلف: نبدأ من الآن بدل وقت سالب
  if (startedAt != null && startedAt > now) startedAt = now;
  let banked = num(r.banked, 0);
  if (total != null) banked = Math.min(banked, total);
  return { startedAt, banked, total };
}

function sanitizeSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  return { id: r.id, taskId: typeof r.taskId === "string" && r.taskId ? r.taskId : null };
}

const VIEWS: View[] = ["timer", "pomodoro", "stopwatch", "clock"];
const PHASES: Phase[] = ["work", "short", "long"];

/** يقرأ الحالة المحفوظة ويصحّح ما فسد منها؛ ما لا يُقرأ يعود لقيمته الأولى */
export function sanitizeState(raw: unknown, s: PomoSettings, now: number): FocusState {
  const base = initialState(s);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, any>;
  if (r.v !== 1) return base;
  const phase: Phase = PHASES.includes(r.pomodoro?.phase) ? r.pomodoro.phase : "work";
  const pomoRun = sanitizeRun(r.pomodoro?.run, phaseMinutes(phase, s) * MINUTE_MS, now);
  const swRun = sanitizeRun(r.stopwatch?.run, null, now);
  let nextCheck = num(r.stopwatch?.nextCheck, CHECK_EVERY_MS, CHECK_EVERY_MS);
  if (nextCheck % CHECK_EVERY_MS !== 0) nextCheck = CHECK_EVERY_MS;
  return {
    v: 1,
    view: VIEWS.includes(r.view) ? r.view : base.view,
    timer: { run: sanitizeRun(r.timer?.run, base.timer.run.total, now, TIMER_MAX_MS) },
    pomodoro: { run: pomoRun, phase, rounds: Math.floor(num(r.pomodoro?.rounds, 0, 0, 10_000)) },
    stopwatch: { run: swRun, nextCheck, checkPending: r.stopwatch?.checkPending === true && !isRunning(swRun) },
    sessions: {
      timer: sanitizeSession(r.sessions?.timer),
      pomodoro: phase === "work" ? sanitizeSession(r.sessions?.pomodoro) : null,
      stopwatch: sanitizeSession(r.sessions?.stopwatch),
    },
    taskId: typeof r.taskId === "string" && r.taskId ? r.taskId : null,
  };
}

// ───────── العرض ─────────

const pad = (n: number) => String(n).padStart(2, "0");

/** "25:00" أو "1:05:00". العدّ التنازلي يقرّب للأعلى فيبدأ بـ 25:00 وينتهي بـ 00:00 */
export function formatDigits(ms: number, countdown: boolean): string {
  const total = Math.max(0, countdown ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** يقسم مدة إلى ساعات ودقائق وثوانٍ لحقول الإعداد */
export function splitHms(ms: number): { h: number; m: number; s: number } {
  const total = Math.round(ms / 1000);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function hmsToMs(h: number, m: number, s: number): number {
  const c = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);
  return (c(h, 23) * 3600 + c(m, 59) * 60 + c(s, 59)) * 1000;
}

export interface Quote {
  ar: string;
  en: string;
  by: [string, string] | null;
}

export const QUOTES: Quote[] = [
  { ar: "نحن ما نفعله مراراً. فالإتقان ليس فعلاً، بل عادة.", en: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", by: ["أرسطو", "Aristotle"] },
  { ar: "الوقت كالسيف، إن لم تقطعه قطعك.", en: "Time is a sword: if you don’t cut it, it cuts you.", by: ["مثل عربي", "Arab proverb"] },
  { ar: "الوقت أكثر ما نريده، وأسوأ ما نستعمله.", en: "Time is what we want most, but what we use worst.", by: ["وليام بن", "William Penn"] },
  { ar: "أتحبّ الحياة؟ إذن لا تُضِع الوقت، فهو مادّتها.", en: "Do you love life? Then do not squander time, for that is the stuff life is made of.", by: ["بنجامين فرانكلين", "Benjamin Franklin"] },
  { ar: "لا تؤجّل عمل اليوم إلى الغد.", en: "Don’t put off until tomorrow what you can do today.", by: null },
];

/** اقتباس اليوم يتغيّر بيوم الشهر */
export function quoteOfDay(date: Date): Quote {
  return QUOTES[(date.getDate() - 1) % QUOTES.length];
}
