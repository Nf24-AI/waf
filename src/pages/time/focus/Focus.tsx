// جلسة التركيز: مسرح بملء الشاشة. الأرقام كبيرة بخط ريم كوفي، والأفق تحتها يمتلئ
// بالزعفران حتى «الآن». أربعة أوضاع، والمؤقّتات الثلاثة تعمل معاً كلٌّ وحده.
// تعمل مستقلّة (/time/focus) أو خطوةً ثالثة في «نظام واف» (/waf/focus).

import "./focus.css";
import { ArrowRight, Bell, BellOff, ListTodo, Maximize2, Minimize2, PictureInPicture2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Link } from "wouter";
import { useFocusToday, useTaskActions, useTasks } from "@/data/hooks";
import type { Task, TaskOrigin } from "@/data/types";
import { t, useLang } from "@/lib/i18n";
import { formatDuration } from "@/lib/time";
import { Button } from "@/ui/Button";
import { LangToggle, ThemeToggle, Wordmark } from "@/ui/Chrome";
import { cx } from "@/ui/cx";
import { FlowSteps } from "../FlowSteps";
import { elapsed, formatDigits, hasOpenSession, isRunning, openWorkMs, remaining, type FocusState, type TimedMode, type View } from "./engine";
import { ambient } from "./audio";
import { pipSupported, useMiniWindow } from "./MiniWindow";
import { PomodoroDialog } from "./PomodoroDialog";
import { AmbientMenu, MusicDock, MusicMenu, ToolButton } from "./Sounds";
import { ClockStage, PHASE_NAME, PomodoroStage, StopwatchStage, TimerStage } from "./Stage";
import { TaskPicker } from "./TaskPicker";
import { TasksDrawer } from "./TasksDrawer";
import { readJson, useNowMs, writeJson } from "./ticker";
import { useFocus, type FocusApi } from "./useFocus";
import type { Embed } from "./embed";

const TABS: { id: View; ar: string; en: string }[] = [
  { id: "timer", ar: "مؤقّت", en: "Timer" },
  { id: "pomodoro", ar: "بومودورو", en: "Pomodoro" },
  { id: "stopwatch", ar: "ساعة إيقاف", en: "Stopwatch" },
  { id: "clock", ar: "ساعة", en: "Clock" },
];
const CLOCK24_KEY = "waf:focus-clock24";

/** المؤقّت الذي يُعرض في الشريط والعنوان: المعروض إن كان يعمل، وإلا أوّل مؤقّت يعمل */
function liveMode(s: FocusState): TimedMode | null {
  if (s.view !== "clock" && isRunning(s[s.view].run)) return s.view;
  return (["pomodoro", "timer", "stopwatch"] as const).find((m) => isRunning(s[m].run)) ?? null;
}

function liveDigits(s: FocusState, mode: TimedMode, now: number) {
  const run = s[mode].run;
  return mode === "stopwatch" ? formatDigits(elapsed(run, now), false) : formatDigits(remaining(run, now), true);
}

/** عنوان التبويب «mm:ss · واف» ما دام مؤقّت يعمل */
function TitleSync({ state }: { state: FocusState }) {
  const now = useNowMs();
  const original = useRef(document.title);
  const mode = liveMode(state);
  const lang = useLang();
  useEffect(() => {
    document.title = mode ? `${liveDigits(state, mode, now)} · ${t("واف", "Waf")}` : t("التركيز · واف", "Focus · Waf");
  }, [mode, state, now, lang]);
  useEffect(() => {
    const first = original.current;
    return () => {
      document.title = first;
    };
  }, []);
  return null;
}

function LiveChip({ state, onShow }: { state: FocusState; onShow: (m: TimedMode) => void }) {
  const now = useNowMs();
  const mode = liveMode(state);
  if (!mode) return null;
  const name = mode === "pomodoro" ? t(...PHASE_NAME[state.pomodoro.phase]) : mode === "timer" ? t("المؤقّت", "Timer") : t("ساعة الإيقاف", "Stopwatch");
  return (
    <button
      type="button"
      onClick={() => onShow(mode)}
      className="press inline-flex h-9 items-center gap-2 rounded-full bg-saffron-wash px-3 text-saffron-ink"
      aria-label={t(`${name} يعمل. اعرضه`, `${name} is running. Show it`)}
    >
      <span className="focus-tab-dot" aria-hidden />
      <span dir="ltr" className="tnum font-display text-sm font-semibold">
        {liveDigits(state, mode, now)}
      </span>
    </button>
  );
}

