import { describe, expect, it } from "vitest";
import {
  breakAfter,
  countdownLeft,
  DEFAULT_POMODORO,
  hoursMinutes,
  idleRun,
  pauseCountdown,
  pauseStopwatch,
  sanitizePomodoro,
  spokenDuration,
  startCountdown,
  startStopwatch,
  stopwatchElapsed,
  timeGroups,
} from "./focus-timer";

describe("countdown", () => {
  it("measures from the deadline, not from ticks", () => {
    const run = startCountdown(idleRun(1500), 1_000_000);
    expect(countdownLeft(run, 1_000_000)).toBe(1500);
    // تبويب نام عشر دقائق: الرقم صحيح عند أول قراءة.
    expect(countdownLeft(run, 1_000_000 + 600_000)).toBe(900);
    expect(countdownLeft(run, 1_000_000 + 9_000_000)).toBe(0);
  });

  it("keeps what is left across a pause", () => {
    const paused = pauseCountdown(startCountdown(idleRun(60), 0), 20_000);
    expect(paused.status).toBe("paused");
    expect(countdownLeft(paused, 999_999)).toBe(40);
    expect(countdownLeft(startCountdown(paused, 500_000), 510_000)).toBe(30);
  });
});

describe("stopwatch", () => {
  it("does not count the paused stretch", () => {
    const paused = pauseStopwatch(startStopwatch(idleRun(0), 0), 90_000);
    expect(stopwatchElapsed(paused, 5_000_000)).toBe(90);
    expect(stopwatchElapsed(startStopwatch(paused, 5_000_000), 5_030_000)).toBe(120);
  });
});

describe("pomodoro", () => {
  it("gives a long break every fourth round", () => {
    expect([1, 2, 3, 4, 5, 8].map(rounds => breakAfter(rounds, 4))).toEqual([
      "short", "short", "short", "long", "short", "long",
    ]);
  });

  it("pulls stored settings back inside their limits", () => {
    expect(sanitizePomodoro({ work: 50, short: 0, long: "x", every: 99, autoBreaks: true })).toEqual({
      ...DEFAULT_POMODORO,
      work: 50,
      autoBreaks: true,
    });
    expect(sanitizePomodoro(null, 90).work).toBe(90);
  });
});

describe("display", () => {
  it("adds the hours only when they are needed or asked for", () => {
    expect(timeGroups(1500)).toEqual(["25", "00"]);
    expect(timeGroups(3725)).toEqual(["01", "02", "05"]);
    expect(timeGroups(65, { hours: true })).toEqual(["00", "01", "05"]);
    expect(timeGroups(1500, { seconds: false })).toEqual(["00", "25"]);
  });

  it("speaks short durations", () => {
    expect(spokenDuration(3900)).toBe("1h 5m");
    expect(spokenDuration(1140)).toBe("19m 0s");
    expect(spokenDuration(40)).toBe("0m 40s");
    expect(hoursMinutes(1080, true)).toBe("00h 18m");
    expect(hoursMinutes(27660)).toBe("7h 41m");
  });
});
