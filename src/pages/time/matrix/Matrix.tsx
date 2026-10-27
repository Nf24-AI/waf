// مصفوفة أيزنهاور: تكتب المهمة، ثم تضعها في رُبعها بالسحب أو بالضغط.
// تعمل وحدها (origin = "matrix")، أو خطوةً أولى في «نظام واف» (origin = "waf").

import { CalendarPlus, Check, ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { PageHead } from "@/app/AppShell";
import { useTaskActions, useTasks } from "@/data/hooks";
import type { Quadrant, Task, TaskOrigin } from "@/data/types";
import { formatClock, formatDay, t } from "@/lib/i18n";
import { isScheduled } from "@/lib/tasks";
import { dayOf, fromMinutes, minutesOfDay } from "@/lib/time";
import { Button, ButtonLink } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Dialog } from "@/ui/Dialog";
import { Failure, Loading } from "@/ui/States";
import { FlowSteps } from "../FlowSteps";
import { short, TONE, UNDO_MS, type Tone } from "../blocks/meta";
import { useDrag } from "../blocks/useDrag";
import { groupMatrix, parseZone, quadrantAfterDrop, type DropZone } from "./sorting";

const QUAD: Record<Quadrant, { name: [string, string]; sub: [string, string]; tone: Tone }> = {
  do: { name: ["افعل الآن", "Do now"], sub: ["مهم وعاجل", "Important and urgent"], tone: "ember" },
  plan: { name: ["خطّط له", "Plan it"], sub: ["مهم وغير عاجل", "Important, not urgent"], tone: "dusk" },
  delegate: { name: ["فوّض", "Delegate"], sub: ["غير مهم وعاجل", "Urgent, not important"], tone: "saffron" },
  drop: { name: ["احذف", "Drop"], sub: ["غير مهم وغير عاجل", "Neither urgent nor important"], tone: "slate" },
};
const ORDER: Quadrant[] = ["do", "plan", "delegate", "drop"];

