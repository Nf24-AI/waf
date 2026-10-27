import { describe, expect, it } from "vitest";
import {
  CHECK_EVERY_MS,
  HOUR_MS,
  MINUTE_MS,
  POMO_DEFAULTS,
  TIMER_MAX_MS,
  advance,
  applySettings,
  breakAfter,
  elapsed,
  endTaskSessions,
  formatDigits,
  hmsToMs,
  initialState,
  openWorkMs,
  pause,
  plannedMinutes,
  quoteOfDay,
  remaining,
  reset,
  sanitizeSettings,
  sanitizeState,
  setTimerDuration,
  skip,
  splitHms,
  start,
  type FocusState,
} from "./engine";

const S = POMO_DEFAULTS;
const T0 = 1_700_000_000_000;

describe("runs are anchored to timestamps", () => {
  it("counts elapsed time across pause and resume", () => {
    let s = start(initialState(), "pomodoro", T0, { id: "a", taskId: null });
    s = pause(s, "pomodoro", T0 + 10_000);
    expect(elapsed(s.pomodoro.run, T0 + 999_999)).toBe(10_000);
    s = start(s, "pomodoro", T0 + 60_000);
    expect(elapsed(s.pomodoro.run, T0 + 65_000)).toBe(15_000);
    expect(remaining(s.pomodoro.run, T0 + 65_000)).toBe(25 * MINUTE_MS - 15_000);
  });

  it("starting twice keeps the first start", () => {
    const s = start(start(initialState(), "timer", T0), "timer", T0 + 5000);
    expect(s.timer.run.startedAt).toBe(T0);
  });

  it("runs the three timers independently", () => {
    let s = initialState();
    s = start(s, "timer", T0);
    s = start(s, "stopwatch", T0 + 1000);
    s = pause(s, "timer", T0 + 3000);
    expect(elapsed(s.timer.run, T0 + 10_000)).toBe(3000);
    expect(elapsed(s.stopwatch.run, T0 + 10_000)).toBe(9000);
    expect(s.pomodoro.run.startedAt).toBeNull();
  });
});

describe("advance", () => {
  it("finishes a timer at its real end time, even if checked much later", () => {
    let s = setTimerDuration(initialState(), 60_000);
    s = start(s, "timer", T0, { id: "x", taskId: "t1" });
    const r = advance(s, T0 + 10 * MINUTE_MS, S);
    expect(r.events).toEqual([{ type: "finished", mode: "timer", phase: null, at: T0 + 60_000, workedMs: 60_000, session: { id: "x", taskId: "t1" } }]);
    expect(r.state.timer.run).toEqual({ startedAt: null, banked: 0, total: 60_000 });
    expect(r.state.sessions.timer).toBeNull();
  });

  it("does nothing before the end", () => {
    const s = start(initialState(), "timer", T0);
    const r = advance(s, T0 + 1000, S);
    expect(r.events).toEqual([]);
    expect(r.state).toBe(s);
  });

  it("moves pomodoro work to a short break, idle without autoBreaks", () => {
    const s = start(initialState(), "pomodoro", T0, { id: "p", taskId: null });
    const r = advance(s, T0 + 26 * MINUTE_MS, S);
    expect(r.events.map((e) => e.type)).toEqual(["finished"]);
    expect(r.state.pomodoro.phase).toBe("short");
    expect(r.state.pomodoro.rounds).toBe(1);
    expect(r.state.pomodoro.run).toEqual({ startedAt: null, banked: 0, total: 5 * MINUTE_MS });
  });

  it("with autoBreaks, the break starts at the real end of work and can itself finish", () => {
    const auto = { ...S, autoBreaks: true };
    const s = start(initialState(auto), "pomodoro", T0);
    const mid = advance(s, T0 + 27 * MINUTE_MS, auto);
    expect(mid.state.pomodoro.run.startedAt).toBe(T0 + 25 * MINUTE_MS);
    expect(remaining(mid.state.pomodoro.run, T0 + 27 * MINUTE_MS)).toBe(3 * MINUTE_MS);
    const late = advance(s, T0 + 60 * MINUTE_MS, auto);
    expect(late.events.map((e) => e.type)).toEqual(["finished", "breakOver"]);
    expect(late.state.pomodoro.phase).toBe("work");
    expect(late.state.pomodoro.run.startedAt).toBeNull();
  });

  it("gives a long break every N rounds", () => {
    expect(breakAfter(1, 4)).toBe("short");
    expect(breakAfter(4, 4)).toBe("long");
    expect(breakAfter(8, 4)).toBe("long");
    expect(breakAfter(3, 1)).toBe("long");
    let s = initialState();
    s = { ...s, pomodoro: { ...s.pomodoro, rounds: 3 } };
    s = start(s, "pomodoro", T0);
    expect(advance(s, T0 + 25 * MINUTE_MS, S).state.pomodoro.phase).toBe("long");
  });

  it("pauses the stopwatch every two hours for the check", () => {
    let s = start(initialState(), "stopwatch", T0, { id: "w", taskId: null });
    const r = advance(s, T0 + 2 * HOUR_MS + 30 * MINUTE_MS, S);
    expect(r.events).toEqual([{ type: "check", at: T0 + 2 * HOUR_MS }]);
    expect(r.state.stopwatch.run.startedAt).toBeNull();
    expect(r.state.stopwatch.run.banked).toBe(CHECK_EVERY_MS);
    expect(r.state.stopwatch.checkPending).toBe(true);
    expect(r.state.stopwatch.nextCheck).toBe(4 * HOUR_MS);
    expect(r.state.sessions.stopwatch).not.toBeNull();
    s = start(r.state, "stopwatch", T0 + 3 * HOUR_MS);
    expect(s.stopwatch.checkPending).toBe(false);
    expect(advance(s, T0 + 3 * HOUR_MS + HOUR_MS, S).events).toEqual([]);
  });
});

