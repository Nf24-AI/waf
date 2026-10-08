// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  AudioWaveform,
  Bird,
  Brain,
  Check,
  ChevronDown,
  Clock,
  CloudLightning,
  CloudRain,
  Coffee,
  Fan,
  Flame,
  Keyboard,
  ListTodo,
  Maximize,
  Minimize,
  Music,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Settings,
  Tag,
  Target,
  Timer,
  TreePine,
  Volume1,
  Volume2,
  VolumeX,
  Watch,
  Waves,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { type Task } from "@shared/tasks";
import FocusBar from "@/components/focus/FocusBar";
import {
  AMBIENCE,
  type AmbienceId,
  playingAmbience,
  setAmbienceVolume,
  stopAmbience,
  toggleAmbience,
} from "@/lib/ambience";
import { chime } from "@/lib/chime";
import {
  addToday,
  breakAfter,
  CHECK_EVERY_SECONDS,
  countdownLeft,
  DAILY_GOAL_SECONDS,
  type FocusState,
  hoursMinutes,
  idleRun,
  type Mode,
  pauseCountdown,
  pauseStopwatch,
  type Phase,
  phaseSeconds,
  type PomodoroSettings,
  readFocusState,
  readPomodoro,
  readSound,
  readToday,
  type Run,
  type RunMode,
  spokenDuration,
  startCountdown,
  startStopwatch,
  stopwatchElapsed,
  timeGroups,
  writeFocusState,
  writePomodoro,
  writeSound,
} from "@/lib/focus-timer";
import { dir, getLang, locale, pair, type Pair, pick, t } from "@/lib/i18n";
import { useStudyingNow } from "@/lib/presence";
import { embedUrl } from "@/lib/stream";
import { trpc } from "@/lib/trpc";

/**
 * التركيز — أربعة مؤقّتات على مسرح واحد: مؤقّت، ساعة، بومودورو، ساعة إيقاف.
 *
 * الصفحة بالإنجليزية ومن اليسار، على خلاف بقيّة واف: طُلبت مطابِقةً لمرجعها
 * حرفاً بحرف، والمرجع إنجليزي. فالنصوص هنا مجموعة في هذا الملفّ وحده، وما
 * خارجه على عربيّته.
 *
 * الرقم أكبر ما في الشاشة ويُقرأ من آخر الغرفة، وما عداه يبهت حوله. والمهمة
 * اختيارية: المؤقّت يعمل بلا مهمة، ومع مهمة تُسجَّل الجلسة في الإحصاء.
 *
 * وحين ينتهي الوقت لا تُعدّ المهمة منجَزة: يُسأل صاحبها. الوقت انقضى، وهذا
 * كل ما يعرفه المؤقّت — أمّا الإنجاز فيعرفه هو وحده.
 */

const MODES: { id: Mode; label: Pair; icon: typeof Timer }[] = [
  { id: "timer", label: pair("مؤقّت", "Timer"), icon: Timer },
  { id: "clock", label: pair("ساعة", "Clock"), icon: Clock },
  { id: "pomodoro", label: pair("بومودورو", "Pomodoro"), icon: Timer },
  { id: "stopwatch", label: pair("ساعة إيقاف", "Stopwatch"), icon: Watch },
];

const PHASE_LABELS: Record<Phase, Pair> = {
  work: pair("وقت التركيز", "Focus Time"),
  short: pair("استراحة قصيرة", "Short Break"),
  long: pair("استراحة طويلة", "Long Break"),
};

const PRESETS = [
  { label: pair("15 د", "15m"), seconds: 15 * 60 },
  { label: pair("25 د", "25m"), seconds: 25 * 60 },
  { label: pair("45 د", "45m"), seconds: 45 * 60 },
  { label: pair("1 س", "1h"), seconds: 60 * 60 },
  { label: pair("2 س", "2h"), seconds: 120 * 60 },
];

/** سطر هادئ تحت المؤقّت والساعة؛ يتبدّل بتبدّل اليوم لا بكل تحميل. */
const QUOTES = [
  [pair("حُسن البداية نصف الإنجاز.", "Well begun is half done."), pair("أرسطو", "Aristotle")],
  [pair("القليل على القليل يصير كثيراً.", "Little by little, a little becomes a lot."), pair("مثل", "Proverb")],
  [pair("الوقت أكثر ما نريده، وأسوأ ما نستعمله.", "Time is what we want most, but what we use worst."), pair("ويليام بن", "William Penn")],
  [pair("الوقت الضائع لا يعود.", "Lost time is never found again."), pair("بنجامين فرانكلين", "Benjamin Franklin")],
  [pair("لا تؤجّل عمل اليوم إلى الغد.", "Never leave till tomorrow what you can do today."), pair("مثل", "Proverb")],
];

const AMBIENCE_ICONS: Record<AmbienceId, typeof Timer> = {
  fireplace: Flame,
  nature: Bird,
  ocean: Waves,
  rain: CloudRain,
  cafe: Coffee,
  forest: TreePine,
  brown: AudioLines,
  white: AudioWaveform,
  thunder: CloudLightning,
  keyboard: Keyboard,
  fan: Fan,
  theta: Brain,
};

type Panel = "settings" | "label" | "seconds" | "sounds" | "music" | null;

/** نافذة صغيرة فوق كل النوافذ — في المتصفّحات التي تدعمها وحدها. */
const pictureInPicture = () =>
  (window as unknown as {
    documentPictureInPicture?: { requestWindow(options: { width: number; height: number }): Promise<Window> };
  }).documentPictureInPicture;

