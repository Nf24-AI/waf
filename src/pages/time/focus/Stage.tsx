// المسرح: الأرقام الكبيرة، والأفق تحتها، والأزرار. لكل وضع عرضه، والمكوّنات هنا وحدها
// تُعاد رسمها مع مرور الثواني.

import { Pause, Play, RotateCcw, Settings2, SkipForward } from "lucide-react";
import type { ReactNode } from "react";
import { formatClock, formatDay, t, useLang } from "@/lib/i18n";
import { formatDuration } from "@/lib/time";
import { Button, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { dayFraction } from "@/ui/DayLine";
import { Segmented } from "@/ui/Field";
import {
  GOAL_MS,
  MINUTE_MS,
  TIMER_PRESETS_MIN,
  breakAfter,
  elapsed,
  formatDigits,
  hmsToMs,
  isIdle,
  isRunning,
  progress,
  quoteOfDay,
  remaining,
  splitHms,
  type Phase,
  type Run,
  type TimedMode,
} from "./engine";
import { Horizon } from "./Horizon";
import { useNowMs } from "./ticker";
import type { FocusApi } from "./useFocus";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const PHASE_NAME: Record<Phase, [string, string]> = {
  work: ["وقت التركيز", "Focus time"],
  short: ["استراحة قصيرة", "Short break"],
  long: ["استراحة طويلة", "Long break"],
};

/** دقائق مقرّبة للأعلى بصيغة قصيرة: "٢٥د" */
function dur(ms: number, lang: "ar" | "en") {
  return formatDuration(Math.ceil(ms / MINUTE_MS), lang);
}

export function Digits({ text, paused, className }: { text: string; paused?: boolean; className?: string }) {
  return (
    <p
      dir="ltr"
      role="timer"
      aria-live="off"
      data-paused={paused || undefined}
      data-long={text.length > 5 || undefined}
      className={cx("focus-digits font-display font-semibold tnum select-none text-ink", className)}
    >
      {text.split(":").map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="focus-colon">:</span>}
          {part}
        </span>
      ))}
    </p>
  );
}

/** ساعة لحظةٍ ما، ومعها «غداً» إن وقعت في يوم آخر */
function clockAt(ms: number, now: number): string {
  const c = formatClock(hhmm(ms));
  return new Date(ms).toDateString() === new Date(now).toDateString() ? c : t(`غداً ${c}`, `tomorrow ${c}`);
}

/** تسميتا طرفي الأفق لعدّ تنازلي */
function countdownEnds(run: Run, now: number, lang: "ar" | "en"): [ReactNode, ReactNode] {
  if (isRunning(run)) {
    const s = formatClock(hhmm(now - elapsed(run, now)));
    const e = clockAt(now + remaining(run, now), now);
    return [t(`بدأت ${s}`, `Started ${s}`), t(`تنتهي ${e}`, `Ends ${e}`)];
  }
  if (!isIdle(run)) return [t(`مضى ${dur(elapsed(run, now), lang)}`, `${dur(elapsed(run, now), lang)} done`), t(`بقي ${dur(remaining(run, now), lang)}`, `${dur(remaining(run, now), lang)} left`)];
  const e = clockAt(now + (run.total ?? 0), now);
  return [t("الآن", "Now"), t(`تنتهي ${e} إن بدأت الآن`, `Ends ${e} if you start now`)];
}

