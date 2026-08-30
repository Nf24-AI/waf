import { IDLE_MS, IDLE_WARN_MS } from "@shared/const";
import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "./usePersistFn";

/**
 * Activity is anything a person does to the page. Each event pushes the
 * deadline out rather than sampling a clock, so a session in use never trips.
 */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll", "touchstart", "focus"] as const;

export type IdleLock = {
  /** True for the last IDLE_WARN_MS, while the countdown is on screen. */
  warning: boolean;
  /** Whole seconds until the lock, for the countdown to render. */
  secondsLeft: number;
  /** "Stay on the page" — hands back the full window. */
  stay: () => void;
};

/**
 * Lock the workspace after IDLE_MS with nothing happening on the page, after
 * asking first.
 *
 * The server already expires the session token after the same window, but a
 * token expiring changes nothing on screen: a workspace left open keeps
 * showing the meeting — attendees, agenda, notes — until something asks the
 * server a question. This closes it from the browser side, so the page itself
 * goes back behind the gate.
 *
 * The deadline is kept as a timestamp and compared against the clock on every
 * tick, rather than trusted to a countdown. A backgrounded tab has its timers
 * throttled, so a countdown there runs slow; a timestamp does not care how
 * late the tick arrives.
 */
export function useIdleLock(enabled: boolean, onIdle: () => void, onKeepAlive?: () => void): IdleLock {
  const lock = usePersistFn(onIdle);
  const keepAlive = usePersistFn(() => onKeepAlive?.());
  const lastPing = useRef(0);

  const ping = usePersistFn(() => {
    lastPing.current = Date.now();
    keepAlive();
  });
  const [msLeft, setMsLeft] = useState(IDLE_MS);
  const deadline = useRef(0);
  const fired = useRef(false);

  const stay = usePersistFn(() => {
    deadline.current = Date.now() + IDLE_MS;
    fired.current = false;
    setMsLeft(IDLE_MS);
  });

  useEffect(() => {
    if (!enabled) return;
    stay();
    // The unlock that got us here just issued a fresh cookie.
    lastPing.current = Date.now();

    const tick = () => {
      const remaining = Math.max(0, deadline.current - Date.now());
      setMsLeft(remaining);
      if (remaining > 0 || fired.current) return;
      // Guard the ref, not the interval: a tab that woke up late can tick twice
      // before React re-renders with `enabled` false and tears this down.
      fired.current = true;
      lock();
    };

    /**
     * Activity only counts before the warning. Once the countdown is on screen
     * a stray scroll must not silently cancel it — the question was put to the
     * person, and it is answered by the button.
     */
    const onActivity = () => {
      if (deadline.current - Date.now() <= IDLE_WARN_MS) return;
      stay();

      // The server's window only slides when a request arrives, and saving
      // here is a button rather than an autosave: someone can type for a
      // quarter of an hour while the server hears nothing and expires the
      // session under them.
      //
      // The interval is IDLE_WARN_MS and not something larger for a reason.
      // It bounds how stale the server's deadline can be against the
      // browser's, so the token still has life left when the countdown
      // appears. Throttling by half the window instead let the session die
      // four minutes before anyone was asked about it, and the button then
      // reset a clock on a session that was already gone.
      if (Date.now() - lastPing.current < IDLE_WARN_MS) return;
      ping();
    };

    // Timers are throttled in a background tab, so the lock can be overdue by
    // the time focus returns. Re-check immediately rather than on the next tick.
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    const interval = setInterval(tick, 1000);
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, lock, ping, stay]);

  /**
   * Answering the question has to reach the server, not just the clock here.
   * By the time it is asked the token is inside its last minute, and resetting
   * only the browser would leave a workspace that looks unlocked and fails on
   * the next save. If the ping finds the session already gone, useAuth sends
   * us back to the gate.
   */
  const answerStay = usePersistFn(() => {
    stay();
    ping();
  });

  return {
    warning: enabled && msLeft <= IDLE_WARN_MS,
    secondsLeft: Math.ceil(msLeft / 1000),
    stay: answerStay,
  };
}