export default function Matrix({ origin }: { origin: TaskOrigin }) {
  const query = useTasks(origin);
  const actions = useTaskActions(origin);
  const waf = origin === "waf";
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState(false);
  const [picked, setPicked] = useState<Task | null>(null);
  const [over, setOver] = useState<DropZone | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => groupMatrix(query.data ?? []), [query.data]);
  const total = (query.data ?? []).length;

  const classify = (task: Task, quadrant: Quadrant | null) => {
    if (task.quadrant === quadrant) return;
    actions.update.mutate({ id: task.id, patch: { quadrant } });
  };

  const drag = useDrag<Task>({
    onMove: (s) => {
      const z = parseZone(s.target?.dataset.drop);
      setOver((prev) => (prev === z ? prev : z));
    },
    onDrop: (s) => {
      setOver(null);
      const zone = parseZone(s.target?.dataset.drop);
      if (!zone) return null;
      const next = quadrantAfterDrop(s.item, zone);
      if (next === undefined) return null;
      classify(s.item, next);
      return { settle: `[data-drop="${zone}"] [data-drag-id="${s.id}"]` };
    },
    onEnd: () => setOver(null),
  });

  function add(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) {
      setInputError(true);
      inputRef.current?.focus();
      return;
    }
    setDraft("");
    setInputError(false);
    actions.create.mutate({ title }, { onError: () => setDraft(title) });
    inputRef.current?.focus();
  }

  function complete(task: Task) {
    actions.complete.mutate(task.id);
    toast(t(`أُنجزت «${short(task.title)}»`, `Done: “${short(task.title)}”`), {
      duration: UNDO_MS,
      action: { label: t("تراجع", "Undo"), onClick: () => actions.reopen.mutate(task.id) },
    });
  }

  function remove(task: Task) {
    actions.archive.mutate(task.id);
    toast(t(`حُذفت «${short(task.title)}»`, `Deleted “${short(task.title)}”`), {
      duration: UNDO_MS,
      action: {
        label: t("تراجع", "Undo"),
        onClick: () => actions.restore.mutate(task.id, { onSuccess: () => toast(t("أُعيدت المهمة", "Task restored"), { duration: 2200 }) }),
      },
    });
  }

  const rowProps = (task: Task, zone: DropZone) => ({
    ...drag.bind(task, `m:${task.id}`),
    onClick: () => setPicked(task),
    "aria-haspopup": "dialog" as const,
    "aria-label": t(`${task.title}. اضغط لتختار رُبعها`, `${task.title}. Press to choose its quadrant`),
    className: cx("waf-draggable", drag.activeId === `m:${task.id}` && "waf-drag-source", zone === "inbox" && "press"),
  });

  return (
    <div>
      <FlowSteps origin={origin} />
      <PageHead
        back={{ href: "/time", label: t("الوقت", "Time") }}
        title={waf ? t("صنّف مهامك", "Sort your tasks") : t("مصفوفة أيزنهاور", "Eisenhower matrix")}
        lede={t("ضع كل مهمة حيث تستحق: ما المهم، وما العاجل، وما يمكن أن يُترك.", "Put each task where it belongs: what matters, what’s urgent, and what can go.")}
      />

      <form onSubmit={add} className="flex gap-2" noValidate>
        <label htmlFor="matrix-new" className="sr-only">
          {t("مهمة جديدة", "New task")}
        </label>
        <input
          id="matrix-new"
          dir={draft ? "auto" : undefined}
          ref={inputRef}
          value={draft}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={inputError || undefined}
          aria-describedby={inputError ? "matrix-new-error" : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (inputError) setInputError(false);
          }}
          placeholder={t("اكتب مهمة ثم ضعها في رُبعها…", "Write a task, then place it…")}
          className="h-12 min-w-0 flex-1 rounded-md border border-line bg-sheet px-4 text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/25 aria-[invalid=true]:border-ember"
        />
        <Button type="submit" size="lg" icon={<Plus className="size-[18px]" strokeWidth={1.75} />} className="shrink-0 rounded-md max-sm:px-4" disabled={actions.create.isPending}>
          <span className="max-sm:sr-only">{t("أضف المهمة", "Add task")}</span>
        </Button>
      </form>
      {inputError && (
        <p id="matrix-new-error" role="alert" className="mt-1.5 text-xs text-ember">
          {t("اكتب المهمة أولاً، ثم اضغط «أضف المهمة».", "Write the task first, then press “Add task”.")}
        </p>
      )}

      {query.isPending ? (
        <Loading className="mt-8" />
      ) : query.isError ? (
        <Failure className="mt-8" title={t("تعذّر قراءة المهام.", "Couldn’t read your tasks.")} body={t("تحقّق من الاتصال ثم أعد المحاولة.", "Check your connection and try again.")} onRetry={() => query.refetch()} />
      ) : (
        <>
          {groups.inbox.length > 0 ? (
            <section
              data-drop="inbox"
              aria-labelledby="inbox-title"
              className={cx("mt-5 rounded-md border border-dashed px-3 py-3 transition-colors duration-150 sm:px-4", over === "inbox" ? "border-line-strong bg-sunk" : "border-line")}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id="inbox-title" className="font-ui text-sm font-medium">
                  {t("في انتظار التصنيف", "Waiting to be sorted")} <span className="tnum text-ink-3">{groups.inbox.length}</span>
                </h2>
                <p className="text-xs text-ink-3">
                  <span className="hidden [@media(pointer:fine)]:inline">{t("اسحب كل مهمة إلى رُبعها، أو اضغط عليها لتختار.", "Drag each task to its quadrant, or click it to choose.")}</span>
                  <span className="[@media(pointer:fine)]:hidden">{t("اضغط على المهمة لتختار رُبعها، أو اضغط مطوّلاً ثم اسحب.", "Tap a task to choose its quadrant, or press and hold to drag.")}</span>
                </p>
              </div>
              <ul className="scroll-thin mt-2.5 flex max-h-44 flex-wrap gap-2 overflow-y-auto overscroll-contain p-0.5">
                {groups.inbox.map((task) => (
                  <li key={task.id} className="min-w-0 max-w-full">
                    <button
                      type="button"
                      {...rowProps(task, "inbox")}
                      className={cx(
                        rowProps(task, "inbox").className,
                        "flex min-h-10 max-w-full items-center rounded-sm border border-line bg-sheet px-3 text-start text-sm transition-[border-color,opacity] duration-150 hover:border-line-strong max-md:min-h-11 sm:max-w-[22rem]",
                      )}
                    >
                      <span dir="auto" className="truncate">{task.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : total === 0 ? (
            <div className="mt-5 border-s-2 border-saffron ps-4">
              <p className="text-base font-semibold">{t("ابدأ بما في رأسك.", "Start with what’s on your mind.")}</p>
              <p className="mt-1 max-w-prose text-sm text-ink-2">
                {t("اكتب كل ما عليك، مهمةً بعد مهمة، ثم ضع كل واحدة في رُبعها.", "Write down everything on your plate, one task at a time, then put each one in its quadrant.")}
              </p>
            </div>
          ) : null}

          {/* ───── المصفوفة ───── */}
          <div className="mt-6 grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[1.75rem_minmax(0,1fr)] sm:gap-x-3">
            <div />
            <div className="grid grid-cols-2 pb-2 text-center text-xs font-medium text-ink-2" aria-hidden>
              <span>{t("العاجل", "Urgent")}</span>
              <span>{t("غير العاجل", "Not urgent")}</span>
            </div>
            <div className="grid grid-rows-2 text-xs font-medium text-ink-2" aria-hidden>
              <span className="grid place-items-center">
                <span className="rotate-180 [writing-mode:vertical-rl]">{t("المهم", "Important")}</span>
              </span>
              <span className="grid place-items-center">
                <span className="rotate-180 [writing-mode:vertical-rl]">{t("غير المهم", "Not important")}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 grid-rows-[1fr_1fr] overflow-hidden rounded-lg border border-line bg-sheet">
              {ORDER.map((q, i) => (
                <QuadrantCell
                  key={q}
                  q={q}
                  index={i}
                  tasks={groups.quads[q]}
                  over={over === q}
                  waf={waf}
                  row={(task) => rowProps(task, q)}
                />
              ))}
            </div>
          </div>

          {waf && (groups.quads.do.length > 0 || groups.quads.plan.length > 0) && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-sm text-ink-2">{t("المهم أمامك الآن. أعطِ كل مهمة ساعتها على جدول اليوم.", "What matters is in front of you. Give each task its hour on today’s schedule.")}</p>
              <ButtonLink href="/waf/blocks" variant="quiet" icon={<CalendarPlus className="size-4" strokeWidth={1.75} />}>
                {t("انتقل إلى الحجز", "Go to booking")}
              </ButtonLink>
            </div>
          )}

          {groups.done.length > 0 && (
            <section className="mt-8 border-t border-line pt-3" aria-labelledby="done-title">
              <button
                type="button"
                id="done-title"
                aria-expanded={showDone}
                aria-controls="done-list"
                onClick={() => setShowDone((v) => !v)}
                className="press -ms-2 inline-flex h-10 items-center gap-2 rounded-sm px-2 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink"
              >
                <ChevronDown className={cx("size-4 transition-transform duration-200", !showDone && "ltr:-rotate-90 rtl:rotate-90")} strokeWidth={1.75} />
                {t("أُنجزت", "Done")}
                <span className="tnum text-ink-3">{groups.done.length}</span>
              </button>
              {showDone && (
                <ul id="done-list" className="mt-1 divide-y divide-line">
                  {groups.done.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 py-2">
                      <Check className="size-4 shrink-0 text-palm" strokeWidth={2} aria-hidden />
                      <span dir="auto" className="min-w-0 flex-1 text-start text-sm text-ink-3 line-through decoration-line-strong [overflow-wrap:anywhere]">{task.title}</span>
                      {task.quadrant && (
                        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-3 sm:inline-flex">
                          <span className={cx("size-1.5 rounded-full", TONE[QUAD[task.quadrant].tone].dot)} />
                          {t(...QUAD[task.quadrant].name)}
                        </span>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => actions.reopen.mutate(task.id)} icon={<RotateCcw className="size-3.5" strokeWidth={1.75} />} className="max-md:h-11">
                        {t("أعِدها", "Reopen")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <PlaceDialog
        task={picked}
        onClose={() => setPicked(null)}
        onPlace={(task, q) => {
          classify(task, q);
          setPicked(null);
        }}
        onComplete={(task) => {
          setPicked(null);
          complete(task);
        }}
        onDelete={(task) => {
          setPicked(null);
          remove(task);
        }}
      />
    </div>
  );
}

type RowProps = ReturnType<ReturnType<typeof useDrag<Task>>["bind"]> & {
  onClick: () => void;
  "aria-haspopup": "dialog";
  "aria-label": string;
  className: string;
};

function QuadrantCell({ q, index, tasks, over, waf, row }: { q: Quadrant; index: number; tasks: Task[]; over: boolean; waf: boolean; row: (t: Task) => RowProps }) {
  const meta = QUAD[q];
  const tone = TONE[meta.tone];
  const id = `quad-${q}`;
  const handoff = waf && (q === "do" || q === "plan");
  return (
    <section
      data-drop={q}
      aria-labelledby={id}
      className={cx(
        "relative flex min-h-[10rem] min-w-0 flex-col px-2.5 pb-2 pt-3 transition-colors duration-150 sm:min-h-[13rem] sm:px-4 sm:pb-3 sm:pt-4",
        index % 2 === 0 && "border-e border-line",
        index < 2 && "border-b border-line",
        over && cx(tone.wash, "ring-2 ring-inset", tone.ring),
      )}
    >
      <header className="flex items-start gap-2">
        <span className={cx("mt-[0.55rem] size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id={id} className="font-ui text-[0.9375rem] font-semibold sm:text-base">
            {t(...meta.name)}
          </h2>
          <p className="text-2xs text-ink-3 sm:text-xs">{t(...meta.sub)}</p>
        </div>
        <span className="tnum font-display text-xl leading-none text-ink-3 sm:text-2xl" aria-label={t(`${tasks.length} مهام`, `${tasks.length} tasks`)}>
          {tasks.length}
        </span>
      </header>

      {tasks.length ? (
        <ul className="scroll-thin -mx-1 mt-2 max-h-[17rem] overflow-y-auto overscroll-contain sm:mt-3 sm:max-h-[19rem]">
          {tasks.map((task) => {
            const p = row(task);
            const booked = isScheduled(task) ? task : null;
            return (
              <li key={task.id} className="flex items-center gap-1 border-t border-line/70 first:border-t-0">
                <button
                  type="button"
                  {...p}
                  className={cx(
                    p.className,
                    "flex min-h-10 min-w-0 flex-1 items-center rounded-sm px-1.5 py-1.5 text-start text-xs leading-snug transition-[background-color,opacity] duration-150 hover:bg-sunk active:bg-sunk max-md:min-h-11 sm:text-sm",
                  )}
                >
                  <span dir="auto" className="line-clamp-3 text-start [overflow-wrap:anywhere] sm:line-clamp-2">{task.title}</span>
                </button>
                {handoff &&
                  (booked ? (
                    <span className="tnum hidden shrink-0 px-1 text-2xs text-ink-3 sm:inline" title={t("محجوزة", "Booked")}>
                      {bookedLabel(booked.startsAt)}
                    </span>
                  ) : (
                    <Link
                      href={`/waf/blocks?task=${task.id}`}
                      data-no-drag
                      className="press inline-flex size-11 shrink-0 items-center justify-center gap-1 rounded-sm text-xs font-medium text-dusk hover:bg-dusk-wash sm:h-8 sm:w-auto sm:px-2"
                      aria-label={t(`احجز وقتاً لـ«${short(task.title)}»`, `Book time for “${short(task.title)}”`)}
                    >
                      <CalendarPlus className="size-4" strokeWidth={1.75} />
                      <span className="hidden whitespace-nowrap lg:inline">{t("احجز وقتاً", "Book time")}</span>
                    </Link>
                  ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-auto pt-6 text-xs text-ink-3 sm:text-sm">{t("لا مهام هنا", "Nothing here")}</p>
      )}
    </section>
  );
}

function bookedLabel(iso: string): string {
  const time = formatClock(fromMinutes(minutesOfDay(iso)));
  const day = dayOf(new Date(iso));
  return day === dayOf() ? time : `${formatDay(day, { weekday: "short" })} ${time}`;
}

function PlaceDialog({
  task,
  onClose,
  onPlace,
  onComplete,
  onDelete,
}: {
  task: Task | null;
  onClose: () => void;
  onPlace: (task: Task, q: Quadrant) => void;
  onComplete: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  // يبقى آخر عنوان ظاهراً أثناء حركة الإغلاق
  const last = useRef<Task | null>(null);
  if (task) last.current = task;
  const shown = task ?? last.current;
  return (
    <Dialog
      open={!!task}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={shown ? t(`أين تضع «${short(shown.title, 48)}»؟`, `Where does “${short(shown.title, 48)}” go?`) : ""}
      footer={
        shown && (
          <>
            <Button variant="ghost" size="md" onClick={() => onDelete(shown)} className="me-auto text-ember hover:bg-ember-wash hover:text-ember" icon={<Trash2 className="size-4" strokeWidth={1.75} />}>
              {t("حذف", "Delete")}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant="solid" onClick={() => onComplete(shown)} icon={<Check className="size-4" strokeWidth={2} />}>
              {t("أنجزتُها", "Mark done")}
            </Button>
          </>
        )
      }
    >
      {shown && (
        <div role="radiogroup" aria-label={t("الأرباع", "Quadrants")} className="grid grid-cols-2 gap-2">
          {ORDER.map((q, i) => {
            const meta = QUAD[q];
            const on = shown.quadrant === q;
            return (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={on}
                autoFocus={shown.quadrant ? on : i === 0}
                onClick={() => onPlace(shown, q)}
                className={cx(
                  "press flex min-h-[4.5rem] flex-col items-start justify-between gap-2 rounded-md border p-3 text-start transition-colors duration-150",
                  on ? cx("border-transparent ring-2", TONE[meta.tone].ring, TONE[meta.tone].wash) : "border-line hover:border-line-strong hover:bg-sunk",
                )}
              >
                <span className={cx("size-2 rounded-full", TONE[meta.tone].dot)} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold leading-tight">{t(...meta.name)}</span>
                  <span className="block text-2xs text-ink-3">{t(...meta.sub)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
