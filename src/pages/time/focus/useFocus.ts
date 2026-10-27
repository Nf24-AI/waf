// حالة صفحة التركيز: المؤقّتات الثلاثة، وجلسات التسجيل، والجرس، والتخزين.
// المنطق الخالص في engine.ts؛ هنا الآثار الجانبية فقط.

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/data/client";
import { errorText, keys, toastError } from "@/data/hooks";
import type { TaskOrigin } from "@/data/types";
import { t } from "@/lib/i18n";
import { chime, unlockAudio } from "./audio";
import {
  advance,
  applySettings,
  endTaskSessions,
  isRunning,
  isWork,
  pause as pauseState,
  plannedMinutes,
  reset as resetState,
  runOf,
  sanitizeSettings,
  sanitizeState,
  setTimerDuration,
  skip as skipState,
  start as startState,
  type Ended,
  type FocusEvent,
  type FocusState,
  type PomoSettings,
  type TimedMode,
  type View,
} from "./engine";
import { readJson, writeJson } from "./ticker";

const SETTINGS_KEY = "waf:pomodoro";
const SOUND_KEY = "waf:focus-sound";
const stateKey = (origin: TaskOrigin) => `waf:focus-state:${origin}`;
/** الجرس لا يرنّ لانتهاء حدث قبل أكثر من هذا (مثلاً بعد إعادة فتح الصفحة بساعات) */
const CHIME_FRESH_MS = 15_000;

export interface Prompt {
  taskId: string;
}

