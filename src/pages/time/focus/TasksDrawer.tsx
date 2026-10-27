// قائمة المهام: لوح جانبي على الحاسب ولوح سفلي على الجوّال.
// إضافة مهمة لهذا الإطار، وإنجازها، وحذفها (أرشفة).

import * as RD from "@radix-ui/react-dialog";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Task } from "@/data/types";
import { dayOf } from "@/lib/time";
import { t } from "@/lib/i18n";
import { IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Input } from "@/ui/Field";

export function TasksDrawer({
  open,
  onOpenChange,
  tasks,
  loading,
  activeId,
  sessionTaskIds,
  onAdd,
  adding,
  onComplete,
  onDelete,
  onFocus,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tasks: Task[];
  loading: boolean;
  activeId: string | null;
  /** مهام لها جلسة مفتوحة: لا تُحذف */
  sessionTaskIds: Set<string>;
  onAdd: (title: string) => Promise<unknown>;
  adding: boolean;
  onComplete: (task: Task) => void;
  onDelete: (task: Task) => void;
  onFocus: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const today = dayOf();
  const open_ = tasks.filter((x) => !x.completedAt);
  const doneToday = tasks.filter((x) => x.completedAt && dayOf(new Date(x.completedAt)) === today);
  const total = open_.length + doneToday.length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = title.trim();
    if (!v || adding) return;
    try {
      await onAdd(v);
      setTitle("");
    } catch {
      /* الخطأ يظهر في تنبيه */
    }
  };

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="waf-overlay fixed inset-0 z-50 bg-[rgb(8_12_22/0.4)]" />
        <RD.Content className="focus-drawer flex flex-col border-line bg-sheet text-ink shadow-[var(--shadow-float)] focus:outline-none max-sm:border-t sm:border-s pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <header className="flex items-start gap-3 px-5 pt-4 sm:pt-6">
            <div className="min-w-0 flex-1">
              <RD.Title className="font-display text-xl font-semibold">{t("قائمة المهام", "Task list")}</RD.Title>
              <RD.Description className="tnum mt-1 text-sm text-ink-2">
                {total === 0
                  ? t("مهام هذا الإطار فقط.", "Tasks for this framework only.")
                  : t(`أنجزت اليوم ${doneToday.length} من ${total}`, `Done today: ${doneToday.length} of ${total}`)}
              </RD.Description>
            </div>
            <RD.Close asChild>
              <IconButton label={t("إغلاق", "Close")} className="-me-2 -mt-1.5 size-11">
                <X className="size-5" strokeWidth={1.75} />
              </IconButton>
            </RD.Close>
          </header>
          {total > 0 && (
            <div className="mx-5 mt-3 h-0.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full origin-[var(--o)] bg-palm" style={{ transform: `scaleX(${doneToday.length / total})`, ["--o" as string]: document.documentElement.dir === "rtl" ? "right" : "left" }} />
            </div>
          )}

          <form onSubmit={submit} className="flex gap-2 px-5 pt-5">
            <label htmlFor="focus-add" className="sr-only">
              {t("أضف مهمة", "Add a task")}
            </label>
            <Input id="focus-add" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("أضف مهمة", "Add a task")} maxLength={200} enterKeyHint="done" autoComplete="off" className="h-11" />
            <button type="submit" disabled={!title.trim() || adding} className="press inline-flex size-11 shrink-0 items-center justify-center rounded-sm bg-inverse text-on-inverse disabled:opacity-40" aria-label={t("أضف المهمة", "Add the task")}>
              <Plus className="size-5" strokeWidth={1.75} />
            </button>
          </form>

          <div className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
            {loading ? (
              <p className="py-6 text-sm text-ink-3">{t("جارٍ التحميل…", "Loading…")}</p>
            ) : open_.length === 0 && doneToday.length === 0 ? (
              <p className="py-6 text-sm text-ink-2">{t("القائمة فارغة. أضف مهمة في الأعلى لتبدأ.", "The list is empty. Add a task above to begin.")}</p>
            ) : (
              <>
                <ul className="divide-y divide-line border-y border-line">
                  {open_.map((x) => {
                    const active = x.id === activeId;
                    const locked = sessionTaskIds.has(x.id);
                    return (
                      <li key={x.id} className="flex items-center gap-1 py-1">
                        <button
                          type="button"
                          onClick={() => onComplete(x)}
                          className="press group flex size-11 shrink-0 items-center justify-center rounded-sm"
                          aria-label={t(`أنجزتُها: ${x.title}`, `Done: ${x.title}`)}
                        >
                          <span className="flex size-5 items-center justify-center rounded-full border-[1.5px] border-line-strong transition-colors group-hover:border-palm">
                            <Check className="size-3 text-palm opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2.5} />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onFocus(x)}
                          className={cx("min-h-11 min-w-0 flex-1 rounded-sm px-1 py-2 text-start text-sm [overflow-wrap:anywhere] hover:text-ink", active ? "font-medium text-ink" : "text-ink-2")}
                          aria-label={active ? t(`${x.title}، المهمة التي تركّز عليها`, `${x.title}, your current focus`) : t(`ركّز على: ${x.title}`, `Focus on: ${x.title}`)}
                        >
                          {active && <span className="me-2 inline-block size-1.5 -translate-y-0.5 rounded-full bg-saffron align-middle" aria-hidden />}
                          {x.title}
                        </button>
                        <IconButton
                          label={locked ? t("أنهِ الجلسة الجارية لتحذف هذه المهمة", "End the current session to delete this task") : t(`احذف: ${x.title}`, `Delete: ${x.title}`)}
                          disabled={locked}
                          onClick={() => onDelete(x)}
                          className="size-11 text-ink-3 hover:text-ember"
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} />
                        </IconButton>
                      </li>
                    );
                  })}
                </ul>
                {doneToday.length > 0 && (
                  <>
                    <h3 className="mt-6 font-ui text-xs font-medium text-ink-3">{t("أُنجز اليوم", "Done today")}</h3>
                    <ul className="mt-2 space-y-2">
                      {doneToday.map((x) => (
                        <li key={x.id} className="flex items-start gap-3 text-sm text-ink-3">
                          <Check className="mt-1 size-4 shrink-0 text-palm" strokeWidth={2} aria-hidden />
                          <span className="line-through decoration-line-strong [overflow-wrap:anywhere]">{x.title}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
