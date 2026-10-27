// قائمة المهام بجانب الجدول: غير المحجوزة أولاً، تُسحب إلى ساعتها أو تُحجز في أول وقت فارغ.

import { CalendarPlus, Check, Flag, Play, Plus, Repeat, Trash2 } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Task } from "@/data/types";
import { formatDay, t, useLang } from "@/lib/i18n";
import { isOpen, isScheduled, lengthOf } from "@/lib/tasks";
import { dayOf, formatDuration, minutesOfDay } from "@/lib/time";
import { Link } from "wouter";
import { Button, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { categoryName, CATEGORY_TONE, repeatName, TONE, type Labels } from "./meta";
import { clock } from "./Timeline";
import type { TaskFilter } from "./schedule";

const FILTERS: { value: TaskFilter; ar: string; en: string }[] = [
  { value: "all", ar: "الكل", en: "All" },
  { value: "unscheduled", ar: "بلا وقت", en: "No time" },
  { value: "work", ar: "العمل", en: "Work" },
  { value: "personal", ar: "شخصي", en: "Personal" },
  { value: "meetings", ar: "اجتماعات", en: "Meetings" },
];

type Bind = (task: Task, id: string) => { "data-drag-id": string; onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void };

export function TaskList({
  tasks,
  totalOpen,
  filter,
  onFilter,
  hour12,
  labels,
  today,
  waf,
  highlightId,
  activeId,
  bind,
  onNew,
  onBook,
  onOpen,
  onComplete,
  onReopen,
  onDelete,
  className,
}: {
  tasks: Task[];
  totalOpen: number;
  filter: TaskFilter;
  onFilter: (f: TaskFilter) => void;
  hour12: boolean;
  labels: Labels;
  today: string;
  waf: boolean;
  highlightId: string | null;
  activeId: string | null;
  bind: Bind | null;
  onNew: () => void;
  onBook: (task: Task) => void;
  onOpen: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onDelete: (task: Task) => void;
  className?: string;
}) {
  const lang = useLang();
  return (
    <div className={cx("flex min-h-0 flex-col", className)}>
      <div role="radiogroup" aria-label={t("عرض المهام", "Show tasks")} className="flex flex-wrap gap-1.5 pb-3">
        {FILTERS.map((f) => {
          const on = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onFilter(f.value)}
              className={cx(
                "press h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors duration-150 max-md:h-10",
                on ? "border-ink bg-inverse text-on-inverse" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {t(f.ar, f.en)}
            </button>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        totalOpen === 0 && filter === "all" ? (
          <div className="py-6">
            <p className="font-medium">{t("لا مهام بعد.", "No tasks yet.")}</p>
            <p className="mt-1 text-sm text-ink-2">{t("أضف أول مهمة، ثم اسحبها إلى ساعتها على الجدول.", "Add your first task, then drag it to its hour on the schedule.")}</p>
            <Button variant="quiet" size="sm" className="mt-3" onClick={onNew} icon={<Plus className="size-4" strokeWidth={1.75} />}>
              {t("أضف مهمة", "Add a task")}
            </Button>
          </div>
        ) : (
          <p className="py-6 text-sm text-ink-3">{t("لا مهام في هذا العرض.", "No tasks in this view.")}</p>
        )
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {tasks.map((task) => {
            const open = isOpen(task);
            const scheduled = isScheduled(task);
            const tone = TONE[CATEGORY_TONE[task.category]];
            const dragId = `r:${task.id}`;
            const drag = open && bind ? bind(task, dragId) : null;
            let when: string | null = null;
            if (scheduled) {
              const d = dayOf(new Date(task.startsAt!));
              const time = clock(minutesOfDay(task.startsAt!), hour12);
              when = d === today ? time : `${formatDay(d, { weekday: "short", day: "numeric" })} ${time}`;
            }
            return (
              <li
                key={task.id}
                {...(drag ?? {})}
                onDoubleClick={open && !scheduled ? () => onBook(task) : undefined}
                className={cx(
                  "group relative flex items-start gap-1 rounded-sm px-1 py-1.5 transition-[background-color,opacity] duration-150",
                  drag && "waf-draggable",
                  activeId === dragId && "waf-drag-source",
                  highlightId === task.id && "bg-saffron-wash/60",
                )}
              >
                <button
                  type="button"
                  data-no-drag
                  onClick={() => (open ? onComplete(task) : onReopen(task))}
                  aria-label={open ? t(`أنجزتُها: ${task.title}`, `Mark done: ${task.title}`) : t(`أعِدها: ${task.title}`, `Reopen: ${task.title}`)}
                  aria-pressed={!open}
                  className="press grid size-10 shrink-0 place-items-center rounded-sm max-md:size-11"
                >
                  <span className={cx("grid size-[18px] place-items-center rounded-full border-[1.5px] transition-colors duration-150", open ? "border-line-strong group-hover:border-ink-3" : "border-palm bg-palm text-sheet")}>
                    {!open && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
                <div className="min-w-0 flex-1 py-1.5">
                  <p className={cx("flex items-start gap-1.5 text-sm leading-snug", !open && "text-ink-3 line-through decoration-line-strong")}>
                    {scheduled && open ? (
                      <button type="button" data-no-drag onClick={() => onOpen(task)} className="min-w-0 text-start [overflow-wrap:anywhere] hover:underline hover:decoration-line-strong hover:underline-offset-4">
                        <span dir="auto" className="line-clamp-2 text-start">{task.title}</span>
                      </button>
                    ) : (
                      <span dir="auto" className="line-clamp-2 min-w-0 text-start [overflow-wrap:anywhere]">{task.title}</span>
                    )}
                    {task.priority === "high" && open && <Flag className="mt-[3px] size-3.5 shrink-0 text-ember" strokeWidth={2} aria-label={t("أولوية عالية", "High priority")} />}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cx("size-1.5 rounded-full", tone.dot)} aria-hidden />
                      {categoryName(task.category, labels)}
                    </span>
                    <span className="tnum">{formatDuration(lengthOf(task), lang)}</span>
                    {task.repeatRule && (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="size-3" strokeWidth={2} aria-hidden />
                        {repeatName(task.repeatRule)}
                      </span>
                    )}
                    {when && <span className="tnum text-ink-2">{when}</span>}
                    {!open && <span className="text-palm">{t("أُنجزت", "Done")}</span>}
                  </p>
                </div>
                {open && (
                  <div className="flex shrink-0 items-center" data-no-drag>
                    {!scheduled && (
                      <IconButton label={t(`احجز أول وقت فارغ: ${task.title}`, `Book the first free slot: ${task.title}`)} size="sm" onClick={() => onBook(task)} className="max-md:size-11">
                        <CalendarPlus className="size-4" strokeWidth={1.75} />
                      </IconButton>
                    )}
                    {scheduled && waf && (
                      <Link
                        href={`/waf/focus?task=${task.id}`}
                        aria-label={t(`ابدأ التركيز: ${task.title}`, `Start focus: ${task.title}`)}
                        title={t("ابدأ التركيز", "Start focus")}
                        className="press inline-flex size-8 items-center justify-center rounded-sm text-saffron-ink hover:bg-saffron-wash max-md:size-11"
                      >
                        <Play className="size-4" strokeWidth={1.75} />
                      </Link>
                    )}
                    <IconButton label={t(`حذف: ${task.title}`, `Delete: ${task.title}`)} size="sm" onClick={() => onDelete(task)} className="text-ink-3 hover:text-ember max-md:size-11">
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