describe("reset, skip and sessions", () => {
  it("reset closes the open session as not completed with the worked time", () => {
    let s = start(initialState(), "pomodoro", T0, { id: "p", taskId: "t" });
    const r = reset(s, "pomodoro", T0 + 90_000);
    expect(r.ended).toEqual({ session: { id: "p", taskId: "t" }, workedMs: 90_000, completed: false });
    expect(r.state.sessions.pomodoro).toBeNull();
    expect(r.state.pomodoro.run.startedAt).toBeNull();
    s = r.state;
    expect(reset(s, "pomodoro", T0).ended).toBeNull();
  });

  it("skip does not count a round", () => {
    const s = start(initialState(), "pomodoro", T0, { id: "p", taskId: null });
    const r = skip(s, T0 + 1000, S);
    expect(r.state.pomodoro.rounds).toBe(0);
    expect(r.state.pomodoro.phase).toBe("short");
    expect(r.ended?.completed).toBe(false);
    expect(skip(r.state, T0, S).state.pomodoro.phase).toBe("work");
  });

  it("ends sessions of a completed task and clears the label", () => {
    let s: FocusState = { ...initialState(), taskId: "t" };
    s = start(s, "timer", T0, { id: "a", taskId: "t" });
    s = start(s, "stopwatch", T0, { id: "b", taskId: "other" });
    const r = endTaskSessions(s, "t", T0 + 5000);
    expect(r.ended.map((e) => e.session.id)).toEqual(["a"]);
    expect(r.state.taskId).toBeNull();
    expect(r.state.sessions.stopwatch?.id).toBe("b");
  });

  it("counts only open work sessions as running time", () => {
    let s = start(initialState(), "stopwatch", T0, { id: "b", taskId: null });
    s = start(s, "timer", T0); // بلا جلسة
    expect(openWorkMs(s, T0 + 4000)).toBe(4000);
  });

  it("planned minutes clamp to 1–240", () => {
    expect(plannedMinutes({ startedAt: null, banked: 0, total: 25 * MINUTE_MS })).toBe(25);
    expect(plannedMinutes({ startedAt: null, banked: 0, total: 10_000 })).toBe(1);
    expect(plannedMinutes({ startedAt: null, banked: 0, total: TIMER_MAX_MS })).toBe(240);
    expect(plannedMinutes({ startedAt: null, banked: 0, total: null })).toBe(240);
  });
});