function TodayTotal({ origin, f }: { origin: TaskOrigin; f: FocusApi }) {
  const now = useNowMs();
  const lang = useLang();
  const q = useFocusToday(origin);
  if (q.isPending) return null;
  const seconds = (q.data ?? 0) + f.credit + Math.floor(openWorkMs(f.state, now) / 1000);
  const minutes = Math.floor(seconds / 60);
  return <span className="tnum">{minutes < 1 ? t("لم تسجّل وقت تركيز اليوم بعد", "No focus time recorded today yet") : t(`ركّزت اليوم ${formatDuration(minutes, lang)}`, `Focused today: ${formatDuration(minutes, lang)}`)}</span>;
}

function Tabs({ state, onChange }: { state: FocusState; onChange: (v: View) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let j = -1;
    if (e.key === fwd) j = (i + 1) % TABS.length;
    else if (e.key === back) j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    onChange(TABS[j].id);
    refs.current[j]?.focus();
  };
  return (
    <div role="tablist" aria-label={t("أوضاع التركيز", "Focus modes")} className="grid w-full max-w-md grid-cols-4 rounded-sm border border-line bg-sunk p-0.5">
      {TABS.map((tab, i) => {
        const on = state.view === tab.id;
        const live = tab.id !== "clock" && isRunning(state[tab.id].run);
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`focus-tab-${tab.id}`}
            aria-selected={on}
            aria-controls="focus-stage"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              "press relative inline-flex h-10 items-center justify-center gap-1.5 rounded-[4px] px-2 text-sm font-medium whitespace-nowrap transition-colors duration-150",
              on ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {t(tab.ar, tab.en)}
            {live && (
              <>
                <span className="focus-tab-dot max-sm:absolute max-sm:end-1.5 max-sm:top-1.5" aria-hidden />
                <span className="sr-only">{t("(يعمل)", "(running)")}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** ما يظهر في النافذة المصغّرة */
function Mini({ f }: { f: FocusApi }) {
  const now = useNowMs();
  const s = f.state;
  const mode: TimedMode = s.view === "clock" ? (liveMode(s) ?? "pomodoro") : s.view;
  const run = s[mode].run;
  const running = isRunning(run);
  const label = mode === "pomodoro" ? t(...PHASE_NAME[s.pomodoro.phase]) : mode === "timer" ? t("المؤقّت", "Timer") : t("ساعة الإيقاف", "Stopwatch");
  return (
    <div className="focus-page flex h-dvh flex-col items-center justify-center gap-1 px-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p dir="ltr" className="tnum font-display text-6xl leading-none font-semibold">
        {liveDigits(s, mode, now)}
      </p>
      <button
        type="button"
        onClick={() => (running ? f.pause(mode) : void f.start(mode))}
        className={cx("press mt-2 inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs font-medium", running ? "border border-line text-ink" : "bg-saffron text-on-saffron")}
      >
        {running ? <Pause className="size-4" strokeWidth={1.75} /> : <Play className="size-4" strokeWidth={1.75} />}
        {running ? t("إيقاف مؤقّت", "Pause") : t("متابعة", "Resume")}
      </button>
    </div>
  );
}

export default function Focus({ origin }: { origin: TaskOrigin }) {
  useLang();
  const f = useFocus(origin);
  const { state } = f;
  const tasksQ = useTasks(origin);
  const actions = useTaskActions(origin);
  const mini = useMiniWindow();
  const canPip = useMemo(pipSupported, []);

  const [drawer, setDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [music, setMusic] = useState<Embed | null>(null);
  const [hour24, setHour24State] = useState(() => readJson(CLOCK24_KEY) === true);
  const setHour24 = (v: boolean) => {
    setHour24State(v);
    writeJson(CLOCK24_KEY, v);
  };

  // أصوات الخلفية تتوقّف حين يغادر المستخدم الصفحة (لا حين يُخفى شريط الأدوات)
  useEffect(() => () => ambient.stop(), []);

  const all = tasksQ.data ?? [];
  const open = useMemo(() => all.filter((x) => !x.completedAt), [all]);
  const task = open.find((x) => x.id === state.taskId) ?? null;
  const locked = hasOpenSession(state);
  const sessionTaskIds = useMemo(() => new Set(Object.values(state.sessions).flatMap((s) => (s?.taskId ? [s.taskId] : []))), [state.sessions]);

  // ?task=<id>: يختار المهمة مرة واحدة حين تصل المهام
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !tasksQ.isSuccess) return;
    preselected.current = true;
    const id = new URLSearchParams(window.location.search).get("task");
    if (id && !hasOpenSession(state) && open.some((x) => x.id === id)) f.setTask(id);
  }, [tasksQ.isSuccess, open, state, f]);

  // مهمة مختارة أُنجزت أو حُذفت في مكان آخر: يُزال اختيارها
  useEffect(() => {
    if (!tasksQ.isSuccess || !state.taskId || sessionTaskIds.has(state.taskId)) return;
    if (!open.some((x) => x.id === state.taskId)) f.setTask(null);
  }, [tasksQ.isSuccess, open, state.taskId, sessionTaskIds, f]);

  // وضع «تركيز»: ملء الشاشة، ويخرج بـ Esc أو «خروج»
  const enterImmersive = () => {
    setImmersive(true);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
  };
  const exitImmersive = useCallback(() => {
    setImmersive(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const onFs = () => !document.fullscreenElement && setImmersive(false);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // المسافة تبدأ وتوقف المؤقّت المعروض، وEsc يخرج من وضع «تركيز»
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && immersive) {
        exitImmersive();
        return;
      }
      if (e.key !== " " || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button, a, [role=tab], [role=dialog], [contenteditable=true]")) return;
      const v = state.view;
      if (v === "clock") return;
      e.preventDefault();
      if (isRunning(state[v].run)) f.pause(v);
      else void f.start(v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersive, exitImmersive, state, f]);

  const complete = (x: Task) => {
    if (x.id === state.taskId || sessionTaskIds.has(x.id)) f.releaseTask(x.id);
    actions.complete.mutate(x.id, { onSuccess: () => toast.success(t("أُنجزت", "Done")) });
  };
  const remove = (x: Task) => {
    if (sessionTaskIds.has(x.id)) return;
    if (x.id === state.taskId) f.setTask(null);
    actions.archive.mutate(x.id, {
      onSuccess: () => toast(t("حُذفت المهمة", "Task deleted"), { action: { label: t("تراجع", "Undo"), onClick: () => actions.restore.mutate(x.id) } }),
    });
  };
  const focusOn = (x: Task) => {
    if (locked && x.id !== state.taskId) {
      toast(t("أنهِ الجلسة الجارية لتغيّر المهمة.", "End the current session to change the task."));
      return;
    }
    f.setTask(x.id);
    setDrawer(false);
  };

  const promptTask = f.prompt ? all.find((x) => x.id === f.prompt!.taskId) : null;
  const backHref = origin === "waf" ? "/today" : "/time";
  const backLabel = origin === "waf" ? t("اليوم", "Today") : t("الوقت", "Time");

  const picker = (
    <TaskPicker tasks={open} task={task} locked={locked} loading={tasksQ.isPending} onPick={(id) => f.setTask(id)} onManage={() => setDrawer(true)} />
  );
  const today = <TodayTotal origin={origin} f={f} />;

  return (
    <div className={cx("focus-page flex min-h-dvh flex-col", immersive && "is-immersive")}>
      <TitleSync state={state} />
      <p className="sr-only" role="status" aria-live="polite">
        {f.announce}
      </p>

      {!immersive && (
        <header className="no-print sticky top-0 z-40 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
            <Wordmark href={origin === "waf" ? "/today" : "/time"} className="me-2" />
            <LiveChip state={state} onShow={(m) => f.setView(m)} />
            <div className="ms-auto flex items-center gap-0.5">
              <LangToggle short className="h-11 px-3" />
              <ThemeToggle className="size-11" />
              <Link href={backHref} className="press ms-1 inline-flex h-11 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink">
                <ArrowRight className="size-4 ltr:-scale-x-100" strokeWidth={1.75} aria-hidden />
                <span className="max-[22rem]:sr-only">{backLabel}</span>
              </Link>
            </div>
          </div>
        </header>
      )}

      {immersive && (
        <div className="fixed end-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-40">
          <Button variant="ghost" size="md" className="h-11" icon={<Minimize2 className="size-4" strokeWidth={1.75} />} onClick={exitImmersive}>
            {t("خروج", "Exit")}
          </Button>
        </div>
      )}

      {origin === "waf" && !immersive && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
          <FlowSteps origin={origin} className="mb-0" />
        </div>
      )}

      <main id="main" className="flex w-full flex-1 flex-col items-center px-4 pb-6 sm:px-6">
        {!immersive && (
          <div className="mt-4 flex w-full justify-center sm:mt-6">
            <Tabs state={state} onChange={f.setView} />
          </div>
        )}

        <section id="focus-stage" role="tabpanel" aria-labelledby={`focus-tab-${state.view}`} className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center py-8 sm:py-10">
          <h1 className="sr-only">{t("جلسة التركيز", "Focus session")}</h1>
          {state.view === "pomodoro" && <PomodoroStage f={f} picker={picker} footer={today} onSettings={() => setSettingsOpen(true)} />}
          {state.view === "timer" && <TimerStage f={f} picker={picker} footer={today} />}
          {state.view === "stopwatch" && <StopwatchStage f={f} picker={picker} footer={today} />}
          {state.view === "clock" && <ClockStage hour24={hour24} onHour24={setHour24} />}

          {f.error && (
            <p role="alert" className="mt-4 max-w-md text-center text-sm text-ember">
              {f.error}
            </p>
          )}

          {f.prompt && promptTask && !promptTask.completedAt && (
            <div role="alert" className="focus-swap mt-6 w-full max-w-md rounded-md border border-line bg-sheet px-5 py-4 text-center">
              <p className="text-ink [overflow-wrap:anywhere]">{t(`انتهت الجلسة. هل أنجزت «${promptTask.title}»؟`, `Session over. Did you finish “${promptTask.title}”?`)}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button
                  variant="solid"
                  className="h-11"
                  onClick={() => {
                    complete(promptTask);
                    f.dismissPrompt();
                  }}
                >
                  {t("نعم، أُنجزت", "Yes, it’s done")}
                </Button>
                <Button variant="ghost" className="h-11" onClick={f.dismissPrompt}>
                  {t("أحتاج وقتاً أكثر", "I need more time")}
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      {!immersive && (
        <footer className="no-print sticky bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-center gap-1 px-2 sm:gap-2">
            <ToolButton icon={ListTodo} label={t("المهام", "Tasks")} onClick={() => setDrawer(true)} />
            <AmbientMenu />
            <MusicMenu playing={!!music} onPlay={setMusic} />
            <ToolButton icon={f.sound ? Bell : BellOff} label={f.sound ? t("الجرس مفعّل", "Chime on") : t("الجرس مكتوم", "Chime off")} aria-pressed={f.sound} onClick={() => f.setSound(!f.sound)} />
            <span className="mx-1 h-6 w-px bg-line" aria-hidden />
            <ToolButton icon={Maximize2} label={t("تركيز", "Focus mode")} onClick={enterImmersive} />
            {canPip && <ToolButton icon={PictureInPicture2} label={t("مصغّر", "Mini window")} active={!!mini.win} onClick={() => (mini.win ? mini.close() : void mini.open())} />}
          </div>
        </footer>
      )}

      {music && <MusicDock embed={music} hidden={immersive} onClose={() => setMusic(null)} />}

      <TasksDrawer
        open={drawer}
        onOpenChange={setDrawer}
        tasks={all}
        loading={tasksQ.isPending}
        activeId={state.taskId}
        sessionTaskIds={sessionTaskIds}
        adding={actions.create.isPending}
        onAdd={(title) => actions.create.mutateAsync({ title })}
        onComplete={complete}
        onDelete={remove}
        onFocus={focusOn}
      />
      <PomodoroDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={f.settings} running={!(state.pomodoro.run.startedAt == null && state.pomodoro.run.banked === 0)} onSave={f.saveSettings} />

      {mini.win && createPortal(<Mini f={f} />, mini.win.document.body)}
    </div>
  );
}
