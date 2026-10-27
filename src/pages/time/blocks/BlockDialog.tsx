// نافذة الحجز: تعديل العنوان والوقت والفئة، وأفعاله: أنجزتُها، إلغاء الحجز، حذف.
// داخل «نظام واف» يظهر فيها «ابدأ التركيز» على المهمة نفسها.

import { AlertTriangle, CalendarX2, Check, Play, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { Category, Task, TaskPatch } from "@/data/types";
import { formatDay, t, useLang } from "@/lib/i18n";
import { firstFreeSlot, isOpen } from "@/lib/tasks";
import { dayOf, formatDuration, fromMinutes, minutesOfDay, parseDay } from "@/lib/time";
import { Button, ButtonLink } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Dialog } from "@/ui/Dialog";
import { control } from "@/ui/Field";
import { ChoiceChips } from "./Composer";
import { checkDraft, endText, type Draft } from "./draft";
import { categoryName, CATEGORY_TONE, short, TONE, type Labels } from "./meta";
import { clock } from "./Timeline";
import { CATEGORIES, DAY_TO, isoAt } from "./schedule";

export function BlockDialog({
  task,
  onClose,
  tasks,
  hour12,
  labels,
  waf,
  onSave,
  onComplete,
  onReopen,
  onUnschedule,
  onDelete,
}: {
  task: Task | null;
  onClose: () => void;
  tasks: Task[];
  hour12: boolean;
  labels: Labels;
  waf: boolean;
  onSave: (task: Task, patch: TaskPatch) => Promise<unknown>;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onUnschedule: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const last = useRef<Task | null>(null);
  if (task) last.current = task;
  const shown = task ?? last.current;
  return (
    <Dialog
      open={!!task}
      onOpenChange={(o) => !o && onClose()}
      title={shown && !isOpen(shown) ? t("حجز منجز", "Finished block") : t("تعديل حجز", "Edit block")}
      description={shown?.startsAt ? formatDay(dayOf(new Date(shown.startsAt))) : undefined}
      size="md"
    >
      {task && (
        <BlockForm
          key={task.id}
          task={task}
          tasks={tasks}
          hour12={hour12}
          labels={labels}
          waf={waf}
          onSave={onSave}
          onClose={onClose}
          onComplete={onComplete}
          onReopen={onReopen}
          onUnschedule={onUnschedule}
          onDelete={onDelete}
        />
      )}
    </Dialog>
  );
}

function BlockForm({
  task,
  tasks,
  hour12,
  labels,
  waf,
  onSave,
  onClose,
  onComplete,
  onReopen,
  onUnschedule,
  onDelete,
}: {
  task: Task;
  tasks: Task[];
  hour12: boolean;
  labels: Labels;
  waf: boolean;
  onSave: (task: Task, patch: TaskPatch) => Promise<unknown>;
  onClose: () => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onUnschedule: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const lang = useLang();
  const day = dayOf(new Date(task.startsAt!));
  const startMin = minutesOfDay(task.startsAt!);
  const len = Math.round((Date.parse(task.endsAt!) - Date.parse(task.startsAt!)) / 60_000);
  const [d, setD] = useState<Draft>({
    title: task.title,
    timed: true,
    day,
    start: fromMinutes(startMin),
    end: endText(Math.min(DAY_TO, startMin + len)),
    duration: 30,
    customText: "",
    repeat: task.repeatRule,
    repeatDays: task.repeatDays,
    category: task.category,
    priority: task.priority,
  });
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const open = isOpen(task);
  // العنوان الفارغ يُحفظ «حجز جديد»
  const check = useMemo(() => checkDraft({ ...d, title: d.title.trim() || "x" }, tasks, task.id), [d, tasks, task.id]);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(check.errors).length || check.startMin === null || check.endMin === null) return;
    setSaving(true);
    try {
      await onSave(task, {
        title: d.title.trim() || t("حجز جديد", "New block"),
        category: d.category,
        startsAt: isoAt(day, check.startMin),
        endsAt: isoAt(day, check.endMin),
        estimateMinutes: check.endMin - check.startMin,
      });
      onClose();
    } catch {
      /* يظهر الخطأ في تنبيه */
    } finally {
      setSaving(false);
    }
  }

  function firstFree() {
    const length = check.length ?? len;
    const s = firstFreeSlot(tasks, parseDay(day), check.startMin ?? startMin, length, task.id);
    if (s !== null) set({ start: fromMinutes(s), end: endText(Math.min(DAY_TO, s + length)) });
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="b-title" className="mb-2 block text-xs font-medium text-ink-2">
          {t("ماذا ستفعل؟", "What will you do?")}
        </label>
        <input id="b-title" dir={d.title ? "auto" : undefined} value={d.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder={t("حجز جديد", "New block")} className={cx(control, "h-11")} disabled={!open} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="b-start" className="mb-1.5 block text-xs font-medium text-ink-2">
            {t("يبدأ", "Starts")}
          </label>
          <input
            id="b-start"
            type="time"
            step={300}
            value={d.start}
            disabled={!open}
            onChange={(e) => {
              const v = e.target.value;
              const l = check.length ?? len;
              if (/^\d\d:\d\d$/.test(v)) {
                const [h, m] = v.split(":").map(Number);
                set({ start: v, end: endText(Math.min(DAY_TO, h * 60 + m + l)) });
              } else set({ start: v });
            }}
            className={cx(control, "tnum h-10")}
          />
        </div>
        <div>
          <label htmlFor="b-end" className="mb-1.5 block text-xs font-medium text-ink-2">
            {t("ينتهي", "Ends")}
          </label>
          <input id="b-end" type="time" step={300} value={d.end} disabled={!open} aria-invalid={(tried && !!check.errors.end) || undefined} onChange={(e) => set({ end: e.target.value })} className={cx(control, "tnum h-10")} />
        </div>
      </div>
      <div aria-live="polite" className="-mt-2 text-xs">
        {check.errors.end || check.errors.start ? (
          <p className="text-ember">{t("وقت الانتهاء يجب أن يلي البداية بخمس دقائق على الأقل.", "The end must be at least 5 minutes after the start.")}</p>
        ) : check.clash && open ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ember" role="alert">
            <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />
            {t(`يتعارض مع «${short(check.clash.title)}».`, `Clashes with “${short(check.clash.title)}”.`)}
            <button type="button" onClick={firstFree} className="press rounded-sm font-medium text-dusk underline decoration-dusk/40 underline-offset-4">
              {t("أول وقت فارغ", "First free slot")}
            </button>
          </p>
        ) : (
          check.startMin !== null &&
          check.endMin !== null && (
            <p className="tnum text-ink-2">
              {clock(check.startMin, hour12)} – {clock(check.endMin, hour12)}
              <span className="ms-2 text-ink-3">{formatDuration(check.endMin - check.startMin, lang)}</span>
            </p>
          )
        )}
      </div>

      <div>
        <p id="b-cat" className="mb-2 text-xs font-medium text-ink-2">
          {t("الفئة", "Category")}
        </p>
        <ChoiceChips<Category>
          labelledBy="b-cat"
          value={d.category}
          onChange={(v) => open && set({ category: v })}
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

      {waf && open && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3.5 py-3">
          <p className="text-sm text-ink-2">{t("حان وقتها؟ اعمل عليها حتى تُنجَز.", "Is it time? Work on it until it’s done.")}</p>
          <ButtonLink href={`/waf/focus?task=${task.id}`} variant="saffron" size="sm" icon={<Play className="size-4" strokeWidth={1.75} />}>
            {t("ابدأ التركيز", "Start focus")}
          </ButtonLink>
        </div>
      )}

      <div className="sticky -bottom-4 z-10 -mx-5 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-sheet px-5 py-3">
        {open ? (
          <>
            <Button variant="ghost" size="sm" className="max-md:h-11" onClick={() => onComplete(task)} icon={<Check className="size-4" strokeWidth={2} />}>
              {t("أنجزتُها", "Mark done")}
            </Button>
            <Button variant="ghost" size="sm" className="max-md:h-11" onClick={() => onUnschedule(task)} icon={<CalendarX2 className="size-4" strokeWidth={1.75} />}>
              {t("إلغاء الحجز", "Unbook")}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" className="max-md:h-11" onClick={() => onReopen(task)} icon={<RotateCcw className="size-4" strokeWidth={1.75} />}>
            {t("أعِدها", "Reopen")}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-ember hover:bg-ember-wash hover:text-ember max-md:h-11" onClick={() => onDelete(task)} icon={<Trash2 className="size-4" strokeWidth={1.75} />}>
          {t("حذف", "Delete")}
        </Button>
        {open && (
          <Button type="submit" className="ms-auto" disabled={saving}>
            {t("احفظ الحجز", "Save block")}
          </Button>
        )}
      </div>
    </form>
  );
}