describe("settings", () => {
  it("keeps the previous value when out of range", () => {
    const s = sanitizeSettings({ work: 300, short: 0, long: 20, every: 2.5, autoBreaks: "yes" }, { ...S, work: 50 });
    expect(s).toEqual({ work: 50, short: 5, long: 20, every: 4, autoBreaks: false });
  });

  it("applies new settings only when pomodoro is idle", () => {
    const next = { ...S, work: 50 };
    expect(applySettings(initialState(), next).pomodoro.run.total).toBe(50 * MINUTE_MS);
    const running = start(initialState(), "pomodoro", T0);
    expect(applySettings(running, next)).toBe(running);
  });

  it("timer duration is clamped and only set while idle", () => {
    expect(setTimerDuration(initialState(), 99 * HOUR_MS).timer.run.total).toBe(TIMER_MAX_MS);
    expect(setTimerDuration(initialState(), 0).timer.run.total).toBe(1000);
    const running = start(initialState(), "timer", T0);
    expect(setTimerDuration(running, 5000)).toBe(running);
  });
});

describe("persistence", () => {
  it("round-trips through JSON", () => {
    let s = start(initialState(), "pomodoro", T0, { id: "p", taskId: "t" });
    s = { ...s, view: "stopwatch", taskId: "t" };
    expect(sanitizeState(JSON.parse(JSON.stringify(s)), S, T0 + 1000)).toEqual(s);
  });

  it("falls back on garbage", () => {
    expect(sanitizeState(null, S, T0)).toEqual(initialState());
    expect(sanitizeState("x", S, T0)).toEqual(initialState());
    expect(sanitizeState({ v: 2 }, S, T0)).toEqual(initialState());
    const bad = sanitizeState({ v: 1, view: "nope", timer: { run: { startedAt: "x", banked: -5, total: Infinity } }, sessions: { timer: { id: 3 } } }, S, T0);
    expect(bad.view).toBe("pomodoro");
    expect(bad.timer.run).toEqual({ startedAt: null, banked: 0, total: 25 * MINUTE_MS });
    expect(bad.sessions.timer).toBeNull();
  });

  it("clamps a start time in the future to now", () => {
    const s = start(initialState(), "timer", T0 + HOUR_MS);
    expect(sanitizeState(JSON.parse(JSON.stringify(s)), S, T0).timer.run.startedAt).toBe(T0);
  });
});

describe("display", () => {
  it("formats countdown and count-up digits", () => {
    expect(formatDigits(25 * MINUTE_MS, true)).toBe("25:00");
    expect(formatDigits(25 * MINUTE_MS - 1, true)).toBe("25:00");
    expect(formatDigits(1, true)).toBe("00:01");
    expect(formatDigits(0, true)).toBe("00:00");
    expect(formatDigits(999, false)).toBe("00:00");
    expect(formatDigits(TIMER_MAX_MS, true)).toBe("23:59:59");
    expect(formatDigits(30 * HOUR_MS + 5000, false)).toBe("30:00:05");
    expect(formatDigits(-50, true)).toBe("00:00");
  });

  it("splits and joins h:m:s with clamping", () => {
    expect(splitHms(3_723_000)).toEqual({ h: 1, m: 2, s: 3 });
    expect(hmsToMs(1, 2, 3)).toBe(3_723_000);
    expect(hmsToMs(99, 99, 99)).toBe(TIMER_MAX_MS);
    expect(hmsToMs(NaN, -1, 5)).toBe(5000);
  });

  it("rotates the quote by day of month", () => {
    expect(quoteOfDay(new Date(2026, 0, 1))).toBe(quoteOfDay(new Date(2026, 0, 6)));
    expect(quoteOfDay(new Date(2026, 0, 1))).not.toBe(quoteOfDay(new Date(2026, 0, 2)));
  });
});
