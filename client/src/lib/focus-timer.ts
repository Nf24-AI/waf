import { toDateInput } from "./clock";
import { readFocusMinutes, writeFocusMinutes } from "./preferences";

/**
 * حساب مؤقّتات التركيز — بلا React وبلا ساعة داخلية.
 *
 * كل دالة تأخذ «الآن» من خارجها: المتصفّح يخنق المؤقّتات في التبويب الخفي،
 * فلا يُعدّ شيء ثانيةً ثانية. يُخزَّن موعد الانتهاء (أو لحظة البدء) ويُطرح
 * منه الآن، فيصحّ الرقم ولو نام التبويب ساعة.
 */

export type RunMode = "timer" | "pomodoro" | "stopwatch";
export type Mode = RunMode | "clock";
export type Phase = "work" | "short" | "long";

/**
 * عدّاد واحد.
 *
 * `anchor` موعد الانتهاء في العدّ التنازلي ولحظة البدء في ساعة الإيقاف، ولا
 * يُقرأ إلا والعدّاد جارٍ. و`value` الثواني الباقية (أو المنقضية) وهو واقف.
 */
export interface Run {
  status: "idle" | "running" | "paused";
  anchor: number;
  value: number;
  /** الطول الكامل بالثواني؛ صفر في ساعة الإيقاف. */
  total: number;
}

export function idleRun(totalSeconds: number): Run {
  return { status: "idle", anchor: 0, value: totalSeconds, total: totalSeconds };
}

export function countdownLeft(run: Run, now: number): number {
  if (run.status !== "running") return run.value;
  return Math.max(0, Math.ceil((run.anchor - now) / 1000));
}

export function stopwatchElapsed(run: Run, now: number): number {
  if (run.status !== "running") return run.value;
  return Math.max(0, Math.floor((now - run.anchor) / 1000));
}

export function startCountdown(run: Run, now: number): Run {
  return { ...run, status: "running", anchor: now + run.value * 1000 };
}

export function pauseCountdown(run: Run, now: number): Run {
  return { ...run, status: "paused", value: countdownLeft(run, now) };
}

export function startStopwatch(run: Run, now: number): Run {
  return { ...run, status: "running", anchor: now - run.value * 1000 };
}

export function pauseStopwatch(run: Run, now: number): Run {
  return { ...run, status: "paused", value: stopwatchElapsed(run, now) };
}

/* ---- بومودورو ---- */

export interface PomodoroSettings {
  work: number;
  short: number;
  long: number;
  /** استراحة طويلة بعد كل كم جلسة عمل. */
  every: number;
  autoBreaks: boolean;
}

/** هدف اليوم الذي يُقاس عليه شريط ساعة الإيقاف. */
export const DAILY_GOAL_SECONDS = 8 * 3600;
/** كل ساعتين تسأل ساعة الإيقاف: أما زلت هنا؟ تبويبٌ منسيّ ليس تركيزاً. */
export const CHECK_EVERY_SECONDS = 120 * 60;

export const DEFAULT_POMODORO: PomodoroSettings = {
  work: 25,
  short: 5,
  long: 15,
  every: 4,
  autoBreaks: false,
};

function within(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

/** ما في التخزين قد يكون قديماً أو معبوثاً به؛ كل خانة تُردّ إلى حدودها. */
export function sanitizePomodoro(raw: unknown, fallbackWork = DEFAULT_POMODORO.work): PomodoroSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    // 240 سقف الخادم لدقائق الجلسة.
    work: within(source.work, 1, 240, fallbackWork),
    short: within(source.short, 1, 120, DEFAULT_POMODORO.short),
    long: within(source.long, 1, 120, DEFAULT_POMODORO.long),
    every: within(source.every, 1, 12, DEFAULT_POMODORO.every),
    autoBreaks: source.autoBreaks === true,
  };
}

export function phaseSeconds(phase: Phase, settings: PomodoroSettings): number {
  return settings[phase] * 60;
}

/** الاستراحة التي تلي جلسة العمل رقم `rounds` (بعد عدّها). */
export function breakAfter(rounds: number, every: number): Phase {
  return rounds > 0 && rounds % every === 0 ? "long" : "short";
}

/* ---- العرض ---- */

/**
 * خانات الوقت كما تُرسم: «25» «00»، وتُضاف الساعات حين تلزم أو تُطلب.
 *
 * مصفوفة لا سلسلة: النقطتان بينهما تُرسمان دائرتين لا حرفاً.
 */
export function timeGroups(seconds: number, options: { hours?: boolean; seconds?: boolean } = {}): string[] {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  const groups = options.hours || h > 0 ? [pad(h), pad(m)] : [pad(m)];
  if (options.seconds !== false) groups.push(pad(s));
  // مؤقّت بلا ثوانٍ ولا ساعات يبقى «00:25» لا «25» وحدها.
  if (groups.length === 1) groups.unshift(pad(h));
  return groups;
}

