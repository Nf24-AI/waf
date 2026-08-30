import { useEffect, useRef } from "react";

/**
 * The question asked before the workspace locks itself.
 *
 * Shown for the last minute of the idle window. It is deliberately a decision
 * and not a toast: a meeting left half-prepared on screen is the thing being
 * protected, and quietly locking it loses whatever was being typed.
 *
 * Answering is the only thing that clears it — see useIdleLock, where activity
 * stops extending the deadline once the countdown is running.
 */
export default function IdleWarning({
  secondsLeft,
  onStay,
  onLockNow,
  language,
}: {
  secondsLeft: number;
  onStay: () => void;
  onLockNow: () => void;
  language: "ar" | "en";
}) {
  const isArabic = language === "ar";
  const stayButton = useRef<HTMLButtonElement>(null);

  // The dialog interrupts; the key that dismisses an interruption should reach
  // it wherever focus happened to be when it appeared.
  useEffect(() => {
    stayButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onStay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="idle-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-body"
    >
      <div className="idle-card waf-dots">
        <p className="lock-eyebrow">{isArabic ? "جلسة خاملة" : "IDLE SESSION"}</p>

        <h2 className="idle-title" id="idle-title">
          {isArabic ? "هل تريد البقاء في الصفحة؟" : "Stay on this page?"}
        </h2>

        <p className="idle-body" id="idle-body">
          {isArabic
            ? "لم يحدث شيء في الصفحة منذ فترة، وستُقفل مساحة العمل تلقائياً."
            : "Nothing has happened here for a while, and the workspace will lock itself."}
        </p>

        {/*
          aria-live on the number alone: announcing the whole sentence every
          second would talk over the buttons. Latin digits so a screen reader
          and the countdown agree, and tabular figures so it does not jitter.
        */}
        <p className="idle-countdown">
          <span aria-live="polite" aria-atomic="true">
            {secondsLeft}
          </span>
          <span className="idle-countdown-unit">{isArabic ? "ثانية" : "seconds"}</span>
        </p>

        <div className="idle-actions">
          <button className="primary-button" type="button" ref={stayButton} onClick={onStay}>
            {isArabic ? "البقاء في الصفحة" : "Stay on the page"}
          </button>
          <button className="secondary-button" type="button" onClick={onLockNow}>
            {isArabic ? "أقفلها الآن" : "Lock now"}
          </button>
        </div>
      </div>
    </div>
  );
}
