import React, { useEffect, useRef, useState } from "react";
import { CalendarX, Check, Timer } from "lucide-react";
import { Link } from "wouter";
import { TASK_CATEGORIES, type Task, type TaskCategory } from "@shared/tasks";
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
    if (!valid) return setError("وقت الانتهاء يجب أن يلي وقت البداية");
    if (clash) return setError(`الوقت مأخوذ بـ«${clash}». اختر وقتاً آخر.`);
    setError(null);
    onSave({ title: title.trim() || "حجز جديد", start: startMin, end: endMin, category });
  }

  return (
    <div
      className="tbk-modal"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="tbk-modalbox" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="tbk-block-title">
        <h2 id="tbk-block-title">{task ? "تعديل الحجز" : "إضافة حجز"}</h2>

        <div className="tbk-field">
          <label htmlFor="tbk-block-name">ماذا ستفعل؟</label>
          <input
            id="tbk-block-name"
            ref={titleRef}
            className="tbk-input"
            placeholder="مثال: تصميم الصفحة الرئيسية"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
        </div>
        <div className="tbk-timefields">
          <div className="tbk-field">
            <label htmlFor="tbk-block-start">وقت البداية</label>
            <input id="tbk-block-start" className="tbk-input" type="time" value={start} onChange={event => setStart(event.target.value)} />
          </div>
          <div className="tbk-field">
            <label htmlFor="tbk-block-end">وقت النهاية</label>
            <input id="tbk-block-end" className="tbk-input" type="time" value={end} onChange={event => setEnd(event.target.value)} />
          </div>
        </div>
        <div className="tbk-field">
          <label htmlFor="tbk-block-category">الفئة</label>
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
              ? `يتعارض مع «${clash}».`
              : valid
                ? `${formatTime(startMin, format)} – ${formatTime(endMin, format)} · ${formatDuration(endMin - startMin)}`
                : "وقت الانتهاء يجب أن يلي البداية.")}
        </p>

        {task && (
          <div className="tbk-quickacts">
            {focusHref && (
              <Link className="tbk-btn" href={focusHref}>
                <Timer size={14} aria-hidden="true" />
                ابدأ التركيز
              </Link>
            )}
            <button type="button" className="tbk-btn" onClick={onComplete} disabled={pending}>
              <Check size={14} aria-hidden="true" />
              أنجزتُها
            </button>
            <button type="button" className="tbk-btn" onClick={onUnschedule} disabled={pending}>
              <CalendarX size={14} aria-hidden="true" />
              إلغاء الحجز
            </button>
          </div>
        )}

        <div className="tbk-modalactions">
          {task && (
            <button type="button" className="tbk-btn tbk-btn-danger" onClick={onDelete} disabled={pending}>
              حذف
            </button>
          )}
          <button type="button" className="tbk-btn" onClick={onClose}>
            إلغاء
          </button>
          <button type="submit" className="tbk-btn tbk-btn-primary" disabled={pending}>
            {task ? "حفظ التغييرات" : "إضافة الحجز"}
          </button>
        </div>
      </form>
    </div>
  );
}
