import React from "react";
import { IDLE_MS, IDLE_WARN_MS } from "@shared/const";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleLock, type IdleLock } from "./useIdleLock";

function Harness({
  enabled,
  onIdle,
  onKeepAlive,
  seen,
}: {
  enabled: boolean;
  onIdle: () => void;
  onKeepAlive?: () => void;
  seen: IdleLock[];
}) {
  seen.push(useIdleLock(enabled, onIdle, onKeepAlive));
  return null;
}

/** The hook's latest return value, since the countdown changes every second. */
function mount(enabled: boolean, onIdle: () => void, onKeepAlive?: () => void) {
  const seen: IdleLock[] = [];
  render(<Harness enabled={enabled} onIdle={onIdle} onKeepAlive={onKeepAlive} seen={seen} />);
  return () => seen[seen.length - 1];
}

describe("useIdleLock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("locks once the page has sat untouched for the idle window", () => {
    const onIdle = vi.fn();
    mount(true, onIdle);

    act(() => void vi.advanceTimersByTime(IDLE_MS - 1000));
    expect(onIdle).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1000));
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("locks only once, however late the ticks arrive", () => {
    const onIdle = vi.fn();
    mount(true, onIdle);

    act(() => void vi.advanceTimersByTime(IDLE_MS + 10_000));

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does not lock a workspace someone is still using", () => {
    const onIdle = vi.fn();
    const idle = mount(true, onIdle);

    // A keystroke two minutes before the deadline buys a fresh window, not
    // two more minutes.
    act(() => void vi.advanceTimersByTime(IDLE_MS - IDLE_WARN_MS - 60_000));
    act(() => void window.dispatchEvent(new Event("keydown")));
    act(() => void vi.advanceTimersByTime(IDLE_MS - IDLE_WARN_MS - 1000));

    // Roughly seventeen minutes have now passed on the clock. Without the
    // keystroke resetting it, this would be long locked.
    expect(onIdle).not.toHaveBeenCalled();
    expect(idle().warning).toBe(false);
  });

  it("asks before locking, and counts down", () => {
    const onIdle = vi.fn();
    const idle = mount(true, onIdle);

    act(() => void vi.advanceTimersByTime(IDLE_MS - IDLE_WARN_MS - 1000));
    expect(idle().warning).toBe(false);

    act(() => void vi.advanceTimersByTime(1000));
    expect(idle().warning).toBe(true);
    expect(idle().secondsLeft).toBe(IDLE_WARN_MS / 1000);

    act(() => void vi.advanceTimersByTime(30_000));
    expect(idle().secondsLeft).toBe(30);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("keeps the countdown running through a stray scroll", () => {
    const onIdle = vi.fn();
    const idle = mount(true, onIdle);

    act(() => void vi.advanceTimersByTime(IDLE_MS - 20_000));
    expect(idle().warning).toBe(true);

    // Activity must not answer the question on the person's behalf: nudging the
    // mouse on the way to the button would otherwise dismiss it silently.
    act(() => void window.dispatchEvent(new Event("wheel")));
    expect(idle().warning).toBe(true);
    expect(idle().secondsLeft).toBe(20);
  });

  it("hands back the full window when asked to stay", () => {
    const onIdle = vi.fn();
    const idle = mount(true, onIdle);

    act(() => void vi.advanceTimersByTime(IDLE_MS - 10_000));
    expect(idle().warning).toBe(true);

    act(() => idle().stay());
    expect(idle().warning).toBe(false);

    act(() => void vi.advanceTimersByTime(IDLE_MS - 1000));
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("stays out of the way when there is no gate to lock back to", () => {
    const onIdle = vi.fn();
    const idle = mount(false, onIdle);

    act(() => void vi.advanceTimersByTime(IDLE_MS * 3));

    expect(onIdle).not.toHaveBeenCalled();
    expect(idle().warning).toBe(false);
  });

  it("locks a tab that was hidden past its deadline, on the way back", () => {
    const onIdle = vi.fn();
    mount(true, onIdle);

    // Timers are throttled in a background tab, so the deadline is a timestamp
    // that gets re-checked rather than a countdown that is trusted to fire.
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    vi.setSystemTime(Date.now() + IDLE_MS + 1000);

    visibility.mockReturnValue("visible");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));

    expect(onIdle).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it("tells the server someone is here, so a long note does not expire mid-typing", () => {
    const keepAlive = vi.fn();
    mount(true, vi.fn(), keepAlive);

    // Typing steadily. The page never asks the server for anything on its own —
    // saving is a button — so without this ping the cookie would lapse at ten
    // minutes and Save would fail with the note still unsaved.
    for (let minute = 1; minute <= 14; minute += 1) {
      act(() => void vi.advanceTimersByTime(60_000));
      act(() => void window.dispatchEvent(new Event("keydown")));
    }

    expect(keepAlive).toHaveBeenCalled();
  });

  it("pings on a throttle, not once a keystroke", () => {
    const keepAlive = vi.fn();
    mount(true, vi.fn(), keepAlive);

    for (let i = 0; i < 50; i += 1) {
      act(() => void window.dispatchEvent(new Event("keydown")));
    }
    expect(keepAlive).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(IDLE_WARN_MS));
    act(() => void window.dispatchEvent(new Event("keydown")));
    expect(keepAlive).toHaveBeenCalledTimes(1);
  });

  it("keeps the server ahead of the countdown, never behind it", () => {
    const keepAlive = vi.fn();
    let lastPing = 0;
    const idle = mount(true, vi.fn(), () => {
      keepAlive();
      lastPing = Date.now();
    });

    // Work for a while, then stop. Twenty-four minutes is chosen so activity
    // ends four minutes after the last ping the old half-window throttle would
    // have sent — the worst moment, not a convenient one.
    for (let i = 0; i < 24; i += 1) {
      act(() => void vi.advanceTimersByTime(IDLE_WARN_MS));
      act(() => void window.dispatchEvent(new Event("keydown")));
    }
    const lastActivity = Date.now();
    act(() => void vi.advanceTimersByTime(IDLE_MS - IDLE_WARN_MS));
    expect(idle().warning).toBe(true);

    // The server's token dies at lastPing + IDLE_MS. Throttling by half the
    // window used to put that four minutes BEFORE the question was even asked,
    // so the button reset a clock on a session that was already gone.
    expect(lastPing + IDLE_MS).toBeGreaterThan(lastActivity + IDLE_MS - IDLE_WARN_MS);
  });

  it("reaches the server when the question is answered, not just the clock", () => {
    const keepAlive = vi.fn();
    const idle = mount(true, vi.fn(), keepAlive);

    act(() => void vi.advanceTimersByTime(IDLE_MS - 10_000));
    expect(idle().warning).toBe(true);
    keepAlive.mockClear();

    act(() => idle().stay());

    expect(keepAlive).toHaveBeenCalledTimes(1);
    expect(idle().warning).toBe(false);
  });
});