function Controls({ f, mode, run, children }: { f: FocusApi; mode: TimedMode; run: Run; children?: ReactNode }) {
  const running = isRunning(run);
  const fresh = isIdle(run);
  const busy = f.starting === mode;
  return (
    <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
      {running ? (
        <Button size="lg" variant="quiet" className="w-full max-w-xs sm:w-auto sm:min-w-40" icon={<Pause className="size-[18px]" strokeWidth={1.75} />} onClick={() => f.pause(mode)}>
          {t("إيقاف مؤقّت", "Pause")}
        </Button>
      ) : (
        <Button size="lg" variant="saffron" className="w-full max-w-xs sm:w-auto sm:min-w-40" disabled={!!f.starting} icon={<Play className="size-[18px]" strokeWidth={1.75} />} onClick={() => void f.start(mode)}>
          {busy ? t("لحظة…", "One moment…") : fresh ? t("ابدأ", "Start") : t("متابعة", "Resume")}
        </Button>
      )}
      {(!fresh || children) && (
        <div className="flex items-center justify-center gap-2">
          {!fresh && (
            <Button size="lg" variant="ghost" icon={<RotateCcw className="size-[18px]" strokeWidth={1.75} />} onClick={() => f.reset(mode)}>
              {t("إعادة ضبط", "Reset")}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function PhaseLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-center gap-3 text-sm text-ink-2">
      {children}
      {action}
    </div>
  );
}

// ───────── بومودورو ─────────

export function PomodoroStage({ f, picker, footer, onSettings }: { f: FocusApi; picker: ReactNode; footer: ReactNode; onSettings: () => void }) {
  const now = useNowMs();
  const lang = useLang();
  const p = f.state.pomodoro;
  const run = p.run;
  const work = p.phase === "work";
  const session = work ? p.rounds + 1 : p.rounds;
  const next: Phase = work ? breakAfter(p.rounds + 1, f.settings.every) : "work";
  const [a, b] = countdownEnds(run, now, lang);
  return (
    <StageFrame
      swapKey={`pomodoro-${p.phase}-${p.rounds}`}
      phase={
        <PhaseLine
          action={
            <IconButton label={t("إعدادات بومودورو", "Pomodoro settings")} onClick={onSettings} className="size-11">
              <Settings2 className="size-[18px]" strokeWidth={1.75} />
            </IconButton>
          }
        >
          <span className={cx("font-medium", work ? "text-ink" : "text-palm")}>{t(...PHASE_NAME[p.phase])}</span>
          <span className="tnum rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">{t(`الجلسة ${session}`, `Session ${session}`)}</span>
        </PhaseLine>
      }
      picker={work ? picker : <p className="text-sm text-ink-2">{t("ابتعد عن الشاشة قليلاً. سيعود التركيز بعدها.", "Step away from the screen for a bit. Focus comes back after.")}</p>}
      digits={<Digits text={formatDigits(remaining(run, now), true)} paused={!isRunning(run) && !isIdle(run)} />}
      horizon={<Horizon fraction={progress(run, now)} running={isRunning(run)} tone={work ? "saffron" : "palm"} start={a} end={b} label={t(`${PHASE_NAME[p.phase][0]}: تقدّم الجلسة`, `${PHASE_NAME[p.phase][1]}: session progress`)} />}
      controls={
        <Controls f={f} mode="pomodoro" run={run}>
          <Button size="lg" variant="ghost" icon={<SkipForward className="size-[18px]" strokeWidth={1.75} />} onClick={f.skip}>
            {t("تخطّي", "Skip")}
          </Button>
        </Controls>
      }
      footer={
        <>
          {footer}
          <span>{t(`التالي: ${PHASE_NAME[next][0]}`, `Next: ${PHASE_NAME[next][1]}`)}</span>
        </>
      }
    />
  );
}

// ───────── المؤقّت ─────────

function HmsInput({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col items-center">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={pad(value)}
        aria-label={label}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(-2);
          const v = Math.min(max, Number(digits || 0));
          onChange(v);
        }}
      />
      <span className="font-ui text-xs font-normal tracking-normal text-ink-3">{label}</span>
    </label>
  );
}

export function TimerStage({ f, picker, footer }: { f: FocusApi; picker: ReactNode; footer: ReactNode }) {
  const now = useNowMs();
  const lang = useLang();
  const run = f.state.timer.run;
  const total = run.total ?? 25 * MINUTE_MS;
  const setup = isIdle(run);
  const { h, m, s } = splitHms(total);
  const [a, b] = countdownEnds(run, now, lang);

  return (
    <StageFrame
      swapKey={`timer-${setup ? "setup" : "run"}`}
      phase={<PhaseLine>{setup ? <span className="font-medium text-ink">{t("حدّد المدة", "Set the length")}</span> : <span className="font-medium text-ink">{t("المؤقّت", "Timer")}</span>}</PhaseLine>}
      picker={picker}
      digits={
        setup ? (
          <div dir="ltr" className="focus-hms focus-digits flex items-baseline justify-center gap-1 font-display font-semibold tnum text-ink" data-long="true" role="group" aria-label={t("مدة المؤقّت", "Timer length")}>
            <HmsInput value={h} max={23} label={t("ساعات", "hours")} onChange={(v) => f.setTimer(hmsToMs(v, m, s))} />
            <span aria-hidden className="focus-colon text-ink-3">:</span>
            <HmsInput value={m} max={59} label={t("دقائق", "minutes")} onChange={(v) => f.setTimer(hmsToMs(h, v, s))} />
            <span aria-hidden className="focus-colon text-ink-3">:</span>
            <HmsInput value={s} max={59} label={t("ثوانٍ", "seconds")} onChange={(v) => f.setTimer(hmsToMs(h, m, v))} />
          </div>
        ) : (
          <Digits text={formatDigits(remaining(run, now), true)} paused={!isRunning(run)} />
        )
      }
      horizon={
        setup ? (
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t("مدد جاهزة", "Quick lengths")}>
            {TIMER_PRESETS_MIN.map((min) => {
              const on = total === min * MINUTE_MS;
              return (
                <button
                  key={min}
                  type="button"
                  aria-pressed={on}
                  onClick={() => f.setTimer(min * MINUTE_MS)}
                  className={cx("press tnum h-11 min-w-16 rounded-full border px-4 text-sm font-medium transition-colors duration-150", on ? "border-ink bg-inverse text-on-inverse" : "border-line text-ink-2 hover:border-line-strong hover:text-ink")}
                >
                  {formatDuration(min, lang)}
                </button>
              );
            })}
          </div>
        ) : (
          <Horizon fraction={progress(run, now)} running={isRunning(run)} start={a} end={b} label={t("تقدّم المؤقّت", "Timer progress")} />
        )
      }
      controls={
        setup ? (
          <Button size="lg" variant="saffron" className="w-full max-w-xs sm:w-auto sm:min-w-48" disabled={!!f.starting || total < 1000} icon={<Play className="size-[18px]" strokeWidth={1.75} />} onClick={() => void f.start("timer")}>
            {f.starting === "timer" ? t("لحظة…", "One moment…") : t("ابدأ المؤقّت", "Start the timer")}
          </Button>
        ) : (
          <Controls f={f} mode="timer" run={run} />
        )
      }
      footer={footer}
    />
  );
}

// ───────── ساعة الإيقاف ─────────

export function StopwatchStage({ f, picker, footer }: { f: FocusApi; picker: ReactNode; footer: ReactNode }) {
  const now = useNowMs();
  const lang = useLang();
  const sw = f.state.stopwatch;
  const run = sw.run;
  const e = elapsed(run, now);
  const left = Math.max(0, GOAL_MS - e);
  const toCheck = Math.max(0, sw.nextCheck - e);
  return (
    <StageFrame
      swapKey="stopwatch"
      phase={
        <PhaseLine>
          <span className="font-medium text-ink">{t("ساعة الإيقاف", "Stopwatch")}</span>
          <span className="text-ink-3">{t("هدف اليوم 8 ساعات", "Today’s goal: 8 hours")}</span>
        </PhaseLine>
      }
      picker={picker}
      digits={<Digits text={formatDigits(e, false)} paused={!isRunning(run) && !isIdle(run)} />}
      horizon={
        <Horizon
          fraction={e / GOAL_MS}
          running={isRunning(run)}
          ticks={[0.25, 0.5, 0.75]}
          start={t(`${dur(e, lang)} منقضية`, `${dur(e, lang)} elapsed`)}
          end={left > 0 ? t(`${dur(left, lang)} متبقّية`, `${dur(left, lang)} to go`) : t("بلغت هدف اليوم", "Today’s goal reached")}
          label={t("التقدّم نحو هدف اليوم", "Progress toward today’s goal")}
        />
      }
      notice={
        sw.checkPending ? (
          <div role="alert" className="mx-auto max-w-md rounded-md border border-saffron/50 bg-saffron-wash px-4 py-3 text-center text-sm text-ink">
            <p className="font-medium">{t("ما زلت تعمل؟", "Still working?")}</p>
            <p className="mt-0.5 text-ink-2">{t("توقّفت ساعة الإيقاف للتحقّق. اضغط «متابعة» لتكمل.", "The stopwatch paused to check. Press Resume to carry on.")}</p>
          </div>
        ) : null
      }
      controls={<Controls f={f} mode="stopwatch" run={run} />}
      footer={
        <>
          {footer}
          {isRunning(run) && <span className="tnum">{t(`${dur(toCheck, lang)} حتى التحقّق`, `${dur(toCheck, lang)} until the check`)}</span>}
          {!isRunning(run) && isIdle(run) && <span>{t("تتوقّف كل ساعتين لتسألك إن كنت ما زلت تعمل", "Pauses every 2 hours to check you’re still working")}</span>}
        </>
      }
    />
  );
}

// ───────── الساعة ─────────

export function ClockStage({ hour24, onHour24 }: { hour24: boolean; onHour24: (v: boolean) => void }) {
  const now = useNowMs();
  const lang = useLang();
  const d = new Date(now);
  const h = d.getHours();
  const shown = hour24 ? pad(h) : String(h % 12 === 0 ? 12 : h % 12);
  const q = quoteOfDay(d);
  const minute = h * 60 + d.getMinutes();
  const suffix = lang === "ar" ? (h < 12 ? "ص" : "م") : h < 12 ? "AM" : "PM";
  return (
    <StageFrame
      swapKey="clock"
      phase={
        <PhaseLine>
          <span className="font-medium text-ink">{formatDay(d)}</span>
        </PhaseLine>
      }
      digits={
        <div className="flex items-baseline justify-center gap-3">
          <Digits text={`${shown}:${pad(d.getMinutes())}`} />
          {!hour24 && <span className="font-display text-2xl text-ink-2 sm:text-3xl">{suffix}</span>}
        </div>
      }
      horizon={
        <Horizon
          fraction={dayFraction(minute)}
          running
          ticks={[1 / 3, 2 / 3]}
          start={formatClock("06:00", !hour24)}
          end={formatClock("00:00", !hour24)}
          label={t("خط اليوم من السادسة صباحاً إلى منتصف الليل", "The day line, from 6 in the morning to midnight")}
        />
      }
      controls={
        <Segmented
          label={t("نظام الساعة", "Clock format")}
          value={hour24 ? "24" : "12"}
          onChange={(v) => onHour24(v === "24")}
          options={[
            { value: "12", label: t("12 ساعة", "12-hour") },
            { value: "24", label: t("24 ساعة", "24-hour") },
          ]}
        />
      }
      footer={
        <figure className="mx-auto max-w-xl text-center">
          <blockquote className="font-display text-lg text-ink-2 sm:text-xl">{t(q.ar, q.en)}</blockquote>
          {q.by && <figcaption className="mt-1 text-xs text-ink-3">{t(q.by[0], q.by[1])}</figcaption>}
        </figure>
      }
    />
  );
}

// ───────── الإطار المشترك ─────────

function StageFrame({
  swapKey,
  phase,
  picker,
  digits,
  horizon,
  notice,
  controls,
  footer,
}: {
  swapKey: string;
  phase: ReactNode;
  picker?: ReactNode;
  digits: ReactNode;
  horizon: ReactNode;
  notice?: ReactNode;
  controls: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div key={swapKey} className="focus-swap flex w-full flex-col items-center">
        {phase}
        <div className="relative z-10 mt-1 flex min-h-12 max-w-2xl items-center justify-center px-2 text-center">{picker}</div>
        <div className="mt-2 sm:mt-4">{digits}</div>
      </div>
      <div className="mt-6 w-full max-w-4xl sm:mt-8">{horizon}</div>
      {notice && <div className="mt-6 w-full">{notice}</div>}
      <div className="mt-8 flex w-full justify-center sm:mt-10">{controls}</div>
      {footer && <div className="mt-6 flex min-h-6 flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-ink-3">{footer}</div>}
    </div>
  );
}
