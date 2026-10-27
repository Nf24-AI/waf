// العمود الجانبي: أسبوع مصغّر، توزيع الفئات (مع التمييز وتسمية الفئات)، صيغة الوقت، وإضافة سريعة.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Category } from "@/data/types";
import { formatDay, t, useLang } from "@/lib/i18n";
import { addDays, formatDuration, parseDay } from "@/lib/time";
import { Button, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Segmented } from "@/ui/Field";
import type { ComposerPreset } from "./Composer";
import { categoryName, CATEGORY_TONE, defaultCategoryName, TONE, weekdayLong, weekdayShort, type Labels } from "./meta";
import { CATEGORIES, weekOf } from "./schedule";

export function WeekStrip({ day, today, busy, onPick }: { day: string; today: string; busy: Set<string>; onPick: (d: string) => void }) {
  const week = weekOf(day);
  const first = parseDay(week[0]);
  const last = parseDay(week[6]);
  const month =
    first.getMonth() === last.getMonth()
      ? formatDay(first, { month: "long", year: "numeric" })
      : `${formatDay(first, { month: "short" })} – ${formatDay(last, { month: "short", year: "numeric" })}`;
  return (
    <section aria-labelledby="week-title">
      <div className="flex items-center gap-1">
        <h2 id="week-title" className="min-w-0 flex-1 font-ui text-sm font-semibold">
          {month}
        </h2>
        <IconButton label={t("الأسبوع السابق", "Previous week")} size="sm" onClick={() => onPick(addDays(day, -7))} className="max-md:size-11">
          <ChevronLeft className="size-4 rtl:rotate-180" strokeWidth={1.75} />
        </IconButton>
        <IconButton label={t("الأسبوع التالي", "Next week")} size="sm" onClick={() => onPick(addDays(day, 7))} className="max-md:size-11">
          <ChevronRight className="size-4 rtl:rotate-180" strokeWidth={1.75} />
        </IconButton>
      </div>
      <ol className="mt-2 grid grid-cols-7 gap-0.5">
        {week.map((d, i) => {
          const on = d === day;
          const isToday = d === today;
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => onPick(d)}
                aria-current={on ? "date" : undefined}
                aria-label={`${weekdayLong(i)} ${formatDay(d, { day: "numeric", month: "long" })}${isToday ? t("، اليوم", ", today") : ""}${busy.has(d) ? t("، فيه حجوزات", ", has blocks") : ""}`}
                className={cx(
                  "press relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-sm transition-colors duration-150",
                  on ? "bg-inverse text-on-inverse" : "hover:bg-sunk",
                )}
              >
                <span className={cx("text-[11px] leading-none", on ? "text-on-inverse/70" : "text-ink-3")}>{weekdayShort(i)}</span>
                <span className={cx("tnum text-sm font-medium leading-tight", !on && isToday && "text-saffron-ink font-semibold")}>{parseDay(d).getDate()}</span>
                <span className={cx("absolute bottom-1.5 size-1 rounded-full", busy.has(d) ? (on ? "bg-on-inverse/70" : isToday ? "bg-saffron" : "bg-ink-3") : "bg-transparent")} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CategoryPanel({
  minutes,
  labels,
  spotlight,
  onSpotlight,
  onSaveLabels,
}: {
  minutes: Record<Category, number>;
  labels: Labels;
  spotlight: Category | null;
  onSpotlight: (c: Category | null) => void;
  onSaveLabels: (labels: Labels) => Promise<void>;
}) {
  const lang = useLang();
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState<Labels>(labels);
  const total = CATEGORIES.reduce((s, c) => s + minutes[c], 0);
  const shown = CATEGORIES.filter((c) => c !== "other" || minutes.other > 0 || editing);

  return (
    <section aria-labelledby="cat-title">
      <div className="flex items-center gap-2">
        <h2 id="cat-title" className="min-w-0 flex-1 font-ui text-sm font-semibold">
          {t("الفئات", "Categories")}
        </h2>
        {editing ? (
          <Button
            size="sm"
            variant="solid"
            className="max-md:h-11"
            onClick={async () => {
              await onSaveLabels(names);
              setEditing(false);
            }}
          >
            {t("تم", "Done")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="max-md:h-11"
            onClick={() => {
              setNames(labels);
              setEditing(true);
            }}
          >
            {t("تعديل", "Edit")}
          </Button>
        )}
      </div>

      {editing ? (
        <ul className="mt-2 flex flex-col gap-2">
          {CATEGORIES.map((c) => (
            <li key={c} className="flex items-center gap-2.5">
              <span className={cx("size-2 shrink-0 rounded-full", TONE[CATEGORY_TONE[c]].dot)} aria-hidden />
              <input
                value={names[c] ?? ""}
                maxLength={24}
                placeholder={defaultCategoryName(c)}
                aria-label={t(`اسم فئة «${defaultCategoryName(c)}»`, `Name for “${defaultCategoryName(c)}”`)}
                onChange={(e) => setNames((n) => ({ ...n, [c]: e.target.value }))}
                className="h-9 min-w-0 flex-1 rounded-sm border border-line bg-sheet px-2.5 text-sm placeholder:text-ink-3 focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/25 max-md:h-11"
              />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="mt-1.5 flex flex-col">
            {shown.map((c) => {
              const tone = TONE[CATEGORY_TONE[c]];
              const pct = total ? Math.round((minutes[c] / total) * 100) : 0;
              const on = spotlight === c;
              return (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onSpotlight(on ? null : c)}
                    className={cx(
                      "press -mx-2 flex w-[calc(100%+1rem)] flex-col gap-1.5 rounded-sm px-2 py-2 text-start transition-[background-color,opacity] duration-150 hover:bg-sunk max-md:py-2.5",
                      spotlight && !on && "opacity-45",
                      on && "bg-sunk",
                    )}
                  >
                    <span className="flex w-full items-center gap-2 text-sm">
                      <span className={cx("size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{categoryName(c, labels)}</span>
                      <span className="tnum text-xs text-ink-2">{minutes[c] ? formatDuration(minutes[c], lang) : "—"}</span>
                      <span className="tnum w-9 text-end text-xs text-ink-3">{pct}%</span>
                    </span>
                    <span className="block h-1 w-full overflow-hidden rounded-full bg-sunk" aria-hidden>
                      <span className={cx("block h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-ink-3">
            {spotlight ? t("اضغط الفئة مرة أخرى لإظهار الكل.", "Press the category again to show all.") : t("اضغط فئة لتمييز حجوزاتها في الجدول.", "Press a category to spotlight its blocks.")}
          </p>
        </>
      )}
    </section>
  );
}

export function FormatSwitch({ hour12, onChange }: { hour12: boolean; onChange: (h12: boolean) => void }) {
  return (
    <section className="flex items-center justify-between gap-3">
      <h2 className="font-ui text-sm font-semibold">{t("صيغة الوقت", "Time format")}</h2>
      <Segmented
        size="sm"
        label={t("صيغة الوقت", "Time format")}
        value={hour12 ? "12" : "24"}
        onChange={(v) => onChange(v === "12")}
        options={[
          { value: "12", label: t("12 ساعة", "12-hour"), title: t("ص / م", "AM / PM") },
          { value: "24", label: t("24 ساعة", "24-hour") },
        ]}
      />
    </section>
  );
}

const QUICK: { ar: string; en: string; title: [string, string]; category: Category; length: number }[] = [
  { ar: "عمل عميق", en: "Deep work", title: ["عمل عميق", "Deep work"], category: "deep", length: 90 },
  { ar: "اجتماع", en: "Meeting", title: ["اجتماع", "Meeting"], category: "meeting", length: 60 },
  { ar: "شخصي", en: "Personal", title: ["", ""], category: "personal", length: 30 },
  { ar: "غداء", en: "Lunch", title: ["غداء", "Lunch"], category: "personal", length: 45 },
  { ar: "استراحة", en: "Break", title: ["استراحة", "Break"], category: "personal", length: 15 },
  { ar: "أخرى", en: "Other", title: ["", ""], category: "other", length: 30 },
];

export function QuickAdd({ onPick }: { onPick: (p: ComposerPreset) => void }) {
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="font-ui text-sm font-semibold">
        {t("إضافة سريعة", "Quick add")}
      </h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q.en}
            type="button"
            onClick={() => onPick({ title: t(...q.title), category: q.category, length: q.length, timed: true })}
            className="press inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-ink-2 transition-colors duration-150 hover:border-line-strong hover:text-ink max-md:h-10"
          >
            <span className={cx("size-1.5 rounded-full", TONE[CATEGORY_TONE[q.category]].dot)} aria-hidden />
            {t(q.ar, q.en)}
          </button>
        ))}
      </div>
    </section>
  );
}