/** سقف الخادم لدقائق الجلسة الواحدة. */
const MAX_SESSION_MINUTES = 240;

const STREAM_KEY = "waf:focus-stream";

function storedStream(): string {
  try {
    return localStorage.getItem(STREAM_KEY) ?? "";
  } catch {
    return "";
  }
}

/** هذا الإطار يقرأ مهامه وحدها ويكتبها باسمه؛ انظر TASK_ORIGINS. */
const ORIGIN = "focus" as const;

export default function Focus() {
  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery({ origin: ORIGIN }, { enabled: status.data?.configured === true });

  const [settings, setSettings] = useState<PomodoroSettings>(() => readPomodoro());
  const [state, setState] = useState<FocusState>(() => readFocusState(readPomodoro()));
  const [now, setNow] = useState(() => Date.now());
  const [today, setToday] = useState(() => readToday());
  const [sound, setSound] = useState(() => readSound());
  const [panel, setPanel] = useState<Panel>(null);
  // الدرج حالٌ وحده: يبقى مفتوحاً وأنت تفتح الأصوات أو الإعدادات، كما في المرجع.
  const [todoOpen, setTodoOpen] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [askingId, setAskingId] = useState<string | null>(null);
  const [fields, setFields] = useState({ h: "", m: "", s: "" });
  const [showSeconds, setShowSeconds] = useState(true);
  const [hours24, setHours24] = useState(false);
  const [mini, setMini] = useState<Window | null>(null);
  const [ambience, setAmbience] = useState<AmbienceId[]>(() => playingAmbience());
  const [volume, setVolume] = useState(50);
  const [streamDraft, setStreamDraft] = useState(() => storedStream());
  const [stream, setStream] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  const { mode, phase, rounds, runs, sessions } = state;
  const tasks = open.data ?? [];
  const task: Task | null = useMemo(
    () => tasks.find(item => item.id === state.taskId) ?? null,
    [tasks, state.taskId],
  );
  const asked = tasks.find(item => item.id === askingId) ?? null;

  const startSession = trpc.tasks.startFocus.useMutation();
  const endSession = trpc.tasks.endFocus.useMutation();
  const complete = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      setDoneCount(count => count + 1);
      void utils.tasks.listOpen.invalidate();
    },
  });
  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setNewTask("");
      void utils.tasks.listOpen.invalidate();
    },
  });

  const anyRunning = Object.values(runs).some(run => run.status === "running");
  const sessionOpen = Object.values(sessions).some(Boolean);
  const isWork = (which: RunMode) => which !== "pomodoro" || phase === "work";
  const studying = (["timer", "pomodoro", "stopwatch"] as const).some(
    which => runs[which].status === "running" && isWork(which),
  );
  const studyingNow = useStudyingNow(studying);

  // النبض للعرض وحده: الحساب من الموعد، فتأخّر النبضة لا يؤخّر الوقت.
  useEffect(() => {
    if (!anyRunning && mode !== "clock") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [anyRunning, mode]);

  useEffect(() => writeFocusState(state), [state]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // الأصوات تُطفأ مع مغادرة الصفحة: مطرٌ يهطل في صفحة المهام عطلٌ لا ميزة.
  useEffect(() => () => stopAmbience(), []);

  /** ما قُضي منذ آخر بدء، يُضاف إلى مجموع اليوم — للعمل لا للاستراحة. */
  function credit(which: RunMode, at: number) {
    const run = runs[which];
    if (run.status !== "running" || !isWork(which)) return;
    const spent = which === "stopwatch" ? stopwatchElapsed(run, at) - run.value : run.value - countdownLeft(run, at);
    if (spent > 0) setToday(addToday(spent));
  }

  function setRun(which: RunMode, run: Run, extra: Partial<FocusState> = {}) {
    setState(previous => ({ ...previous, ...extra, runs: { ...previous.runs, [which]: run } }));
  }

  /** تُغلق الجلسة في الخادم ولو قُطعت: الوقت أُنفق، والإحصاء يقيس الوقت لا النجاح. */
  function closeSession(which: RunMode, ranOut: boolean) {
    const sessionId = sessions[which];
    if (!sessionId) return;
    endSession.mutate({ sessionId, completed: ranOut });
    setState(previous => ({ ...previous, sessions: { ...previous.sessions, [which]: null } }));
    if (state.taskId) setAskingId(state.taskId);
  }

  async function start(which: RunMode, from: Run = runs[which]) {
    if (which !== "stopwatch" && from.value <= 0) return;
    setAskingId(null);

    if (task && isWork(which) && !sessions[which]) {
      const minutes =
        which === "stopwatch"
          ? MAX_SESSION_MINUTES
          : Math.min(MAX_SESSION_MINUTES, Math.max(1, Math.round(from.total / 60)));
      try {
        const { sessionId } = await startSession.mutateAsync({ taskId: task.id, minutes });
        setState(previous => ({ ...previous, sessions: { ...previous.sessions, [which]: sessionId } }));
      } catch {
        // الخطأ يُعرض تحت الأزرار؛ الجلسة لا تبدأ نصفَ مسجَّلة.
        return;
      }
    }

    // من لحظة وصول الردّ لا من لحظة الضغط: زمن الشبكة لا يُقتطع من الجلسة.
    const at = Date.now();
    setNow(at);
    setRun(which, which === "stopwatch" ? startStopwatch(from, at) : startCountdown(from, at));
  }

  function pause(which: RunMode) {
    const at = Date.now();
    credit(which, at);
    setRun(which, which === "stopwatch" ? pauseStopwatch(runs[which], at) : pauseCountdown(runs[which], at));
  }

  function reset(which: RunMode) {
    credit(which, Date.now());
    closeSession(which, false);
    if (which === "stopwatch") {
      checkpoint.current = 0;
      setChecking(false);
    }
    setRun(which, idleRun(which === "pomodoro" ? phaseSeconds(phase, settings) : 0));
  }

  /** ينقل البومودورو إلى طوره التالي، ويبدأ الاستراحة وحدها إن طُلب ذلك. */
  function advance(countRound: boolean) {
    const at = Date.now();
    if (phase === "work") {
      const done = countRound ? rounds + 1 : rounds;
      const next = breakAfter(done, settings.every);
      const run = idleRun(phaseSeconds(next, settings));
      setRun("pomodoro", countRound && settings.autoBreaks ? startCountdown(run, at) : run, {
        phase: next,
        rounds: done,
      });
    } else {
      setRun("pomodoro", idleRun(phaseSeconds("work", settings)), { phase: "work" });
    }
  }

  function finish(which: "timer" | "pomodoro") {
    credit(which, Date.now());
    if (sound) chime();
    if (which === "timer") {
      closeSession("timer", true);
      setRun("timer", idleRun(0));
      return;
    }
    if (phase === "work") closeSession("pomodoro", true);
    advance(true);
  }

  /*
   * «تخطّي» ينهي الطور ولا يعدّه: من تخطّى لم يُتمّ، وعدّه إنجازاً يُفسد كل
   * رقم في الإحصاء بعد ذلك.
   */
  function skip() {
    credit("pomodoro", Date.now());
    if (phase === "work") closeSession("pomodoro", false);
    advance(false);
  }

  useEffect(() => {
    (["timer", "pomodoro"] as const).forEach(which => {
      const run = runs[which];
      if (run.status === "running" && countdownLeft(run, now) === 0) finish(which);
    });
  }, [now, runs]);

  /*
   * فحص الحضور: كلّما أتمّت ساعة الإيقاف ساعتين وقفت وسألت. ساعةٌ تُركت
   * تعمل ليلةً كاملة ليست ليلةَ تركيز، ورقمها يُفسد مجموع اليوم.
   */
  const elapsed = stopwatchElapsed(runs.stopwatch, now);
  const checkpoint = useRef(Math.floor(elapsed / CHECK_EVERY_SECONDS));
  useEffect(() => {
    const reached = Math.floor(elapsed / CHECK_EVERY_SECONDS);
    if (reached <= checkpoint.current) return;
    checkpoint.current = reached;
    if (runs.stopwatch.status !== "running") return;
    pause("stopwatch");
    setChecking(true);
    if (sound) chime();
  }, [elapsed]);

  function startTimer(total: number) {
    if (total <= 0) return;
    void start("timer", idleRun(total));
  }

  function applySettings(next: PomodoroSettings) {
    writePomodoro(next);
    setSettings(next);
    // طور لم يبدأ بعد يأخذ مدّته الجديدة؛ الجاري يُكمل على ما بدأ عليه.
    if (runs.pomodoro.status === "idle") setRun("pomodoro", idleRun(phaseSeconds(phase, next)));
    setPanel(null);
  }

  function toggleSound() {
    writeSound(!sound);
    setSound(!sound);
  }

  function toggle(which: Exclude<Panel, null>) {
    setPanel(panel === which ? null : which);
  }

  // Escape يغلق ما انفتح، والضغط خارج القائمة المنسدلة يغلقها — لا تبقى معلّقة فوق الأزرار.
  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    const onDown = (event: MouseEvent) => {
      if (panel === "settings" || panel === "music") return;
      if (!(event.target as Element).closest?.(".ft-anchor, .ft-corner")) setPanel(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [panel]);

  function playStream() {
    const url = embedUrl(streamDraft);
    if (!url) return;
    try {
      localStorage.setItem(STREAM_KEY, streamDraft.trim());
    } catch {
      /* لا حفظ: الرابط يُلصق من جديد في المرّة القادمة. */
    }
    setStream(url);
    setPanel(null);
  }

  /* ---- وضع التركيز: ملء الشاشة وإسقاط التنقّل ---- */

  function toggleQuiet() {
    if (quiet) {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
      setQuiet(false);
      return;
    }
    setQuiet(true);
    // ملء الشاشة قد يُرفض؛ الوضع الهادئ يعمل بدونه.
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /* ---- المصغَّر: الرقم وحده في نافذة تطفو فوق عملك ---- */

  async function toggleMini() {
    if (mini) {
      mini.close();
      return;
    }
    try {
      const opened = await pictureInPicture()!.requestWindow({ width: 320, height: 170 });
      opened.document.body.style.cssText =
        "margin:0;height:100vh;display:grid;place-items:center;background:#000;color:#fff;" +
        "font:500 64px 'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif;" +
        "font-variant-numeric:tabular-nums;letter-spacing:-.035em";
      opened.addEventListener("pagehide", () => setMini(null));
      setMini(opened);
    } catch {
      /* رُفضت النافذة أو أُغلقت قبل أن تُفتح: المؤقّت في مكانه. */
    }
  }

  useEffect(() => () => mini?.close(), [mini]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setQuiet(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* ---- ما يُعرض ---- */

  const run = mode === "clock" ? null : runs[mode];
  const left = mode === "timer" || mode === "pomodoro" ? countdownLeft(runs[mode], now) : 0;

  // الجاري الآن يُحسب مع مجموع اليوم قبل أن يُحفظ، فلا يقفز الرقم عند الإيقاف.
  const live = (["timer", "pomodoro", "stopwatch"] as const).reduce((sum, which) => {
    const current = runs[which];
    if (current.status !== "running" || !isWork(which)) return sum;
    return sum + (which === "stopwatch"
      ? stopwatchElapsed(current, now) - current.value
      : current.value - countdownLeft(current, now));
  }, 0);
  const todayTotal = today + Math.max(0, live);
  const sinceCheck = elapsed % CHECK_EVERY_SECONDS;

  const clockDate = new Date(now);
  const clockHour = hours24 ? clockDate.getHours() : clockDate.getHours() % 12 || 12;

  const groups =
    mode === "clock"
      ? [String(clockHour).padStart(2, "0"), String(clockDate.getMinutes()).padStart(2, "0")]
      : mode === "stopwatch"
        ? timeGroups(elapsed, { hours: true, seconds: showSeconds })
        : timeGroups(left);

  // ما يعمل الآن — يُعرض في الشريط العلوي وفي عنوان التبويب، ولو كنت في تبويب غيره.
  const liveMode =
    run?.status === "running"
      ? (mode as RunMode)
      : (["pomodoro", "timer", "stopwatch"] as const).find(which => runs[which].status === "running");
  const liveTime = !liveMode
    ? null
    : (liveMode === "stopwatch"
        ? timeGroups(elapsed, { hours: elapsed >= 3600 })
        : timeGroups(countdownLeft(runs[liveMode], now))
      ).join(":");
  useEffect(() => {
    if (!liveTime) return;
    const original = document.title;
    document.title = `⏱️ ${liveTime} · واف`;
    return () => {
      document.title = original;
    };
  }, [liveTime]);

  const settingUp = mode === "timer" && runs.timer.status === "idle";
  const fieldTotal =
    (Number(fields.h) || 0) * 3600 + (Number(fields.m) || 0) * 60 + (Number(fields.s) || 0);
  const quote = QUOTES[clockDate.getDate() % QUOTES.length];
  const streamValid = embedUrl(streamDraft) !== null;

  return (
    <div className="tp-frame ft-frame" data-waf-theme="navy" dir={dir()} lang={getLang()}>
      {!quiet && <FocusBar liveTime={liveTime} />}

      <main className={quiet ? "ft is-quiet" : "ft"}>
        {/* كل صفحة تحتاج عنواناً واحداً: قارئ الشاشة يبدأ منه، والصفحة بلا h1 تبدأ من لا شيء. */}
        <h1 className="sr-only">{t("التركيز", "Focus")}</h1>

        <div className="ft-modes">
          <div className="ft-tabs" role="tablist" aria-label={t("نوع المؤقّت", "Timer type")}>
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={mode === id ? "ft-tab is-current" : "ft-tab"}
                onClick={() => {
                  setPanel(null);
                  setState(previous => ({ ...previous, mode: id }));
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {pick(label)}
                {id !== "clock" && id !== mode && runs[id].status === "running" && (
                  <span className="ft-tab-live" aria-label={t("يعمل", "running")} />
                )}
              </button>
            ))}
          </div>
          <button type="button" className="ft-tab ft-tab-solo" onClick={toggleQuiet} aria-pressed={quiet}>
            {quiet ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
            {quiet ? t("خروج", "Exit") : t("تركيز", "Focus")}
          </button>
          {pictureInPicture() && (
            <button type="button" className="ft-tab ft-tab-solo" onClick={() => void toggleMini()} aria-pressed={mini !== null}>
              <PictureInPicture2 size={16} aria-hidden="true" />
              {t("مصغّر", "Mini")}
            </button>
          )}
        </div>

        <section className="ft-stage" data-mode={mode}>
          {mode === "pomodoro" && (
            <div className="ft-phase">
              <span className="ft-pill" data-phase={phase}>
                <Timer size={16} aria-hidden="true" />
                {pick(PHASE_LABELS[phase])}
              </span>
              <span className="ft-muted">{t("الجلسة", "Session")} {rounds + 1}</span>
              <button
                type="button"
                className="ft-icon ft-icon-sm"
                aria-label={t("إعدادات بومودورو", "Pomodoro settings")}
                aria-expanded={panel === "settings"}
                onClick={() => toggle("settings")}
              >
                <Settings size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {mode === "stopwatch" && (
            <div className="ft-corner">
              <button
                type="button"
                className="ft-icon ft-icon-sm"
                aria-label={t("إعدادات ساعة الإيقاف", "Stopwatch settings")}
                aria-expanded={panel === "seconds"}
                onClick={() => toggle("seconds")}
              >
                <Settings size={16} aria-hidden="true" />
              </button>
              {panel === "seconds" && (
                <div className="ft-pop">
                  <label className="ft-toggle">
                    <span>
                      {t("إظهار الثواني", "Show seconds")}
                      <small>{t("إخفاء عدّ الثواني", "Hide the ticking seconds")}</small>
                    </span>
                    <input type="checkbox" checked={showSeconds} onChange={event => setShowSeconds(event.target.checked)} />
                  </label>
                </div>
              )}
            </div>
          )}

          {mode === "pomodoro" && panel === "settings" ? (
            <PomodoroPanel settings={settings} onApply={applySettings} />
          ) : settingUp ? (
            <div className="ft-setup">
              <p className="ft-eyebrow">
                <Clock size={14} aria-hidden="true" />
                {t("حدّد المدة", "SET DURATION")}
              </p>
              <div className="ft-fields" dir="ltr">
                {(
                  [
                    ["h", t("ساعات", "HOURS"), 23],
                    ["m", t("دقائق", "MINUTES"), 59],
                    ["s", t("ثوانٍ", "SECONDS"), 59],
                  ] as const
                ).map(([key, label, max], index) => (
                  <React.Fragment key={key}>
                    {index > 0 && <Colon />}
                    <label className="ft-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={max}
                        placeholder="0"
                        value={fields[key]}
                        onChange={event => {
                          const value = event.target.value;
                          if (value === "" || (/^\d{1,2}$/.test(value) && Number(value) <= max)) {
                            setFields({ ...fields, [key]: value });
                          }
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  </React.Fragment>
                ))}
              </div>
              <div className="ft-presets">
                {PRESETS.map(preset => (
                  <button
                    key={preset.seconds}
                    type="button"
                    className={fieldTotal === preset.seconds ? "ft-chip is-current" : "ft-chip"}
                    onClick={() =>
                      setFields({
                        h: preset.seconds >= 3600 ? String(Math.floor(preset.seconds / 3600)) : "",
                        m: preset.seconds % 3600 ? String((preset.seconds % 3600) / 60) : "",
                        s: "",
                      })
                    }
                  >
                    {pick(preset.label)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* لا يُعلَن كل ثانية: قارئ الشاشة لا يقاطع التركيز ستّين مرة في الدقيقة. */}
              <p className="ft-digits" role="timer" aria-live="off" dir="ltr">
                {groups.map((group, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Colon />}
                    <span>{group}</span>
                  </React.Fragment>
                ))}
              </p>

              {mode === "clock" && (
                <>
                  {!hours24 && <p className="ft-ampm">{clockDate.getHours() < 12 ? t("ص", "AM") : t("م", "PM")}</p>}
                  <div className="ft-phase">
                    <span className="ft-pill">
                      {clockDate.toLocaleDateString(getLang() === "ar" ? locale() : "en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </span>
                    <div className="ft-switch" role="group" aria-label={t("صيغة الوقت", "Time format")}>
                      <button type="button" aria-pressed={!hours24} onClick={() => setHours24(false)}>{t("12 س", "12h")}</button>
                      <button type="button" aria-pressed={hours24} onClick={() => setHours24(true)}>{t("24 س", "24h")}</button>
                    </div>
                  </div>
                </>
              )}

              {mode === "stopwatch" && (
                <div className="ft-goal">
                  <div className="ft-goal-labels">
                    <span>{hoursMinutes(elapsed, true, getLang())} {t("منقضية", "elapsed")}</span>
                    <span>{hoursMinutes(Math.max(0, DAILY_GOAL_SECONDS - elapsed), false, getLang())} {t("متبقّية", "remaining")}</span>
                  </div>
                  <div
                    className="ft-bar"
                    role="progressbar"
                    aria-label={t("تقدّم الجلسة نحو هدف اليوم", "Session progress toward the daily goal")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.round((elapsed / DAILY_GOAL_SECONDS) * 100))}
                  >
                    <span style={{ inlineSize: `${Math.min(100, (elapsed / DAILY_GOAL_SECONDS) * 100)}%` }} />
                  </div>
                  <div
                    className="ft-bar"
                    data-tone="go"
                    role="progressbar"
                    aria-label={t("الوقت حتى التحقّق التالي", "Time until the next check-in")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round((sinceCheck / CHECK_EVERY_SECONDS) * 100)}
                  >
                    <span style={{ inlineSize: `${(sinceCheck / CHECK_EVERY_SECONDS) * 100}%` }} />
                  </div>
                  <p className="ft-goal-note">
                    {Math.ceil((CHECK_EVERY_SECONDS - sinceCheck) / 60)}
                    {t(" د حتى التحقّق", "m to check")}
                  </p>
                </div>
              )}
            </>
          )}

          {run && !(mode === "pomodoro" && panel === "settings") && (
            <div className="ft-actions">
              {settingUp ? (
                <button
                  type="button"
                  className="ft-btn ft-btn-primary ft-btn-wide"
                  disabled={fieldTotal <= 0 || startSession.isPending}
                  onClick={() => startTimer(fieldTotal)}
                >
                  <Play size={18} aria-hidden="true" />
                  {t("ابدأ المؤقّت", "Start Timer")}
                </button>
              ) : run.status === "running" ? (
                <button type="button" className="ft-btn ft-btn-primary" onClick={() => pause(mode as RunMode)}>
                  <Pause size={16} aria-hidden="true" />
                  {t("إيقاف مؤقّت", "Pause")}
                </button>
              ) : (
                <button
                  type="button"
                  className="ft-btn ft-btn-primary"
                  disabled={startSession.isPending}
                  onClick={() => {
                    setChecking(false);
                    void start(mode as RunMode);
                  }}
                >
                  <Play size={16} aria-hidden="true" />
                  {run.status === "paused" ? t("متابعة", "Resume") : t("ابدأ", "Start")}
                </button>
              )}
              {!settingUp && (mode === "pomodoro" || run.status !== "idle") && (
                <button type="button" className="ft-btn" onClick={() => reset(mode as RunMode)}>
                  <RotateCcw size={16} aria-hidden="true" />
                  {t("إعادة ضبط", "Reset")}
                </button>
              )}
              {mode === "pomodoro" && (
                <button type="button" className="ft-btn" onClick={skip}>
                  {t("تخطّي", "Skip")}
                </button>
              )}
            </div>
          )}

          {mode === "stopwatch" && checking && (
            <p className="ft-check" role="alert">
              {t(
                "ما زلت تدرس؟ توقّفت ساعة الإيقاف للتحقّق — اضغط «متابعة» لتكمل.",
                "Still studying? The stopwatch paused for a check-in — press Resume to carry on.",
              )}
            </p>
          )}

          {run?.status === "running" && mode !== "pomodoro" && (
            <p className="ft-live" role="status">
              <span aria-hidden="true" />
              {t("تدرس الآن...", "Studying...")}
            </p>
          )}

          {/*
            الشارة تحت الأزرار: المهمة التي يُسجَّل الوقت باسمها، أو لا شيء. وتظهر
            في كل وضعٍ يُسجَّل فيه وقت لا في البومودورو وحده: من جاء من «ابدأ
            التركيز» والمؤقّت مفتوح كان وقته يُكتب على مهمةٍ لا يراها.
          */}
          {mode !== "clock" && panel !== "settings" && (
            <div className="ft-anchor ft-label">
              <button
                type="button"
                className="ft-chip ft-chip-lg"
                aria-expanded={panel === "label"}
                onClick={() => toggle("label")}
              >
                <Tag size={16} aria-hidden="true" />
                {task ? task.title : t("اختر مهمة", "Select Label")}
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {panel === "label" && (
                <div className="ft-pop ft-pop-list" role="listbox" aria-label={t("المهمة", "Label")}>
                  {tasks.length === 0 && <p className="ft-muted">{t("لا مهام مفتوحة بعد. أضف مهمة من صفحة المهام.", "No open tasks yet. Add one from Tasks.")}</p>}
                  {tasks.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === state.taskId}
                      // جلسة مسجَّلة باسم مهمة لا تُنقل إلى غيرها في منتصفها.
                      disabled={sessionOpen}
                      dir="auto"
                      onClick={() => {
                        setState(previous => ({
                          ...previous,
                          taskId: previous.taskId === item.id ? null : item.id,
                        }));
                        setPanel(null);
                      }}
                    >
                      {item.title}
                      {item.id === state.taskId && <Check size={14} aria-hidden="true" />}
                    </button>
                  ))}
                  {sessionOpen && (
                    <p className="ft-muted">
                      {t("أنهِ الجلسة الجارية لتغيّر المهمة.", "Finish the running session to change the label.")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "pomodoro" && panel !== "settings" && (
            <p className="ft-muted ft-summary">
              {t("مجموع وقت العمل اليوم:", "Total work time today:")} {spokenDuration(todayTotal, getLang())}
              <br />
              {t("التالي:", "Next:")} {phase === "work" ? t("استراحة", "Break") : t("تركيز", "Focus")}
            </p>
          )}

          {startSession.error && (
            <p className="tm-form-error" role="alert" dir="auto">
              {startSession.error.message}
            </p>
          )}

          <div className="ft-tools">
            <button type="button" className="ft-chip ft-chip-lg" aria-expanded={todoOpen} onClick={() => setTodoOpen(!todoOpen)}>
              <ListTodo size={16} aria-hidden="true" />
              {t("المهام", "Tasks")}
            </button>
            <button
              type="button"
              className="ft-icon"
              onClick={toggleSound}
              aria-pressed={sound}
              aria-label={sound ? t("الصوت مفعّل", "Sound enabled") : t("الصوت مكتوم", "Sound muted")}
              title={sound ? t("الصوت مفعّل", "Sound enabled") : t("الصوت مكتوم", "Sound muted")}
            >
              {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            </button>
            <div className="ft-anchor">
              <button
                type="button"
                className={ambience.length > 0 ? "ft-icon is-on" : "ft-icon"}
                aria-label={t("أصوات الاسترخاء", "Relaxation sounds")}
                title={t("أصوات الاسترخاء", "Relaxation sounds")}
                aria-expanded={panel === "sounds"}
                onClick={() => toggle("sounds")}
              >
                <Music size={16} aria-hidden="true" />
              </button>
              {panel === "sounds" && (
                <div className="ft-pop ft-sounds">
                  <div className="ft-sound-grid">
                    {AMBIENCE.map(({ id, label, labelAr }) => {
                      const Icon = AMBIENCE_ICONS[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          className={ambience.includes(id) ? "ft-sound is-on" : "ft-sound"}
                          aria-pressed={ambience.includes(id)}
                          onClick={() => {
                            toggleAmbience(id);
                            setAmbienceVolume(volume / 100);
                            setAmbience(playingAmbience());
                          }}
                        >
                          <Icon size={20} aria-hidden="true" />
                          {t(labelAr, label)}
                        </button>
                      );
                    })}
                  </div>
                  <label className="ft-volume">
                    <Volume2 size={12} aria-hidden="true" />
                    <span>{t("مستوى الصوت", "VOLUME")}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      aria-label={t("مستوى الصوت", "Volume")}
                      onChange={event => {
                        const next = Number(event.target.value);
                        setVolume(next);
                        setAmbienceVolume(next / 100);
                      }}
                    />
                    <Volume1 size={12} aria-hidden="true" />
                  </label>
                </div>
              )}
            </div>
            <button
              type="button"
              className={stream ? "ft-icon is-on" : "ft-icon"}
              aria-label={t("بثّ الموسيقى", "Stream music")}
              title={t("بثّ الموسيقى", "Stream music")}
              aria-expanded={panel === "music"}
              onClick={() => toggle("music")}
            >
              <Radio size={16} aria-hidden="true" />
            </button>
          </div>

          {(mode === "clock" || settingUp) && (
            <p className="ft-quote">
              {t("«", "“")}
              {pick(quote[0])}
              {t("»", "”")}
              <br />— {pick(quote[1])}
            </p>
          )}
        </section>

        {/* انتهى الوقت — ولا يعرف إن أُنجزت إلا صاحبها. */}
        {asked && (
          <section className="ft-panel ft-ask" role="status">
            <h2>
              {t("انتهت الجلسة.", "Session finished.")}
              <small dir="auto">
                {t("هل أنجزت «", "Did you finish “")}
                {asked.title}
                {t("»؟", "”?")}
              </small>
            </h2>
            <div className="ft-actions">
              <button
                type="button"
                className="ft-btn ft-btn-primary"
                disabled={complete.isPending}
                onClick={() => {
                  complete.mutate({ id: asked.id });
                  setAskingId(null);
                  setState(previous => ({ ...previous, taskId: null }));
                }}
              >
                <Check size={16} aria-hidden="true" />
                {t("نعم، أُنجزت", "Yes, it's done")}
              </button>
              <button type="button" className="ft-btn" onClick={() => setAskingId(null)}>
                {t("أحتاج وقتاً أكثر", "I need more time")}
              </button>
            </div>
          </section>
        )}
      </main>

      {/* ---- درج المهام: قائمة واف المفتوحة، تُضاف إليها وتُنجَز منها ---- */}
      {todoOpen && !quiet && (
        <aside className="ft-drawer" aria-label={t("قائمة المهام", "Todo list")}>
          <button
            type="button"
            className="ft-drawer-fold"
            aria-label={t("إغلاق قائمة المهام", "Close todo list")}
            onClick={() => setTodoOpen(false)}
          >
            {/* السهم يشير إلى الحافّة التي ينطوي إليها الدرج: يمينٌ في الإنجليزية ويسارٌ في العربية. */}
            {dir() === "rtl" ? <ArrowLeft size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
          </button>
          <header className="ft-drawer-head">
            <h2>{t("قائمة المهام", "Todo List")}</h2>
            <button type="button" className="ft-icon ft-icon-sm" aria-label={t("إغلاق", "Close")} onClick={() => setTodoOpen(false)}>
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <div className="ft-drawer-progress">
            <div className="ft-bar" data-tone="go">
              <span style={{ inlineSize: `${doneCount + tasks.length ? (doneCount / (doneCount + tasks.length)) * 100 : 0}%` }} />
            </div>
            <span>
              {doneCount} {t("من", "of")} {doneCount + tasks.length}
            </span>
          </div>
          <form
            className="ft-drawer-add"
            onSubmit={event => {
              event.preventDefault();
              const title = newTask.trim();
              if (title && !create.isPending) create.mutate({ title, origin: ORIGIN });
            }}
          >
            <Plus size={16} aria-hidden="true" />
            <input
              type="text"
              dir="auto"
              value={newTask}
              maxLength={200}
              placeholder={t("أضف مهمة", "Add a task")}
              aria-label={t("أضف مهمة", "Add a task")}
              onChange={event => setNewTask(event.target.value)}
            />
          </form>
          {create.error && (
            <p className="tm-form-error" role="alert" dir="auto">
              {create.error.message}
            </p>
          )}
          {status.data?.configured === false && (
            <p className="ft-muted ft-drawer-note">
              {t("المهام غير مربوطة في هذه النسخة بعد.", "Tasks are not connected on this deployment yet.")}
            </p>
          )}

          {tasks.length === 0 ? (
            <div className="ft-drawer-empty">
              <span className="ft-icon" aria-hidden="true">
                <Target size={18} />
              </span>
              <strong>{t("القائمة فارغة", "Nothing on the list")}</strong>
              <p>{t("أضف مهمة في الأعلى لتبدأ.", "Add a task above to get started.")}</p>
            </div>
          ) : (
            <ul className="ft-drawer-list">
              {tasks.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="ft-todo-check"
                    aria-label={t(`إنجاز ${item.title}`, `Complete ${item.title}`)}
                    disabled={complete.isPending}
                    onClick={() => {
                      // مهمة جلستها مفتوحة تُغلق جلستها أولاً، فلا تبقى جلسةٌ بلا مهمة.
                      if (item.id === state.taskId) {
                        (["timer", "pomodoro", "stopwatch"] as const).forEach(which => {
                          const sessionId = sessions[which];
                          if (sessionId) endSession.mutate({ sessionId, completed: false });
                        });
                        setState(previous => ({
                          ...previous,
                          taskId: null,
                          sessions: { timer: null, pomodoro: null, stopwatch: null },
                        }));
                      }
                      complete.mutate({ id: item.id });
                    }}
                  />
                  <span dir="auto">{item.title}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      {/* ---- بثّ الموسيقى ---- */}
      {panel === "music" && (
        <div className="ft-scrim" onClick={() => setPanel(null)}>
          <form
            className="ft-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ft-stream-title"
            onClick={event => event.stopPropagation()}
            onSubmit={event => {
              event.preventDefault();
              playStream();
            }}
          >
            <span className="ft-dialog-mark" aria-hidden="true">
              <Radio size={20} />
            </span>
            <h2 id="ft-stream-title">{t("بثّ الموسيقى", "Stream Music")}</h2>
            <p>{t("الصق رابط Spotify أو YouTube ليعمل أثناء الدراسة", "Paste a Spotify or YouTube link to play while studying")}</p>
            <input
              type="url"
              dir="ltr"
              autoFocus
              value={streamDraft}
              placeholder={t(
                "https://open.spotify.com/playlist/... أو youtube.com/watch?",
                "https://open.spotify.com/playlist/... or youtube.com/watch?",
              )}
              aria-label={t("رابط Spotify أو YouTube", "Spotify or YouTube link")}
              onChange={event => setStreamDraft(event.target.value)}
            />
            <ul>
              <li data-tone="spotify">{t("أغانٍ، ألبومات، قوائم تشغيل، بودكاست", "Songs, albums, playlists, podcasts")}</li>
              <li data-tone="youtube">
                {t("مقاطع، قوائم تشغيل، بثّ مباشر، YouTube Music", "Videos, playlists, livestreams, YouTube Music")}
              </li>
            </ul>
            <div className="ft-dialog-actions">
              <button type="button" className="ft-btn" onClick={() => setPanel(null)}>
                {t("إلغاء", "Cancel")}
              </button>
              <button type="submit" className="ft-btn ft-btn-primary" disabled={!streamValid}>
                {t("تشغيل", "Play")}
              </button>
            </div>
          </form>
        </div>
      )}

      {stream && (
        <div className="ft-player">
          <button type="button" className="ft-icon ft-icon-sm" aria-label={t("إيقاف الموسيقى", "Stop music")} onClick={() => setStream(null)}>
            <X size={14} aria-hidden="true" />
          </button>
          <iframe
            src={stream}
            title={t("مشغّل الموسيقى", "Music player")}
            loading="lazy"
            allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}

      {!quiet && (
        <>
          <p className="ft-status" data-ok={online}>
            <span aria-hidden="true" />
            {online ? t("كل شيء يعمل", "All operations normal") : t("أنت غير متصل", "You are offline")}
          </p>
          <p className="ft-now">
            <span aria-hidden="true" />
            {studyingNow} {t("يدرسون الآن", "studying now")}
          </p>
        </>
      )}

      {mini && createPortal(<span>{groups.join(":")}</span>, mini.document.body)}
    </div>
  );
}

/** النقطتان دائرتان مرسومتان لا حرفاً: تبقيان في منتصف الرقم مهما كبر. */
function Colon() {
  return (
    <span className="ft-colon" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

function PomodoroPanel({
  settings,
  onApply,
}: {
  settings: PomodoroSettings;
  onApply: (next: PomodoroSettings) => void;
}) {
  const [draft, setDraft] = useState({
    work: String(settings.work),
    short: String(settings.short),
    long: String(settings.long),
    every: String(settings.every),
  });
  const [autoBreaks, setAutoBreaks] = useState(settings.autoBreaks);

  const FIELDS = [
    ["work", t("مدة العمل (دقيقة)", "Work Duration (min)"), 240],
    ["short", t("استراحة قصيرة (دقيقة)", "Short Break (min)"), 120],
    ["long", t("استراحة طويلة (دقيقة)", "Long Break (min)"), 120],
    ["every", t("استراحة طويلة بعد كل (جلسات)", "Long Break Every"), 12],
  ] as const;

  return (
    <form
      className="ft-panel ft-settings"
      onSubmit={event => {
        event.preventDefault();
        const next = { ...settings, autoBreaks };
        // خانة فارغة أو خارج الحدّ تبقى على قيمتها السابقة لا على الافتراض.
        for (const [key, , max] of FIELDS) {
          const value = Number(draft[key]);
          if (draft[key] !== "" && Number.isInteger(value) && value >= 1 && value <= max) next[key] = value;
        }
        onApply(next);
      }}
    >
      <h2>
        {t("إعدادات بومودورو", "Pomodoro Settings")}
        <small>{t("اضبط مدد المؤقّت أدناه", "Adjust your timer durations below")}</small>
      </h2>
      <div className="ft-settings-grid">
        {FIELDS.map(([key, label, max]) => (
          <label key={key} className="ft-setting">
            <span>{label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              value={draft[key]}
              onChange={event => setDraft({ ...draft, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="ft-toggle">
        <span>
          {t("بدء الاستراحات تلقائياً", "Auto-start Breaks")}
          <small>
            {t(
              "يبدأ مؤقّت الاستراحة تلقائياً بعد انتهاء جلسة العمل",
              "Automatically start break timer after work session completes",
            )}
          </small>
        </span>
        <input type="checkbox" checked={autoBreaks} onChange={event => setAutoBreaks(event.target.checked)} />
      </label>
      <button type="submit" className="ft-btn ft-btn-accent">
        <Check size={16} aria-hidden="true" />
        {t("تطبيق الإعدادات وإغلاق", "Apply Settings & Close")}
      </button>
    </form>
  );
}
