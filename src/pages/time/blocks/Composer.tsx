// نافذة «مهمة جديدة»: عنوان، ثم بلا وقت أو وقت محدّد، والمدة، والتكرار، والفئة، والأولوية.

import { AlertTriangle } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Category, Priority, RepeatRule, Task, TaskInput } from "@/data/types";
import { t, useLang } from "@/lib/i18n";
import { firstFreeSlot } from "@/lib/tasks";
import { addDays, formatDuration, fromMinutes, isDay, parseDay, toMinutes } from "@/lib/time";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Dialog } from "@/ui/Dialog";
import { control } from "@/ui/Field";
import { checkDraft, draftLength, DURATIONS, durationFields, endText, type Draft } from "./draft";
import { categoryName, CATEGORY_TONE, priorityName, TONE, weekdayLong, weekdayShort, type Labels } from "./meta";
import { clock } from "./Timeline";
import { CATEGORIES, DAY_FROM, DAY_TO, defaultFrom, isoAt } from "./schedule";

export interface ComposerPreset {
  title?: string;
  category?: Category;
  timed?: boolean;
  day?: string;
  /** دقيقة البداية المطلوبة؛ يُبحث منها عن أول وقت فارغ */
  start?: number;
  length?: number;
}

export function ChoiceChips<T extends string | number>({
  label,
  value,
  options,
  onChange,
  labelledBy,
}: {
  label?: string;
  labelledBy?: string;
  value: T | null;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "press inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150 max-md:h-11",
              on ? "border-ink bg-inverse text-on-inverse" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Label({ id, children, hint }: { id: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <p id={id} className="text-xs font-medium text-ink-2">
        {children}
      </p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Composer({
  open,
  onOpenChange,
  preset,
  tasks,
  today,
  now,
  hour12,
  labels,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset: ComposerPreset;
  /** مهام المصدر المفتوحة، للتعارض وأول وقت فارغ */
  tasks: Task[];
  today: string;
  now: Date;
  hour12: boolean;
  labels: Labels;
  onCreate: (input: Omit<TaskInput, "origin">, day: string | null) => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("مهمة جديدة", "New task")} size="md">
      {open && <ComposerForm preset={preset} tasks={tasks} today={today} now={now} hour12={hour12} labels={labels} onCreate={onCreate} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function ComposerForm({
  preset,
  tasks,
  today,
  now,
  hour12,
  labels,
  onCreate,
  onDone,
}: {
  preset: ComposerPreset;
  tasks: Task[];
  today: string;
  now: Date;
  hour12: boolean;
  labels: Labels;
  onCreate: (input: Omit<TaskInput, "origin">, day: string | null) => Promise<unknown>;
  onDone: () => void;
}) {
  const lang = useLang();
  const fmt = (m: number) => formatDuration(m, lang);

  // أول وقت فارغ من البداية المطلوبة؛ وإن لم يبقَ في اليوم ما يسعها فمن أوله
  const slotFor = (day: string, length: number, from?: number) => {
    const want = from ?? defaultFrom(day, today, now);
    return firstFreeSlot(tasks, parseDay(day), want, length) ?? firstFreeSlot(tasks, parseDay(day), DAY_FROM, length) ?? Math.min(want, DAY_TO - length);
  };

  // آخر الليل: إن لم يبقَ اليوم ما يسع المهمة فالاقتراح غداً
  const initialDay = (() => {
    const day = preset.day ?? today;
    if (!preset.timed || day !== today || preset.start !== undefined) return day;
    return firstFreeSlot(tasks, parseDay(day), defaultFrom(day, today, now), preset.length ?? 30) === null ? addDays(today, 1) : day;
  })();
  const [d, setD] = useState<Draft>(() => {
    const day = initialDay;
    const length = preset.length ?? 30;
    const start = preset.timed ? slotFor(day, length, preset.start) : (preset.start ?? 9 * 60);
    return {
      title: preset.title ?? "",
      timed: !!preset.timed,
      day,
      start: fromMinutes(start),
      end: endText(Math.min(DAY_TO, start + length)),
      ...durationFields(length, fmt),
      repeat: null,
      repeatDays: [],
      category: preset.category ?? "deep",
      priority: "medium",
    };
  });
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [whenMode, setWhenMode] = useState<"today" | "tomorrow" | "pick">(() => {
    const day = initialDay;
    return day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : "pick";
  });

  const check = useMemo(() => checkDraft(d, tasks), [d, tasks]);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  /** يحرّك النهاية مع المدة */
  function setLength(length: number | null, patch: Partial<Draft>) {
    if (d.timed && length !== null) {
      const s = toMinutes(d.start);
      set({ ...patch, end: endText(Math.min(DAY_TO, s + length)) });
    } else set(patch);
  }

  function setDay(day: string) {
    if (!isDay(day)) return set({ day });
    const length = draftLength(d) ?? 30;
    if (d.timed) {
      const s = slotFor(day, length);
      set({ day, start: fromMinutes(s), end: endText(Math.min(DAY_TO, s + length)) });
    } else set({ day });
  }

  function setTimed(timed: boolean) {
    if (!timed) return set({ timed });
    const length = draftLength(d) ?? 30;
    let day = d.day;
    if (day === today && preset.start === undefined && firstFreeSlot(tasks, parseDay(day), defaultFrom(day, today, now), length) === null) {
      day = addDays(today, 1);
      setWhenMode("tomorrow");
    }
    const s = slotFor(day, length, preset.start);
    set({ timed, day, start: fromMinutes(s), end: endText(Math.min(DAY_TO, s + length)) });
  }

  function firstFree() {
    const length = check.length ?? draftLength(d) ?? 30;
    const s = firstFreeSlot(tasks, parseDay(d.day), check.startMin ?? defaultFrom(d.day, today, now), length);
    if (s === null) return;
    set({ start: fromMinutes(s), end: endText(Math.min(DAY_TO, s + length)) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(check.errors).length) {
      const first = document.querySelector<HTMLElement>("[data-composer] [aria-invalid='true']");
      first?.focus();
      return;
    }
    const length = check.length ?? 30;
    const input: Omit<TaskInput, "origin"> = {
      title: d.title.trim(),
      category: d.category,
      priority: d.priority,
      estimateMinutes: length,
      repeatRule: d.repeat,
      repeatDays: d.repeat === "custom" ? [...d.repeatDays].sort() : [],
      ...(d.timed && check.startMin !== null && check.endMin !== null ? { startsAt: isoAt(d.day, check.startMin), endsAt: isoAt(d.day, check.endMin) } : {}),
    };
    setSaving(true);
    try {
      await onCreate(input, d.timed ? d.day : null);
      onDone();
    } catch {
      /* الخطأ يظهر في تنبيه من طبقة البيانات */
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof typeof check.errors) => tried && !!check.errors[k];
  const lengthNow = check.length;

  return (
    <form onSubmit={submit} noValidate data-composer className="flex flex-col gap-6">
      <div>
        <label htmlFor="c-title" className="mb-2 block text-xs font-medium text-ink-2">
          {t("على ماذا ستعمل؟", "What will you work on?")}
        </label>
        <input
          id="c-title"
          dir={d.title ? "auto" : undefined}
          autoFocus
          value={d.title}
          maxLength={200}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t("مثال: إنهاء تصميم الصفحة الرئيسية", "e.g. Finish the home page design")}
          aria-invalid={err("title") || undefined}
          aria-describedby={err("title") ? "c-title-err" : undefined}
          className={cx(control, "h-11")}
        />
        {err("title") && (
          <p id="c-title-err" role="alert" className="mt-1.5 text-xs text-ember">
            {t("اكتب اسم المهمة", "Write the task’s name")}
          </p>
        )}
      </div>

      {/* الوقت */}
      <div>
        <Label id="c-time">{t("الوقت", "Time")}</Label>
        <div role="radiogroup" aria-labelledby="c-time" className="grid gap-2 sm:grid-cols-2">
          {[
            { v: false, title: t("بلا وقت محدّد", "No set time"), body: t("تبقى في القائمة حتى تسحبها إلى ساعتها", "Stays in the list until you drag it to its hour") },
            { v: true, title: t("حدّد وقتاً", "Set a time"), body: t("توضع مباشرةً على جدولك الزمني", "Goes straight onto your schedule") },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={d.timed === o.v}
              onClick={() => setTimed(o.v)}
              className={cx(
                "press rounded-md border px-3.5 py-3 text-start transition-colors duration-150",
                d.timed === o.v ? "border-ink bg-sunk" : "border-line hover:border-line-strong",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={cx("grid size-4 place-items-center rounded-full border-[1.5px]", d.timed === o.v ? "border-ink" : "border-line-strong")} aria-hidden>
                  {d.timed === o.v && <span className="size-2 rounded-full bg-ink" />}
                </span>
                {o.title}
              </span>
              <span className="mt-1 block ps-6 text-xs text-ink-3">{o.body}</span>
            </button>
          ))}
        </div>

        {d.timed && (
          <div className="mt-4 flex flex-col gap-4 rounded-md border border-line p-3.5">
            <div>
              <Label id="c-when">{t("متى", "When")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <ChoiceChips
                  labelledBy="c-when"
                  value={whenMode}
                  onChange={(v) => {
                    setWhenMode(v);
                    if (v === "today") setDay(today);
                    if (v === "tomorrow") setDay(addDays(today, 1));
                  }}
                  options={[
                    { value: "today", label: t("اليوم", "Today") },
                    { value: "tomorrow", label: t("غداً", "Tomorrow") },
                    { value: "pick", label: t("اختر تاريخاً", "Pick a date") },
                  ]}
                />
                {whenMode === "pick" && (
                  <input type="date" aria-label={t("التاريخ", "Date")} value={d.day} min={today} onChange={(e) => setDay(e.target.value)} className={cx(control, "h-9 w-auto max-md:h-11")} />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="c-start" className="mb-1.5 block text-xs font-medium text-ink-2">
                  {t("يبدأ", "Starts")}
                </label>
                <input
                  id="c-start"
                  type="time"
                  step={300}
                  value={d.start}
                  aria-invalid={err("start") || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    const len = check.length ?? draftLength(d) ?? 30;
                    if (/^\d\d:\d\d$/.test(v)) set({ start: v, end: endText(Math.min(DAY_TO, toMinutes(v) + len)) });
                    else set({ start: v });
                  }}
                  className={cx(control, "tnum h-10")}
                />
              </div>
              <div>
                <label htmlFor="c-end" className="mb-1.5 block text-xs font-medium text-ink-2">
                  {t("ينتهي", "Ends")}
                </label>
                <input
                  id="c-end"
                  type="time"
                  step={300}
                  value={d.end}
                  aria-invalid={err("end") || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...d, end: v };
                    const c = checkDraft(next, tasks);
                    set({ end: v, ...(c.length && !c.errors.end ? durationFields(c.length, fmt) : {}) });
                  }}
                  className={cx(control, "tnum h-10")}
                />
              </div>
            </div>
            <div aria-live="polite" className="-mt-1 text-xs">
              {check.errors.end || check.errors.start ? (
                <p className={tried ? "text-ember" : "text-ink-3"} role={tried ? "alert" : undefined}>
                  {t("وقت الانتهاء يجب أن يلي البداية بخمس دقائق على الأقل.", "The end must be at least 5 minutes after the start.")}
                </p>
              ) : check.clash ? (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ember" role="alert">
                  <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />
                  {tried
                    ? t(`الوقت مأخوذ بـ«${check.clash.title}». اختر وقتاً آخر أو اضغط «أول وقت فارغ».`, `That time is taken by “${check.clash.title}”. Pick another time or press “First free slot”.`)
                    : t(`يتعارض مع «${check.clash.title}».`, `Clashes with “${check.clash.title}”.`)}
                  <button type="button" onClick={firstFree} className="press rounded-sm font-medium text-dusk underline decoration-dusk/40 underline-offset-4">
                    {t("أول وقت فارغ", "First free slot")}
                  </button>
                </p>
              ) : (
                check.startMin !== null &&
                check.endMin !== null && (
                  <p className="tnum text-ink-2">
                    {clock(check.startMin, hour12)} – {clock(check.endMin, hour12)}
                    <span className="ms-2 text-ink-3">{fmt(check.endMin - check.startMin)}</span>
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* المدة */}
      <div>
        <Label id="c-len">{t("كم تحتاج؟", "How long?")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <ChoiceChips
            labelledBy="c-len"
            value={d.duration}
            onChange={(v) => (v === "custom" ? set({ duration: "custom", customText: d.customText || (lengthNow ? fmt(lengthNow) : "") }) : setLength(v, { duration: v, customText: "" }))}
            options={[...DURATIONS.map((m) => ({ value: m as number | "custom", label: <span className="tnum">{fmt(m)}</span> })), { value: "custom", label: t("مخصّص", "Custom") }]}
          />
          {d.duration === "custom" && (
            <input
              aria-label={t("مدة مخصّصة", "Custom length")}
              value={d.customText}
              autoFocus
              onChange={(e) => {
                const text = e.target.value;
                setLength(draftLength({ duration: "custom", customText: text }), { customText: text });
              }}
              placeholder={t("مثل: ١س ٢٠د", "e.g. 1h 20m")}
              aria-invalid={(d.customText !== "" || tried) && draftLength(d) === null ? true : undefined}
              className={cx(control, "h-9 w-36 max-md:h-11")}
            />
          )}
        </div>
        {d.duration === "custom" && draftLength(d) === null && (d.customText !== "" || tried) && (
          <p className="mt-1.5 text-xs text-ember" role="alert">
            {t("اكتب مدّة صحيحة، مثل «1س 20د» أو «45»", "Write a valid length, like “1h 20m” or “45”")}
          </p>
        )}
      </div>

      {/* التكرار */}
      <div>
        <Label id="c-rep" hint={d.repeat && !d.timed ? t("التكرار يبدأ حين تُحجز للمهمة ساعة.", "Repeating starts once the task is booked.") : undefined}>
          {t("التكرار", "Repeat")}
        </Label>
        <ChoiceChips<RepeatRule | "none">
          labelledBy="c-rep"
          value={d.repeat ?? "none"}
          onChange={(v) => set({ repeat: v === "none" ? null : v, repeatDays: v === "custom" && !d.repeatDays.length ? [parseDay(d.day).getDay()] : d.repeatDays })}
          options={[
            { value: "none", label: t("لا يتكرّر", "Doesn’t repeat") },
            { value: "daily", label: t("كل يوم", "Every day") },
            { value: "weekdays", label: t("أيام العمل", "Workdays"), title: t("الأحد إلى الخميس", "Sunday to Thursday") },
            { value: "weekly", label: t("كل أسبوع", "Every week") },
            { value: "custom", label: t("مخصّص", "Custom") },
          ]}
        />
        {d.repeat === "custom" && (
          <div className="mt-3">
            <div role="group" aria-label={t("أيام التكرار", "Repeat days")} className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const on = d.repeatDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    aria-label={weekdayLong(i)}
                    title={weekdayLong(i)}
                    onClick={() => set({ repeatDays: on ? d.repeatDays.filter((x) => x !== i) : [...d.repeatDays, i] })}
                    className={cx(
                      "press grid size-9 place-items-center rounded-full border text-xs font-medium transition-colors duration-150 max-md:size-11",
                      on ? "border-ink bg-inverse text-on-inverse" : "border-line text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {weekdayShort(i)}
                  </button>
                );
              })}
            </div>
            {err("days") && (
              <p className="mt-1.5 text-xs text-ember" role="alert">
                {t("اختر يوماً واحداً على الأقل للتكرار", "Choose at least one day to repeat on")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <Label id="c-cat">{t("الفئة", "Category")}</Label>
          <ChoiceChips<Category>
            labelledBy="c-cat"
            value={d.category}
            onChange={(v) => set({ category: v })}
            options={CATEGORIES.map((c) => ({
              value: c,
              label: (
                <>
                  <span className={cx("size-2 rounded-full", TONE[CATEGORY_TONE[c]].dot)} aria-hidden />
                  <span className="max-w-[10rem] truncate">{categoryName(c, labels)}</span>
                </>
              ),
            }))}
          />
        </div>
        <div>
          <Label id="c-pri">{t("الأولوية", "Priority")}</Label>
          <ChoiceChips<Priority> labelledBy="c-pri" value={d.priority} onChange={(v) => set({ priority: v })} options={(["low", "medium", "high"] as const).map((p) => ({ value: p, label: priorityName(p) }))} />
        </div>
      </div>

      <p className="rounded-md bg-sunk px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
        {t(
          "جدولة مرنة: اتركها بلا وقت ثم اسحبها إلى أي ساعة على الجدول. على الجوّال: اضغط عليها مطوّلاً ثم اسحب.",
          "Flexible scheduling: leave it without a time, then drag it to any hour. On a phone, press and hold, then drag.",
        )}
      </p>

      <div className="sticky -bottom-4 z-10 -mx-5 -mb-4 flex items-center justify-end gap-2 border-t border-line bg-sheet px-5 py-3">
        <Button variant="ghost" onClick={onDone}>
          {t("إلغاء", "Cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {d.timed ? t("احجز المهمة", "Book the task") : t("أضف المهمة", "Add the task")}
        </Button>
      </div>
    </form>
  );
}
