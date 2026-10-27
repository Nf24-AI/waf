// إعدادات بومودورو: كل حقل بمداه، والقيمة الخارجة عن المدى لا تُحفظ.

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Field, Input } from "@/ui/Field";
import { POMO_RANGES, type PomoSettings } from "./engine";

type Num = "work" | "short" | "long" | "every";

const FIELDS: { key: Num; ar: string; en: string; unit: [string, string] }[] = [
  { key: "work", ar: "مدة العمل", en: "Focus length", unit: ["دقيقة", "minutes"] },
  { key: "short", ar: "استراحة قصيرة", en: "Short break", unit: ["دقيقة", "minutes"] },
  { key: "long", ar: "استراحة طويلة", en: "Long break", unit: ["دقيقة", "minutes"] },
  { key: "every", ar: "استراحة طويلة بعد كل", en: "Long break after every", unit: ["جلسات", "sessions"] },
];

export function PomodoroDialog({
  open,
  onOpenChange,
  settings,
  running,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: PomoSettings;
  /** بومودورو بدأ: الإعدادات تسري من المرحلة التالية */
  running: boolean;
  onSave: (s: PomoSettings) => void;
}) {
  const [draft, setDraft] = useState<Record<Num, string>>(() => toDraft(settings));
  const [auto, setAuto] = useState(settings.autoBreaks);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(settings));
      setAuto(settings.autoBreaks);
    }
  }, [open, settings]);

  const errors = Object.fromEntries(
    FIELDS.map(({ key }) => {
      const [lo, hi] = POMO_RANGES[key];
      const v = Number(draft[key]);
      return [key, draft[key].trim() === "" || !Number.isInteger(v) || v < lo || v > hi ? t(`من ${lo} إلى ${hi}`, `From ${lo} to ${hi}`) : null];
    }),
  ) as Record<Num, string | null>;
  const valid = Object.values(errors).every((e) => !e);

  const save = () => {
    if (!valid) return;
    onSave({ work: Number(draft.work), short: Number(draft.short), long: Number(draft.long), every: Number(draft.every), autoBreaks: auto });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("إعدادات بومودورو", "Pomodoro settings")}
      description={running ? t("الجلسة الحالية تكمل بمدتها، والإعدادات تسري من المرحلة التالية.", "The current session keeps its length; new settings apply from the next phase.") : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("إلغاء", "Cancel")}
          </Button>
          <Button onClick={save} disabled={!valid}>
            {t("طبّق الإعدادات وأغلق", "Apply and close")}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {FIELDS.map(({ key, ar, en, unit }) => {
          const [lo, hi] = POMO_RANGES[key];
          return (
            <Field key={key} label={t(ar, en)} hint={errors[key] ? undefined : t(unit[0], unit[1])} error={errors[key]}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={lo}
                  max={hi}
                  step={1}
                  dir="ltr"
                  className="tnum h-11 text-start"
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              )}
            </Field>
          );
        })}
        <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-5 accent-[var(--saffron)]" />
          {t("ابدأ الاستراحات تلقائياً", "Start breaks automatically")}
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function toDraft(s: PomoSettings): Record<Num, string> {
  return { work: String(s.work), short: String(s.short), long: String(s.long), every: String(s.every) };
}
