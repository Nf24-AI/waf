import React, { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check, Circle, Clock, X } from "lucide-react";
import { TASK_CATEGORIES, TASK_PRIORITIES, type RepeatRule, type TaskCategory, type TaskPriority } from "@shared/tasks";
import {
  DAY_END_MIN,
  DURATIONS,
  PRIORITY_LABEL,
  WEEKDAY_SHORT,
  formatDuration,
  formatTime,
  minutesOf,
  parseDuration,
  shiftDay,
  timeOf,
  type TimeFormat,
} from "@/lib/timeblock";

/**
 * درج «مهمة جديدة» — التقاطٌ سريع ثم جدولة إن شاء صاحبها.
 *
 * الدرج لا يكتب شيئاً: يجمع الاختيار ويسلّمه. والصفحة هي من تعرف الحجوزات،
 * فهي من تقترح أول فراغ وتقول إن كان الوقت المختار مأخوذاً — والدرج يسألها.
 */

export interface ComposerResult {
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  minutes: number;
  day: string;
  repeatRule: RepeatRule | null;
  repeatDays: number[];
  /** دقائق من منتصف الليل، أو `null` لمهمة بلا ساعة. */
  schedule: { start: number; end: number } | null;
}

export interface ComposerPrefill {
  title?: string;
  category?: TaskCategory;
}

type Due = "today" | "tomorrow" | "pick";

const REPEATS: { value: RepeatRule | null; label: string }[] = [
  { value: null, label: "لا يتكرّر" },
  { value: "daily", label: "كل يوم" },
  { value: "weekdays", label: "أيام العمل" },
  { value: "weekly", label: "كل أسبوع" },
  { value: "custom", label: "مخصّص" },
];

/** خانة الوقت لا تقبل «24:00»، فآخر ما يُكتب فيها دقيقةٌ قبلها. */
function inputTime(minutes: number): string {
  return timeOf(Math.min(minutes, DAY_END_MIN - 1));
}