/** «1h 5m» أو «4m 30s» — للسطور الصغيرة تحت العدّاد. */
export function spokenDuration(seconds: number, lang: "ar" | "en" = "en"): string {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (lang === "ar") return h > 0 ? `${h}س ${m}د` : `${m}د ${safe % 60}ث`;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${safe % 60}s`;
}

/** «00h 18m» — ساعات ودقائق دائماً، لطرفَي شريط ساعة الإيقاف. */
export function hoursMinutes(seconds: number, pad = false, lang: "ar" | "en" = "en"): string {
  const safe = Math.max(0, Math.round(seconds));
  const h = String(Math.floor(safe / 3600)).padStart(pad ? 2 : 1, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(pad ? 2 : 1, "0");
  return lang === "ar" ? `${h}س ${m}د` : `${h}h ${m}m`;
}

/* ---- التخزين المحلّي ---- */

const POMODORO_KEY = "waf:pomodoro";
const TODAY_KEY = "waf:focus-today";
const STATE_KEY = "waf:focus-state";
const SOUND_KEY = "waf:focus-sound";

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التصفّح الخاص يرمي عند الكتابة؛ المؤقّت يعمل بلا حفظ. */
  }
}

export function readPomodoro(): PomodoroSettings {
  // مدّة الإعدادات العامة هي الافتراض حتى يضبط المستخدم البومودورو نفسه.
  return sanitizePomodoro(read(POMODORO_KEY), readFocusMinutes());
}

export function writePomodoro(settings: PomodoroSettings): void {
  write(POMODORO_KEY, settings);
  // تبقى صفحة الإعدادات والمؤقّت على رقم واحد.
  writeFocusMinutes(settings.work);
}

export function readSound(): boolean {
  return read(SOUND_KEY) !== false;
}

export function writeSound(on: boolean): void {
  write(SOUND_KEY, on);
}

/** ثواني التركيز المسجّلة اليوم على هذا الجهاز؛ تُصفَّر بتغيّر اليوم. */
export function readToday(now: Date = new Date()): number {
  const stored = read(TODAY_KEY) as { day?: string; seconds?: number } | null;
  if (!stored || stored.day !== toDateInput(now)) return 0;
  return Number.isFinite(stored.seconds) && (stored.seconds as number) > 0 ? Math.round(stored.seconds as number) : 0;
}

export function addToday(seconds: number, now: Date = new Date()): number {
  const total = readToday(now) + Math.max(0, Math.round(seconds));
  write(TODAY_KEY, { day: toDateInput(now), seconds: total });
  return total;
}

/** ما يُحفظ ليعود المؤقّت كما تُرك بعد إعادة التحميل. */
export interface FocusState {
  mode: Mode;
  phase: Phase;
  rounds: number;
  runs: Record<RunMode, Run>;
  sessions: Record<RunMode, string | null>;
  taskId: string | null;
}

function validRun(raw: unknown, fallback: Run): Run {
  const run = raw as Partial<Run> | null;
  if (!run || !["idle", "running", "paused"].includes(run.status as string)) return fallback;
  if (![run.anchor, run.value, run.total].every(value => Number.isFinite(value) && (value as number) >= 0)) return fallback;
  return { status: run.status as Run["status"], anchor: run.anchor!, value: run.value!, total: run.total! };
}

export function initialFocusState(settings: PomodoroSettings): FocusState {
  return {
    mode: "pomodoro",
    phase: "work",
    rounds: 0,
    runs: { timer: idleRun(0), pomodoro: idleRun(settings.work * 60), stopwatch: idleRun(0) },
    sessions: { timer: null, pomodoro: null, stopwatch: null },
    taskId: null,
  };
}

export function readFocusState(settings: PomodoroSettings): FocusState {
  const fresh = initialFocusState(settings);
  const raw = read(STATE_KEY) as Partial<FocusState> | null;
  if (!raw || typeof raw !== "object") return fresh;

  const session = (value: unknown) => (typeof value === "string" ? value : null);
  return {
    mode: (["timer", "clock", "pomodoro", "stopwatch"] as const).includes(raw.mode as Mode) ? (raw.mode as Mode) : fresh.mode,
    phase: (["work", "short", "long"] as const).includes(raw.phase as Phase) ? (raw.phase as Phase) : fresh.phase,
    rounds: within(raw.rounds, 0, 999, 0),
    runs: {
      timer: validRun(raw.runs?.timer, fresh.runs.timer),
      pomodoro: validRun(raw.runs?.pomodoro, fresh.runs.pomodoro),
      stopwatch: validRun(raw.runs?.stopwatch, fresh.runs.stopwatch),
    },
    sessions: {
      timer: session(raw.sessions?.timer),
      pomodoro: session(raw.sessions?.pomodoro),
      stopwatch: session(raw.sessions?.stopwatch),
    },
    taskId: session(raw.taskId),
  };
}

export function writeFocusState(state: FocusState): void {
  write(STATE_KEY, state);
}
