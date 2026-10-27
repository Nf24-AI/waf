// عنوان التركيز: المهمة التي تعمل عليها الآن، تُختار من مهام هذا الإطار المفتوحة.

import * as PO from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Task } from "@/data/types";
import { t } from "@/lib/i18n";
import { cx } from "@/ui/cx";

export function TaskPicker({
  tasks,
  task,
  locked,
  loading,
  onPick,
  onManage,
}: {
  tasks: Task[];
  task: Task | null;
  locked: boolean;
  loading: boolean;
  onPick: (id: string | null) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PO.Root open={open} onOpenChange={setOpen}>
      <PO.Trigger asChild>
        <button
          type="button"
          className={cx(
            "press group inline-flex min-h-11 max-w-full items-center gap-2 rounded-full px-4 text-start transition-colors duration-150",
            task ? "hover:bg-sunk" : "border border-dashed border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink",
          )}
          aria-label={task ? t(`تركّز على: ${task.title}. غيّر المهمة`, `Focusing on: ${task.title}. Change task`) : t("اختر مهمة تركّز عليها", "Choose a task to focus on")}
        >
          {task ? (
            <span className="line-clamp-2 font-display text-lg font-semibold [overflow-wrap:anywhere] sm:text-xl">{task.title}</span>
          ) : (
            <span className="text-sm font-medium">{t("اختر مهمة", "Choose a task")}</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
        </button>
      </PO.Trigger>
      <PO.Portal>
        <PO.Content
          sideOffset={8}
          collisionPadding={12}
          className="focus-pop z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-md border border-line bg-sheet p-1.5 text-sm text-ink shadow-[var(--shadow-float)]"
        >
          {locked ? (
            <p className="px-2.5 py-2 text-ink-2">{t("أنهِ الجلسة الجارية لتغيّر المهمة.", "End the current session to change the task.")}</p>
          ) : loading ? (
            <p className="px-2.5 py-2 text-ink-3">{t("جارٍ التحميل…", "Loading…")}</p>
          ) : tasks.length === 0 ? (
            <div className="px-2.5 py-2">
              <p className="text-ink-2">{t("لا مهام مفتوحة بعد.", "No open tasks yet.")}</p>
              <button type="button" onClick={() => (setOpen(false), onManage())} className="press mt-2 h-10 rounded-sm bg-inverse px-3 text-sm font-medium text-on-inverse">
                {t("أضف مهمة", "Add a task")}
              </button>
            </div>
          ) : (
            <>
              <ul className="scroll-thin max-h-[min(50dvh,22rem)] overflow-y-auto overscroll-contain" role="listbox" aria-label={t("المهام المفتوحة", "Open tasks")}>
                {tasks.map((x) => {
                  const on = x.id === task?.id;
                  return (
                    <li key={x.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => {
                          onPick(on ? null : x.id);
                          setOpen(false);
                        }}
                        className={cx("flex min-h-11 w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-start transition-colors duration-150 hover:bg-sunk", on && "bg-sunk")}
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center">{on && <Check className="size-4 text-saffron-ink" strokeWidth={2} />}</span>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{x.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {task && <p className="px-2.5 pt-1 text-xs text-ink-3">{t("اضغط المهمة المختارة مرة أخرى لإلغاء اختيارها.", "Press the chosen task again to clear it.")}</p>}
              <div className="mt-1 border-t border-line pt-1">
                <button type="button" onClick={() => (setOpen(false), onManage())} className="flex h-10 w-full items-center rounded-sm px-2.5 text-ink-2 hover:bg-sunk hover:text-ink">
                  {t("أدِر قائمة المهام", "Manage the task list")}
                </button>
              </div>
            </>
          )}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}
