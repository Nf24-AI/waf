import React, { useEffect, useRef, useState } from "react";
import { CalendarX, Check, Timer } from "lucide-react";
import { Link } from "wouter";
import { TASK_CATEGORIES, type Task, type TaskCategory } from "@shared/tasks";
import { t } from "@/lib/i18n";
import { DAY_END_MIN, formatDuration, formatTime, minutesOf, timeOf, type TimeFormat } from "@/lib/timeblock";

/**
 * نافذة الحجز — إضافةً وتعديلاً.
 *
 * الحجز مهمة لها ساعة، فالتعديل هنا تعديل المهمة نفسها. و«إلغاء الحجز» غير
 * «حذف»: الأول يعيدها إلى قائمة ما ينتظر وقتاً، والثاني يُخفيها.
 */

export interface BlockDraft {
  title: string;
  start: number;
  end: number;
  category: TaskCategory;
}

export default function BlockModal({
  task,
  initial,
  format,
  labels,
  pending,
  focusHref,
  clashTitle,
  onClose,
  onSave,
  onDelete,
  onUnschedule,
  onComplete,
}: {
  /** المهمة المعدَّلة، أو `null` لحجز جديد. */
  task: Task | null;
  initial: BlockDraft;
  format: TimeFormat;
  labels: Record<TaskCategory, string>;
  pending: boolean;
  focusHref: string | null;
  clashTitle: (start: number, end: number) => string | null;
  onClose: () => void;
  onSave: (draft: BlockDraft) => void;
  onDelete: () => void;
  onUnschedule: () => void;
  onComplete: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [start, setStart] = useState(timeOf(initial.start));
  const [end, setEnd] = useState(timeOf(Math.min(initial.end, DAY_END_MIN - 1)));
  const [category, setCategory] = useState<TaskCategory>(initial.category);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => titleRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, []);

  // خطأ الإرسال يصف ما كان؛ أول تعديل بعده يجعله كذباً، فيُمحى.
  useEffect(() => setError(null), [title, start, end, category]);

  const startMin = minutesOf(start);
  const endMin = minutesOf(end) === DAY_END_MIN - 1 ? DAY_END_MIN : minutesOf(end);
  const valid = Boolean(start && end) && endMin > startMin;
  const clash = valid ? clashTitle(startMin, endMin) : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return setError(t("وقت الانتهاء يجب أن يلي وقت البداية", "End time must be after the start time"));
    if (clash) return setError(t(`الوقت مأخوذ بـ«${clash}». اختر وقتاً آخر.`, `That time is taken by “${clash}”. Choose another time.`));
    setError(null);
    onSave({ title: title.trim() || t("حجز جديد", "New time block"), start: startMin, end: endMin, category });
  }

  return (
    <div
      className="tbk-modal"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="tbk-modalbox" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="tbk-block-title">
        <h2 id="tbk-block-title">{task ? t("تعديل الحجز", "Edit time block") : t("إضافة حجز", "Add time block")}</h2>

        <div className="tbk-field">
          <label htmlFor="tbk-block-name">{t("ماذا ستفعل؟", "What will you do?")}</label>
          <input
            id="tbk-block-name"
            ref={titleRef}
            className="tbk-input"
            placeholder={t("مثال: تصميم الصفحة الرئيسية", "e.g. Design the home page")}
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
        </div>
        <div className="tbk-timefields">
          <div className="tbk-field">
            <label htmlFor="tbk-block-start">{t("وقت البداية", "Start time")}</label>
            <input id="tbk-block-start" className="tbk-input" type="time" value={start} onChange={event => setStart(event.target.value)} />
          </div>
          <div className="tbk-field">
            <label htmlFor="tbk-block-end">{t("وقت النهاية", "End time")}</label>
            <input id="tbk-block-end" className="tbk-input" type="time" value={end} onChange={event => setEnd(event.target.value)} />
          </div>
        </div>
        <div className="tbk-field">
          <label htmlFor="tbk-block-category">{t("الفئة", "Category")}</label>
          <select
            id="tbk-block-category"
            className="tbk-input"
            value={category}
            onChange={event => setCategory(event.target.value as TaskCategory)}
          >
            {TASK_CATEGORIES.map(item => (
              <option key={item.id} value={item.id}>
                {labels[item.id]}
              </option>
            ))}
          </select>
        </div>

        <p className={clash || error ? "tbk-hint is-warn" : "tbk-hint"} role={clash || error ? "alert" : undefined}>
          {error ??
            (clash
              ? t(`يتعارض مع «${clash}».`, `Clashes with “${clash}”.`)
              : valid
                ? `${formatTime(startMin, format)} – ${formatTime(endMin, format)} · ${formatDuration(endMin - startMin)}`
                : t("وقت الانتهاء يجب أن يلي البداية.", "End time must be after the start."))}
        </p>

        {task && (
          <div className="tbk-quickacts">
            {focusHref && (
              <Link className="tbk-btn" href={focusHref}>
                <Timer size={14} aria-hidden="true" />
                {t("ابدأ التركيز", "Start focus")}
              </Link>
            )}
            <button type="button" className="tbk-btn" onClick={onComplete} disabled={pending}>
              <Check size={14} aria-hidden="true" />
              {t("أنجزتُها", "Mark done")}
            </button>
            <button type="button" className="tbk-btn" onClick={onUnschedule} disabled={pending}>
              <CalendarX size={14} aria-hidden="true" />
              {t("إلغاء الحجز", "Unschedule")}
            </button>
          </div>
        )}

        <div className="tbk-modalactions">
          {task && (
            <button type="button" className="tbk-btn tbk-btn-danger" onClick={onDelete} disabled={pending}>
              {t("حذف", "Delete")}
            </button>
          )}
          <button type="button" className="tbk-btn" onClick={onClose}>
            {t("إلغاء", "Cancel")}
          </button>
          <button type="submit" className="tbk-btn tbk-btn-primary" disabled={pending}>
            {task ? t("حفظ التغييرات", "Save changes") : t("إضافة الحجز", "Add time block")}
          </button>
        </div>
      </form>
    </div>
  );
}