export default function TaskComposer({
  viewDay,
  format,
  labels,
  prefill,
  pending,
  suggestStart,
  clashTitle,
  onClose,
  onCreate,
}: {
  viewDay: string;
  format: TimeFormat;
  labels: Record<TaskCategory, string>;
  prefill: ComposerPrefill | null;
  pending: boolean;
  /** أول فراغ يسع المدّة في ذلك اليوم، أو `null` إن امتلأ. */
  suggestStart: (day: string, minutes: number) => number | null;
  /** عنوان ما يتعارض مع هذا الوقت، أو `null`. */
  clashTitle: (day: string, start: number, end: number) => string | null;
  onClose: () => void;
  onCreate: (result: ComposerResult) => void;
}) {
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [due, setDue] = useState<Due>("today");
  const [picked, setPicked] = useState(viewDay);
  const [timed, setTimed] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [duration, setDuration] = useState<number | "custom">(30);
  const [custom, setCustom] = useState("");
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [category, setCategory] = useState<TaskCategory>(prefill?.category ?? "deep");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, []);

  // خطأ الإرسال يصف ما كان؛ أول تعديل بعده يجعله كذباً، فيُمحى.
  useEffect(() => setError(null), [title, due, picked, timed, start, end, duration, custom, repeat, days, category, priority]);

  const day = due === "today" ? viewDay : due === "tomorrow" ? shiftDay(viewDay, 1) : picked || viewDay;
  const minutes = duration === "custom" ? parseDuration(custom) : duration;
  const validMinutes = Number.isFinite(minutes) && minutes >= 5 && minutes <= DAY_END_MIN;

  const startMin = minutesOf(start);
  const endMin = minutesOf(end) === DAY_END_MIN - 1 ? DAY_END_MIN : minutesOf(end);
  const clash = timed && endMin > startMin ? clashTitle(day, startMin, endMin) : null;

  /** المدّة تحرّك النهاية: من اختار «ساعة» يريد ساعةً من بدايته، لا خانتين يوفّق بينهما. */
  function chooseDuration(value: number | "custom") {
    setDuration(value);
    if (value !== "custom") setEnd(inputTime(minutesOf(start) + value));
  }

  function changeStart(value: string) {
    setStart(value);
    if (value && validMinutes) setEnd(inputTime(minutesOf(value) + minutes));
  }

  /** نهايةٌ كُتبت باليد تُعرّف المدّة، فتُقرأ منها بدل أن تخالفها الشريحة المضيئة. */
  function changeEnd(value: string) {
    setEnd(value);
    const span = minutesOf(value) - minutesOf(start);
    if (!value || span < 5) return;
    if ((DURATIONS as readonly number[]).includes(span)) setDuration(span);
    else {
      setDuration("custom");
      setCustom(formatDuration(span));
    }
  }

  function chooseTimed(next: boolean) {
    setTimed(next);
    if (next) pickFirstFree();
  }

  function pickFirstFree() {
    const length = validMinutes ? minutes : 30;
    const free = suggestStart(day, length);
    if (free === null) return;
    setStart(timeOf(free));
    setEnd(inputTime(free + length));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError("اكتب اسم المهمة");
      nameRef.current?.focus();
      return;
    }
    if (!timed && !validMinutes) return setError("اكتب مدّة صحيحة، مثل «1س 20د» أو «45»");
    if (timed && endMin - startMin < 5) return setError("وقت الانتهاء يجب أن يلي وقت البداية");
    if (repeat === "custom" && !days.length) return setError("اختر يوماً واحداً على الأقل للتكرار");
    if (clash) return setError(`الوقت مأخوذ بـ«${clash}». اختر وقتاً آخر أو اضغط «أول وقت فارغ».`);

    setError(null);
    onCreate({
      title: clean,
      category,
      priority,
      minutes: timed ? endMin - startMin : minutes,
      day,
      repeatRule: repeat,
      repeatDays: repeat === "custom" ? days : [],
      schedule: timed ? { start: startMin, end: endMin } : null,
    });
  }

  return (
    <div
      className="tbk-drawer"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="tbk-drawer-panel" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="tbk-composer-title">
        <div className="tbk-drawer-head">
          <div>
            <div className="tbk-eyebrow">التقاط سريع</div>
            <h2 id="tbk-composer-title">مهمة جديدة</h2>
          </div>
          <button className="tbk-close" type="button" onClick={onClose} aria-label="إغلاق">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="tbk-form">
          <label htmlFor="tbk-task-name">على ماذا ستعمل؟</label>
          <input
            id="tbk-task-name"
            ref={nameRef}
            className="tbk-input tbk-input-lg"
            placeholder="مثال: إنهاء تصميم الصفحة الرئيسية"
            autoComplete="off"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />

          <div className="tbk-label">متى</div>
          <div className="tbk-choices" role="group" aria-label="متى">
            {([
              ["today", "اليوم"],
              ["tomorrow", "غداً"],
              ["pick", "اختر تاريخاً"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className="tbk-choice" aria-pressed={due === value} onClick={() => setDue(value)}>
                {label}
              </button>
            ))}
          </div>
          {due === "pick" && (
            <div className="tbk-reveal">
              <input
                className="tbk-input"
                type="date"
                aria-label="التاريخ"
                value={picked}
                onChange={event => setPicked(event.target.value)}
              />
            </div>
          )}

          <div className="tbk-options">
            <button type="button" className="tbk-option" aria-pressed={!timed} onClick={() => chooseTimed(false)}>
              <span className="tbk-option-icon"><Clock size={15} aria-hidden="true" /></span>
              <span>
                <strong>بلا وقت محدّد</strong>
                <small>تبقى في القائمة حتى تسحبها إلى ساعتها</small>
              </span>
              <i>{!timed ? <Check size={15} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}</i>
            </button>
            <button type="button" className="tbk-option" aria-pressed={timed} onClick={() => chooseTimed(true)}>
              <span className="tbk-option-icon"><Clock size={15} aria-hidden="true" /></span>
              <span>
                <strong>حدّد وقتاً</strong>
                <small>توضع مباشرةً على جدولك الزمني</small>
              </span>
              <i>{timed ? <Check size={15} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />}</i>
            </button>
          </div>
          {timed && (
            <div className="tbk-reveal">
              <div className="tbk-timefields">
                <div className="tbk-field">
                  <label htmlFor="tbk-task-start">البداية</label>
                  <input id="tbk-task-start" className="tbk-input" type="time" value={start} onChange={event => changeStart(event.target.value)} />
                </div>
                <div className="tbk-field">
                  <label htmlFor="tbk-task-end">النهاية</label>
                  <input id="tbk-task-end" className="tbk-input" type="time" value={end} onChange={event => changeEnd(event.target.value)} />
                </div>
              </div>
              <p className={clash ? "tbk-hint is-warn" : "tbk-hint"} role={clash ? "alert" : undefined}>
                {clash
                  ? `يتعارض مع «${clash}».`
                  : endMin > startMin
                    ? `${formatTime(startMin, format)} – ${formatTime(endMin, format)} · ${formatDuration(endMin - startMin)}`
                    : "وقت الانتهاء يجب أن يلي البداية."}
                <button type="button" className="tbk-link" onClick={pickFirstFree}>
                  أول وقت فارغ
                </button>
              </p>
            </div>
          )}

          <div className="tbk-label">كم تحتاج؟</div>
          <div className="tbk-choices" role="group" aria-label="المدّة">
            {DURATIONS.map(option => (
              <button key={option} type="button" className="tbk-choice" aria-pressed={duration === option} onClick={() => chooseDuration(option)}>
                {formatDuration(option)}
              </button>
            ))}
            <button type="button" className="tbk-choice" aria-pressed={duration === "custom"} onClick={() => chooseDuration("custom")}>
              مخصّص
            </button>
          </div>
          {duration === "custom" && (
            <div className="tbk-reveal">
              <input
                className="tbk-input"
                aria-label="مدّة مخصّصة"
                placeholder="مثال: 1س 20د أو 80"
                value={custom}
                onChange={event => {
                  setCustom(event.target.value);
                  const parsed = parseDuration(event.target.value);
                  if (Number.isFinite(parsed) && parsed >= 5) setEnd(inputTime(minutesOf(start) + parsed));
                }}
              />
            </div>
          )}

          <div className="tbk-label">التكرار</div>
          <div className="tbk-choices" role="group" aria-label="التكرار">
            {REPEATS.map(option => (
              <button key={option.label} type="button" className="tbk-choice" aria-pressed={repeat === option.value} onClick={() => setRepeat(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          {repeat === "custom" && (
            <div className="tbk-reveal">
              <div className="tbk-reveal-title">يتكرّر في</div>
              <div className="tbk-choices" role="group" aria-label="أيام التكرار">
                {WEEKDAY_SHORT.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    className="tbk-choice"
                    aria-pressed={days.includes(index)}
                    onClick={() => setDays(current => (current.includes(index) ? current.filter(d => d !== index) : [...current, index].sort()))}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {repeat && !timed && <p className="tbk-hint">التكرار يبدأ حين تُحجز للمهمة ساعة.</p>}

          <div className="tbk-label">الفئة</div>
          <div className="tbk-catgrid" role="group" aria-label="الفئة">
            {TASK_CATEGORIES.map(item => (
              <button key={item.id} type="button" className="tbk-catchoice" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
                <span className="tbk-dot" data-tone={item.tone} aria-hidden="true" />
                {labels[item.id]}
              </button>
            ))}
          </div>

          <div className="tbk-label">الأولوية</div>
          <div className="tbk-choices" role="group" aria-label="الأولوية">
            {TASK_PRIORITIES.map(value => (
              <button key={value} type="button" className="tbk-choice" aria-pressed={priority === value} onClick={() => setPriority(value)}>
                {PRIORITY_LABEL[value]}
              </button>
            ))}
          </div>

          <div className="tbk-tip">
            <ArrowUpDown size={15} aria-hidden="true" />
            <div>
              <strong>جدولة مرنة</strong>
              <small>اتركها بلا وقت ثم اسحبها إلى أي ساعة في الجدول الزمني. على الجوّال: اضغط عليها مطوّلاً ثم اسحب.</small>
            </div>
          </div>

          {error && (
            <p className="tbk-hint is-warn" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="tbk-drawer-foot">
          <button className="tbk-btn" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button className="tbk-btn tbk-btn-primary" type="submit" disabled={pending}>
            إنشاء المهمة
          </button>
        </div>
      </form>
    </div>
  );
}
