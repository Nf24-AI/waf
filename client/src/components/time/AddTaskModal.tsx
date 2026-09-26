// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { QUADRANTS, type Quadrant, type RepeatRule } from "@shared/tasks";
import tanomah from "@/assets/village-at-dusk.jpg";

/**
 * إضافة مهمة — نافذة فوق مكانك، لا صفحة تنقلك عنه.
 *
 * العنوان وحده إلزاميّ. وكل ما تحته اختياريّ ويمكن تعديله لاحقاً من الطريقة
 * التي تخصّه — والسطر الذي يقول ذلك في القدم ليس تزييناً: بدونه يظنّ من
 * يملأها أنّه يُقرّر الآن ما لا رجعة فيه، فيتردّد عند كل خانة.
 *
 * و«بدون تصنيف» هي الافتراض: الرُّبع حكمٌ يصدره صاحب المهمة، وإسناده
 * تلقائياً يملأ المصفوفة بأحكام لم يصدرها أحد.
 */

const DESCRIPTION_LIMIT = 500;

/** رمز كل ربع ولونه — نفس ترتيب المصفوفة. */
const QUADRANT_ICON: Record<Quadrant, typeof Target> = {
  important_urgent: AlertTriangle,
  important_not_urgent: CalendarDays,
  not_important_urgent: Users,
  not_important_not_urgent: Trash2,
};

/**
 * أوقات مقترحة بدل منتقي وقت كامل.
 *
 * من يضيف مهمة يريد أن يفرغ رأسه لا أن يفتح تقويماً. والحجز الدقيق مكانه
 * «حجز الوقت»، وهي خطوة قائمة بذاتها.
 */
const WHEN_OPTIONS = [
  { id: "", label: "اختر وقتاً" },
  { id: "today-09", label: "اليوم ٩:٠٠", day: 0, hour: 9 },
  { id: "today-14", label: "اليوم ٢:٠٠ ظهراً", day: 0, hour: 14 },
  { id: "tomorrow-09", label: "غداً ٩:٠٠", day: 1, hour: 9 },
] as const;

const REMINDER_OPTIONS = [
  { value: "", label: "بدون تذكير" },
  { value: "0", label: "عند الموعد" },
  { value: "10", label: "قبل ١٠ دقائق" },
  { value: "60", label: "قبل ساعة" },
] as const;

const DURATION_OPTIONS = [25, 45, 60, 90] as const;

export interface NewTask {
  title: string;
  description?: string;
  quadrant?: Quadrant;
  estimatedMinutes?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  reminderMinutes?: number;
  repeatRule?: RepeatRule;
}