export function useFocus(origin: TaskOrigin) {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<PomoSettings>(() => sanitizeSettings(readJson(SETTINGS_KEY)));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [sound, setSoundState] = useState<boolean>(() => readJson(SOUND_KEY) !== false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const [state, setState] = useState<FocusState>(() => sanitizeState(readJson(stateKey(origin)), settingsRef.current, Date.now()));
  const stateRef = useRef(state);

  const [starting, setStarting] = useState<TimedMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [announce, setAnnounce] = useState("");
  /** ثوانٍ أُغلقت جلستها ولم يصل مجموع اليوم الجديد من الخادم بعد */
  const [credit, setCredit] = useState(0);

  const commit = useCallback((next: FocusState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    writeJson(stateKey(origin), state);
  }, [origin, state]);

  const say = useCallback((text: string) => {
    // يُفرَّغ أولاً حتى تُقرأ الرسالة نفسها إن تكرّرت
    setAnnounce("");
    window.setTimeout(() => setAnnounce(text), 60);
  }, []);

  const endSession = useCallback(
    (e: Ended) => {
      const workedSeconds = Math.max(0, Math.round(e.workedMs / 1000));
      setCredit((c) => c + workedSeconds);
      api.focus
        .end(e.session.id, { workedSeconds, completed: e.completed })
        .then(() => qc.invalidateQueries({ queryKey: keys.focusToday(origin) }))
        .then(() => qc.invalidateQueries({ queryKey: keys.tasks(origin) }))
        .catch(toastError)
        .finally(() => setCredit((c) => c - workedSeconds));
      if (e.session.taskId && (e.completed || workedSeconds >= 60)) setPrompt({ taskId: e.session.taskId });
    },
    [origin, qc],
  );

  const handle = useCallback(
    (events: FocusEvent[], now: number) => {
      let ring = false;
      for (const ev of events) {
        if (now - ev.at < CHIME_FRESH_MS) ring = true;
        if (ev.type === "finished") {
          if (ev.session) endSession({ session: ev.session, workedMs: ev.workedMs, completed: true });
          if (ev.mode === "timer") say(t("انتهى المؤقّت.", "Timer finished."));
          else if (ev.mode === "pomodoro") say(t("انتهى وقت التركيز. حان وقت الاستراحة.", "Focus time is over. Time for a break."));
        } else if (ev.type === "breakOver") {
          say(t("انتهت الاستراحة. ابدأ جلسة التركيز التالية حين تكون جاهزاً.", "Break’s over. Start the next focus session when you’re ready."));
        } else if (ev.type === "check") {
          say(t("ما زلت تعمل؟ توقّفت ساعة الإيقاف للتحقّق.", "Still working? The stopwatch paused to check."));
        }
      }
      if (ring && soundRef.current) chime();
    },
    [endSession, say],
  );

  // المحرّك: يقدّم الحالة كل نصف ثانية، وفوراً عند عودة التبويب أو تغيّر الإعدادات
  useEffect(() => {
    const step = () => {
      const now = Date.now();
      const r = advance(stateRef.current, now, settingsRef.current);
      if (r.events.length) {
        commit(r.state);
        handle(r.events, now);
      }
    };
    step();
    const id = window.setInterval(step, 500);
    const onVis = () => document.visibilityState === "visible" && step();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [commit, handle]);

  const setView = useCallback((view: View) => commit({ ...stateRef.current, view }), [commit]);

  const start = useCallback(
    async (mode: TimedMode) => {
      unlockAudio();
      setError(null);
      const s = stateRef.current;
      const run = runOf(s, mode);
      if (isRunning(run) || starting) return;
      if (!isWork(s, mode) || s.sessions[mode]) {
        commit(startState(s, mode, Date.now()));
        return;
      }
      // المؤقّت المحلي يبدأ بعد أن يعيد الخادم رقم الجلسة
      setStarting(mode);
      try {
        const id = await api.focus.start({ taskId: s.taskId, origin, mode, plannedMinutes: plannedMinutes(run) });
        commit(startState(stateRef.current, mode, Date.now(), { id, taskId: s.taskId }));
      } catch (e) {
        setError(errorText(e));
      } finally {
        setStarting(null);
      }
    },
    [commit, origin, starting],
  );

  const pause = useCallback((mode: TimedMode) => commit(pauseState(stateRef.current, mode, Date.now())), [commit]);

  const reset = useCallback(
    (mode: TimedMode) => {
      setError(null);
      const r = resetState(stateRef.current, mode, Date.now());
      commit(r.state);
      if (r.ended) endSession(r.ended);
    },
    [commit, endSession],
  );

  const skip = useCallback(() => {
    setError(null);
    const r = skipState(stateRef.current, Date.now(), settingsRef.current);
    commit(r.state);
    if (r.ended) endSession(r.ended);
    say(r.state.pomodoro.phase === "work" ? t("عدت إلى وقت التركيز.", "Back to focus time.") : t("تخطّيت إلى الاستراحة.", "Skipped to the break."));
  }, [commit, endSession, say]);

  const setTimer = useCallback((ms: number) => commit(setTimerDuration(stateRef.current, ms)), [commit]);

  const setTask = useCallback((taskId: string | null) => commit({ ...stateRef.current, taskId }), [commit]);

  /** حين تُنجَز مهمة من القائمة: تُغلق جلساتها ويُزال اختيارها */
  const releaseTask = useCallback(
    (taskId: string) => {
      const r = endTaskSessions(stateRef.current, taskId, Date.now());
      commit(r.state);
      r.ended.forEach((e) => endSession({ ...e, session: { ...e.session, taskId: null } }));
      setPrompt((p) => (p?.taskId === taskId ? null : p));
    },
    [commit, endSession],
  );

  const saveSettings = useCallback(
    (next: PomoSettings) => {
      setSettings(next);
      settingsRef.current = next;
      writeJson(SETTINGS_KEY, next);
      commit(applySettings(stateRef.current, next));
    },
    [commit],
  );

  const setSound = useCallback((on: boolean) => {
    setSoundState(on);
    writeJson(SOUND_KEY, on);
    if (on) unlockAudio();
  }, []);

  return {
    state,
    settings,
    sound,
    starting,
    error,
    prompt,
    announce,
    credit,
    setView,
    start,
    pause,
    reset,
    skip,
    setTimer,
    setTask,
    releaseTask,
    saveSettings,
    setSound,
    dismissPrompt: () => setPrompt(null),
    dismissError: () => setError(null),
  };
}

export type FocusApi = ReturnType<typeof useFocus>;