/** يبني الموعد من خيار مقترح ومدّة، أو لا شيء إن لم يُختر وقت. */
export function scheduleFrom(
  option: string,
  minutes: number,
  now: Date = new Date(),
): { start: string; end: string } | null {
  const picked = WHEN_OPTIONS.find(item => item.id === option);
  if (!picked || !("hour" in picked)) return null;

  const start = new Date(now);
  start.setDate(start.getDate() + picked.day);
  start.setHours(picked.hour, 0, 0, 0);
  const end = new Date(start.getTime() + minutes * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function AddTaskModal({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (task: NewTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quadrant, setQuadrant] = useState<Quadrant | "">("");
  const [minutes, setMinutes] = useState(60);
  const [when, setWhen] = useState("");
  const [reminder, setReminder] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => titleRef.current?.focus(), 40);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;

    const slot = scheduleFrom(when, minutes);
    onSubmit({
      title: clean,
      description: description.trim() || undefined,
      quadrant: quadrant || undefined,
      estimatedMinutes: minutes,
      scheduledStart: slot?.start,
      scheduledEnd: slot?.end,
      // التذكير بلا موعد لا معنى له: لا شيء يُنبَّه عنده.
      reminderMinutes: slot && reminder !== "" ? Number(reminder) : undefined,
    });
  }

  return (
    <div className="ntk-scrim" role="presentation" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ntk" role="dialog" aria-modal="true" aria-labelledby="ntk-title" dir="rtl">
        <header className="ntk-head">
          <img src={tanomah} alt="" aria-hidden="true" />
          <button type="button" className="ntk-close" onClick={onClose} aria-label="إغلاق">
            <X size={18} aria-hidden="true" />
          </button>

          <div className="ntk-head-text">
            <h2 id="ntk-title">إضافة مهمة</h2>
            <p>خطوة صغيرة اليوم تصنع فرقاً أكبر غداً.</p>
          </div>

          <p className="ntk-head-aside">
            <b>الأفكار العظيمة</b>
            تبدأ من مهمة واحدة.
          </p>
        </header>

        <form className="ntk-body" onSubmit={submit}>
          <label className="ntk-field">
            <span className="ntk-label">
              ماذا تريد إنجازه؟ <i aria-hidden="true">*</i>
            </span>
            <span className="ntk-input">
              <Target size={17} aria-hidden="true" />
              <input
                ref={titleRef}
                type="text"
                value={title}
                required
                maxLength={200}
                placeholder="مثال: إعداد العرض التقديمي"
                onChange={e => setTitle(e.target.value)}
              />
            </span>
          </label>

          <label className="ntk-field">
            <span className="ntk-label">الوصف (اختياري)</span>
            <span className="ntk-input ntk-input-area">
              <FileText size={17} aria-hidden="true" />
              <textarea
                rows={3}
                value={description}
                maxLength={DESCRIPTION_LIMIT}
                placeholder="أضف تفاصيل تساعدك عند العودة للمهمة …"
                onChange={e => setDescription(e.target.value)}
              />
              <i className="ntk-count" aria-hidden="true">
                {description.length}/{DESCRIPTION_LIMIT}
              </i>
            </span>
          </label>

          <fieldset className="ntk-field ntk-quads">
            <legend className="ntk-label">التصنيف (اختياري)</legend>

            <div className="ntk-grid">
              {QUADRANTS.map(item => {
                const Icon = QUADRANT_ICON[item.id];
                const picked = quadrant === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={picked ? "ntk-quad is-picked" : "ntk-quad"}
                    data-q={item.id}
                    aria-pressed={picked}
                    // ضغطة ثانية تلغي الاختيار: «بدون تصنيف» يجب أن يبقى ممكناً
                    // بعد أن يُجرَّب أحدها، وإلا صار أوّل ضغط قراراً لا رجعة فيه.
                    onClick={() => setQuadrant(picked ? "" : item.id)}
                  >
                    <span className="ntk-radio" aria-hidden="true" />
                    <span className="ntk-quad-text">
                      <b>{item.title}</b>
                      <i>{item.verb}</i>
                    </span>
                    <Icon size={19} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="ntk-row">
            <label className="ntk-field">
              <span className="ntk-label">
                <Clock size={14} aria-hidden="true" />
                المدة (اختياري)
              </span>
              <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
                {DURATION_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option} دقيقة
                  </option>
                ))}
              </select>
            </label>

            <label className="ntk-field">
              <span className="ntk-label">
                <CalendarDays size={14} aria-hidden="true" />
                الوقت (اختياري)
              </span>
              <select value={when} onChange={e => setWhen(e.target.value)}>
                {WHEN_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ntk-field">
              <span className="ntk-label">
                <Bell size={14} aria-hidden="true" />
                التذكير (اختياري)
              </span>
              {/* بلا وقت لا تذكير: الخانة تُعطَّل بدل أن تَعِد بما لا يقع. */}
              <select value={reminder} disabled={!when} onChange={e => setReminder(e.target.value)}>
                {REMINDER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p className="au-error" role="alert">
              {error}
            </p>
          )}

          <footer className="ntk-foot">
            <p className="ntk-hint">
              <Sparkles size={15} aria-hidden="true" />
              يمكنك تعديل كل هذه الخيارات لاحقاً.
            </p>
            <div className="ntk-acts">
              <button type="button" className="tp-btn" onClick={onClose}>
                إلغاء
              </button>
              <button type="submit" className="tp-btn tp-btn-primary" disabled={pending || !title.trim()}>
                {pending ? <Loader2 size={16} className="tm-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                إضافة المهمة
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
