// حجز الوقت: لكل مهمة ساعتها على جدول اليوم. الحجز هو المهمة نفسها ببداية ونهاية.
// يعمل وحده (origin = "blocks")، أو خطوةً ثانية في «نظام واف» (origin = "waf").

import { ChevronLeft, ChevronRight, ListTodo, Plus } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSearch } from "wouter";
import { PageHead } from "@/app/AppShell";
import { toastError, useTaskActions, useTasks } from "@/data/hooks";
import type { Category, Task, TaskInput, TaskOrigin, TaskPatch } from "@/data/types";
import { demoMeta, saveAccountMeta, useAuth } from "@/lib/auth";
import { formatDay, getLang, isRtl, t, useLang } from "@/lib/i18n";
import { isOpen, isScheduled, lengthOf } from "@/lib/tasks";
import { addDays, dayOf, formatDuration } from "@/lib/time";
import { Button, IconButton } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { useNow } from "@/ui/DayLine";
import { Dialog } from "@/ui/Dialog";
import { Failure, Skeleton } from "@/ui/States";
import { FlowSteps } from "../FlowSteps";
import { BlockDialog } from "./BlockDialog";
import { Composer, type ComposerPreset } from "./Composer";
import { CATEGORY_TONE, defaultCategoryName, readLabels, short, TONE, UNDO_MS, type Labels } from "./meta";
import { CategoryPanel, FormatSwitch, QuickAdd, WeekStrip } from "./SidePanel";
import { TaskList } from "./TaskList";
import { clock, Timeline, TOP_PAD, type Preview } from "./Timeline";
import {
  blocksOn,
  busyDays,
  categoryMinutes,
  CATEGORIES,
  dayStats,
  defaultFrom,
  isoAt,
  matchesFilter,
  minuteToY,
  rangeStart,
  resolvePlacement,
  sortTasks,
  weekOf,
  yToMinute,
  type Block,
  type TaskFilter,
} from "./schedule";
import { useDrag } from "./useDrag";

/** مدة كبيرة: الأرقام بخط العرض والوحدة صغيرة بجانبها */
function BigDuration({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const parts: [number, string][] = [];
  if (h) parts.push([h, t("س", "h")]);
  if (m || !h) parts.push([m, t("د", "m")]);
  return (
    <span className="inline-flex items-baseline gap-2" aria-label={formatDuration(minutes, getLang())}>
      {parts.map(([n, unit]) => (
        <span key={unit} className="inline-flex items-baseline gap-0.5" aria-hidden>
          <span className="tnum font-display text-2xl font-semibold sm:text-[1.75rem]">{n}</span>
          <span className="text-xs text-ink-2 sm:text-sm">{unit}</span>
        </span>
      ))}
    </span>
  );
}

const FORMAT_KEY = "waf:timeblock-format";

function useHour12(): [boolean, (v: boolean) => void] {
  const [h12, setH12] = useState(() => {
    try {
      return localStorage.getItem(FORMAT_KEY) !== "24";
    } catch {
      return true;
    }
  });
  const set = useCallback((v: boolean) => {
    setH12(v);
    try {
      localStorage.setItem(FORMAT_KEY, v ? "12" : "24");
    } catch {
      /* بلا تخزين */
    }
  }, []);
  return [h12, set];
}

function useLabels(): [Labels, (l: Labels) => Promise<void>] {
  const { account, demo } = useAuth();
  const [labels, setLabels] = useState<Labels>(() => readLabels(demo ? demoMeta().timeblock_labels : account?.meta.timeblock_labels));
  const save = useCallback(async (next: Labels) => {
    const clean: Labels = {};
    for (const c of CATEGORIES) {
      const v = next[c]?.trim().slice(0, 24);
      if (v && v !== defaultCategoryName(c)) clean[c] = v;
    }
    try {
      await saveAccountMeta({ timeblock_labels: clean });
      setLabels(clean);
      toast(t("حُفظت أسماء الفئات في حسابك", "Category names saved to your account"), { duration: 2200 });
    } catch (e) {
      toastError(e);
      throw e;
    }
  }, []);
  return [labels, save];
}

type DragItem = { task: Task; kind: "row" | "block" };

export default function Blocks({ origin }: { origin: TaskOrigin }) {
  const query = useTasks(origin);
  const actions = useTaskActions(origin);
  const waf = origin === "waf";
  const lang = useLang();
  const now = useNow(30_000);
  const today = dayOf(now);
  const nowMinute = now.getHours() * 60 + now.getMinutes();

  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [hour12, setHour12] = useHour12();
  const [labels, saveLabels] = useLabels();
  const [spotlight, setSpotlight] = useState<Category | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; preset: ComposerPreset; n: number }>({ open: false, preset: {}, n: 0 });
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const highlightId = new URLSearchParams(useSearch()).get("task");

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => query.data ?? [], [query.data]);
  const open = useMemo(() => all.filter(isOpen), [all]);
  const blocks = useMemo(() => blocksOn(all, day), [all, day]);
  const from = rangeStart(blocks);
  const stats = dayStats(blocks);
  const cats = categoryMinutes(blocks);
  const busy = useMemo(() => busyDays(all, weekOf(day)), [all, day]);
  const isToday = day === today;
  const realBlocks = blocks.filter((b) => !b.ghost).length;

  const listed = useMemo(
    () => sortTasks(all.filter((x) => isOpen(x) || (x.completedAt && dayOf(new Date(x.completedAt)) === today)).filter((x) => matchesFilter(x, filter)), { byQuadrant: waf }),
    [all, filter, today, waf],
  );
  const unscheduled = useMemo(() => {
    const list = sortTasks(open.filter((x) => !isScheduled(x)), { byQuadrant: waf });
    const i = highlightId ? list.findIndex((x) => x.id === highlightId) : -1;
    return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
  }, [open, waf, highlightId]);

  const openComposer = useCallback((preset: ComposerPreset) => setComposer((c) => ({ open: true, preset, n: c.n + 1 })), []);

  // ───────── الأفعال ─────────

  /** يحجز المهمة عند الدقيقة المطلوبة أو في أول وقت فارغ بعدها. يعيد دقيقة البداية أو null. */
  function book(task: Task, minute: number | null, onDay = day): number | null {
    const length = lengthOf(task);
    const want = minute ?? defaultFrom(onDay, today, now);
    const place = resolvePlacement(open, onDay, want, length, task.id);
    if (!place) {
      toast.error(t("لا فراغ يسع هذه المهمة في بقيّة اليوم.", "There’s no free time left today that fits this task."));
      return null;
    }
    const startsAt = isoAt(onDay, place.start);
    if (startsAt === task.startsAt) return place.start;
    const prev = { startsAt: task.startsAt, endsAt: task.endsAt, estimateMinutes: task.estimateMinutes };
    actions.update.mutate({ id: task.id, patch: { startsAt, endsAt: isoAt(onDay, place.start + length), estimateMinutes: length } });
    const at = clock(place.start, hour12);
    toast(
      place.moved && minute !== null
        ? t(`حُجزت «${short(task.title)}» ${at} — أول وقت فارغ`, `Booked “${short(task.title)}” at ${at}, the first free slot`)
        : t(`حُجزت «${short(task.title)}» ${at}`, `Booked “${short(task.title)}” at ${at}`),
      { duration: UNDO_MS, action: { label: t("تراجع", "Undo"), onClick: () => actions.update.mutate({ id: task.id, patch: prev }) } },
    );
    return place.start;
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

  function unschedule(task: Task) {
    actions.update.mutate({ id: task.id, patch: { startsAt: null, endsAt: null, estimateMinutes: lengthOf(task) } });
    toast(t("أُلغي الحجز، والمهمة عادت إلى القائمة", "Unbooked. The task is back in the list"), { duration: 2200 });
  }

  async function create(input: Omit<TaskInput, "origin">, bookedDay: string | null) {
    await actions.create.mutateAsync(input);
    toast(bookedDay ? t("حُجزت المهمة على الجدول", "Task booked on the schedule") : t("أُضيفت المهمة إلى القائمة", "Task added to the list"), { duration: 2200 });
    if (bookedDay && bookedDay !== day) setDay(bookedDay);
  }

  async function saveBlock(task: Task, patch: TaskPatch) {
    await actions.update.mutateAsync({ id: task.id, patch });
  }

  function openBlock(b: Block) {
    if (b.ghost) {
      toast(t("موعد متكرّر قادم. يظهر للتعديل حين تُنجَز المهمة التي قبله.", "An upcoming repeat. It becomes editable once the one before it is done."), { duration: 3200 });
      return;
    }
    setEditing(b.task);
  }

  function openTask(task: Task) {
    if (task.startsAt) setDay(dayOf(new Date(task.startsAt)));
    setSheet(false);
    setEditing(task);
  }

  // ───────── السحب ─────────

  const dropMinute = (y: number, grabY: number, kind: DragItem["kind"]) => {
    const r = gridRef.current!.getBoundingClientRect();
    return yToMinute(y - r.top - TOP_PAD - (kind === "block" ? grabY : 6), from);
  };

  const drag = useDrag<DragItem>({
    scrollers: () => [scrollRef.current, listRef.current],
    onMove: (s) => {
      if (s.target?.dataset.drop !== "timeline" || !gridRef.current) return setPreview((p) => (p ? null : p));
      const m = dropMinute(s.y, s.grabY, s.item.kind);
      const length = lengthOf(s.item.task);
      const place = resolvePlacement(open, day, m, length, s.item.task.id);
      setPreview((p) => (place ? (p && p.start === place.start && p.moved === place.moved && p.length === length ? p : { start: place.start, length, moved: place.moved }) : null));
    },
    onDrop: (s) => {
      setPreview(null);
      const { task, kind } = s.item;
      const zone = s.target?.dataset.drop;
      if (zone === "timeline" && gridRef.current) {
        const m = dropMinute(s.y, s.grabY, kind);
        if (kind === "block" && task.startsAt === isoAt(day, m)) return null;
        const start = book(task, m);
        return start === null ? null : { settle: `[data-drag-id="b:${task.id}"][data-start="${start}"]` };
      }
      if (zone === "tasks" && kind === "block") {
        unschedule(task);
        return { settle: `[data-drag-id="r:${task.id}"]` };
      }
      return null;
    },
    onEnd: () => setPreview(null),
  });
  const bindRow = (task: Task, id: string) => drag.bind({ task, kind: "row" }, id);
  const bindBlock = (b: Block, id: string) => drag.bind({ task: b.task, kind: "block" }, id);

  // ───────── لوحة المفاتيح ─────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("[role='dialog']")) return;
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyK") {
        e.preventDefault();
        openComposer({ day });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el?.closest("[role='radiogroup']") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      const forward = isRtl() ? "ArrowLeft" : "ArrowRight";
      const back = isRtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) setDay((d) => addDays(d, 1));
      else if (e.key === back) setDay((d) => addDays(d, -1));
      else if (e.code === "KeyT") setDay(today);
      else if (e.code === "KeyN") openComposer({ day, timed: true, length: 60 });
      else if (e.key === "Escape") setSpotlight(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, today, openComposer]);

  // ───────── التمرير إلى الآن أو أول حجز ─────────

  const loaded = !query.isPending;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!loaded || !el) return;
    const first = blocks.find((b) => !b.ghost) ?? blocks[0];
    const target = isToday && nowMinute >= from ? nowMinute - 75 : first ? first.start - 30 : 8 * 60;
    el.scrollTop = Math.max(0, minuteToY(target, from));
    // يُمرَّر عند فتح الصفحة وتغيير اليوم فقط، لا مع كل تعديل
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, loaded]);

  useEffect(() => {
    if (!loaded || !highlightId) return;
    const row = document.querySelector<HTMLElement>(`[data-drag-id="r:${highlightId}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [loaded, highlightId]);

  // ───────── العرض ─────────

  const dayRel = isToday ? t("اليوم", "Today") : day === addDays(today, 1) ? t("غداً", "Tomorrow") : day === addDays(today, -1) ? t("أمس", "Yesterday") : null;
  const dayNav = (
    <div className="flex items-center gap-1">
      <IconButton label={t("اليوم السابق", "Previous day")} size="sm" onClick={() => setDay((d) => addDays(d, -1))} className="max-md:size-11">
        <ChevronLeft className="size-[18px] rtl:rotate-180" strokeWidth={1.75} />
      </IconButton>
      <Button variant="quiet" size="sm" onClick={() => setDay(today)} disabled={isToday} className="max-md:h-11">
        {t("اليوم", "Today")}
      </Button>
      <IconButton label={t("اليوم التالي", "Next day")} size="sm" onClick={() => setDay((d) => addDays(d, 1))} className="max-md:size-11">
        <ChevronRight className="size-[18px] rtl:rotate-180" strokeWidth={1.75} />
      </IconButton>
    </div>
  );

  const statsRow = (
    <dl className="grid grid-cols-3 border-y border-line">
        {[
          { label: t("محجوز", "Booked"), value: stats.booked, dot: null },
          { label: t("وقت التركيز", "Focus time"), value: stats.focus, dot: TONE.dusk.dot },
          { label: t("وقت حرّ", "Free time"), value: stats.free, dot: null },
        ].map((s, i) => (
          <div key={s.label} className={cx("min-w-0 py-3 sm:py-4", i > 0 && "border-s border-line ps-3 sm:ps-6", i < 2 && "pe-3")}>
            <dt className="flex items-center gap-1.5 text-xs text-ink-2">
              {s.dot && <span className={cx("size-1.5 rounded-full", s.dot)} aria-hidden />}
              {s.label}
            </dt>
            <dd className="mt-1.5 leading-none">{loaded ? <BigDuration minutes={s.value} /> : <span className="font-display text-xl text-ink-3">—</span>}</dd>
          </div>
        ))}
    </dl>
  );

  const taskListProps = {
    tasks: listed,
    totalOpen: open.length,
    filter,
    onFilter: setFilter,
    hour12,
    labels,
    today,
    waf,
    highlightId,
    activeId: drag.activeId,
    onNew: () => openComposer({ day }),
    onBook: (task: Task) => book(task, null),
    onOpen: openTask,
    onComplete: complete,
    onReopen: (task: Task) => actions.reopen.mutate(task.id),
    onDelete: remove,
  };

  return (
    <div>
      <FlowSteps origin={origin} />
      <PageHead
        back={{ href: "/time", label: t("الوقت", "Time") }}
        title={t("حجز الوقت", "Time blocking")}
        lede={t("أعطِ كل مهمة ساعتها على جدول اليوم، واترك للتركيز مكانه.", "Give each task its hour on today’s schedule, and leave room to focus.")}
        actions={
          <Button onClick={() => openComposer({ day })} icon={<Plus className="size-4" strokeWidth={2} />} title={t("مهمة جديدة (N)", "New task (N)")}>
            {t("مهمة جديدة", "New task")}
          </Button>
        }
      />

      <div className="max-md:hidden">{statsRow}</div>

      {query.isError ? (
        <Failure className="mt-6" title={t("تعذّر تحميل المهام.", "Couldn’t load your tasks.")} body={t("تحقّق من الاتصال ثم أعد المحاولة.", "Check your connection and try again.")} onRetry={() => query.refetch()} />
      ) : (
        <div className="mt-6 grid items-start gap-6 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)_15.5rem] xl:grid-cols-[21rem_minmax(0,1fr)_17rem]">
          {/* المهام */}
          <aside aria-labelledby="tasks-title" className="hidden min-h-0 flex-col md:sticky md:top-20 md:flex md:max-h-[calc(100dvh-6.5rem)]">
            <div className="mb-3 flex items-center gap-2">
              <h2 id="tasks-title" className="min-w-0 flex-1 font-display text-lg">
                {t("المهام", "Tasks")} <span className="tnum font-ui text-sm font-normal text-ink-3">{open.length}</span>
              </h2>
              <IconButton label={t("مهمة جديدة", "New task")} size="sm" onClick={() => openComposer({ day })}>
                <Plus className="size-[18px]" strokeWidth={1.75} />
              </IconButton>
            </div>
            <div ref={listRef} data-drop="tasks" className="scroll-thin -mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
              {loaded ? (
                <TaskList {...taskListProps} bind={bindRow} />
              ) : (
                <div className="flex flex-col gap-3" role="status" aria-label={t("تُحمَّل مهامك…", "Loading your tasks…")}>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
            </div>
            <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
              {t("اسحب مهمة إلى ساعتها، أو اضغط عليها مرتين لتُحجز في أول وقت فارغ.", "Drag a task to its hour, or double-click it to book the first free slot.")}
            </p>
          </aside>

          {/* الجوّال: الأسبوع فوق الجدول */}
          <div className="md:hidden">
            <WeekStrip day={day} today={today} busy={busy} onPick={setDay} />
          </div>

          {/* الجدول */}
          <section aria-labelledby="day-title" className="sheet flex min-w-0 flex-col overflow-hidden">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 id="day-title" className="font-ui text-base font-semibold sm:text-lg">
                  {formatDay(day)}
                </h2>
                <p className="flex gap-3 text-xs text-ink-3">
                  {dayRel && <span className={cx(isToday && "font-medium text-saffron-ink")}>{dayRel}</span>}
                  <span className="tnum">{realBlocks === 0 ? t("لا حجوزات", "No blocks") : t(`${realBlocks} ${realBlocks === 1 ? "حجز" : realBlocks <= 10 ? "حجوزات" : "حجزاً"}`, `${realBlocks} ${realBlocks === 1 ? "block" : "blocks"}`)}</span>
                </p>
              </div>
              {dayNav}
            </header>

            {/* الجوّال: المهام بلا وقت شريطٌ يُسحب منه */}
            <div className="border-b border-line px-4 py-2.5 md:hidden">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-xs text-ink-2">
                  {unscheduled.length ? (
                    <>
                      {t("بلا وقت", "No time yet")} <span className="tnum text-ink-3">{unscheduled.length}</span>
                    </>
                  ) : (
                    t("كل مهامك محجوزة.", "Every task has its time.")
                  )}
                </p>
                <Button variant="ghost" size="sm" className="h-11 -me-2" onClick={() => setSheet(true)} icon={<ListTodo className="size-4" strokeWidth={1.75} />}>
                  {t("كل المهام", "All tasks")}
                </Button>
              </div>
              {unscheduled.length > 0 && (
                <>
                  <ul className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-1.5" aria-label={t("مهام بلا وقت", "Tasks without a time")}>
                    {unscheduled.map((task) => (
                      <li key={task.id} className="shrink-0">
                        <button
                          type="button"
                          {...bindRow(task, `s:${task.id}`)}
                          onClick={() => book(task, null)}
                          aria-label={t(`${task.title}. اضغط لتحجز أول وقت فارغ`, `${task.title}. Tap to book the first free slot`)}
                          className={cx(
                            "waf-draggable press flex h-11 max-w-[15rem] items-center gap-2 rounded-sm border bg-sheet px-3 text-sm",
                            task.id === highlightId ? "border-saffron" : "border-line",
                            drag.activeId === `s:${task.id}` && "waf-drag-source",
                          )}
                        >
                          <span className={cx("size-1.5 shrink-0 rounded-full", TONE[CATEGORY_TONE[task.category]].dot)} aria-hidden />
                          <span dir="auto" className="truncate">{task.title}</span>
                          <span className="tnum shrink-0 text-xs text-ink-3">{formatDuration(lengthOf(task), lang)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-2xs text-ink-3">{t("اضغط لتحجز أول وقت فارغ، أو اضغط مطوّلاً ثم اسحب إلى ساعتها.", "Tap to book the first free slot, or press and hold, then drag to its hour.")}</p>
                </>
              )}
            </div>

            {loaded ? (
              <Timeline
                ref={gridRef}
                scrollRef={scrollRef}
                from={from}
                blocks={blocks}
                hour12={hour12}
                labels={labels}
                spotlight={spotlight}
                nowMinute={isToday ? nowMinute : null}
                preview={preview}
                activeId={drag.activeId}
                bind={bindBlock}
                onOpen={openBlock}
                onEmpty={(m) => openComposer({ day, timed: true, start: m, length: 60 })}
                className="h-[60dvh] min-h-[24rem] md:h-[min(74dvh,52rem)] md:min-h-[28rem]"
              />
            ) : (
              <div className="flex h-[60dvh] min-h-[24rem] flex-col gap-4 p-4 md:h-[min(74dvh,52rem)]" role="status" aria-label={t("يُحمَّل الجدول…", "Loading the schedule…")}>
                <Skeleton className="h-16 w-2/3" />
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-24 w-3/4" />
              </div>
            )}
          </section>

          <div className="md:hidden">{statsRow}</div>

          {/* الجانب */}
          <aside aria-label={t("لوحة اليوم", "Day panel")} className="flex flex-col gap-5 md:col-span-2 md:grid md:grid-cols-3 md:gap-8 lg:col-span-1 lg:flex lg:gap-5">
            <div className="hidden md:block">
              <WeekStrip day={day} today={today} busy={busy} onPick={setDay} />
            </div>
            <div className="md:border-0 md:pt-0 lg:border-t lg:border-line lg:pt-5">
              <CategoryPanel minutes={cats} labels={labels} spotlight={spotlight} onSpotlight={setSpotlight} onSaveLabels={saveLabels} />
            </div>
            <div className="flex flex-col gap-5 border-t border-line pt-5 md:border-0 md:pt-0 lg:border-t lg:pt-5">
              <FormatSwitch hour12={hour12} onChange={setHour12} />
              <div className="border-t border-line pt-5">
                <QuickAdd onPick={(p) => openComposer({ ...p, day })} />
              </div>
            </div>
          </aside>
        </div>
      )}

      <Composer
        key={composer.n}
        open={composer.open}
        onOpenChange={(o) => setComposer((c) => ({ ...c, open: o }))}
        preset={composer.preset}
        tasks={open}
        today={today}
        now={now}
        hour12={hour12}
        labels={labels}
        onCreate={create}
      />

      <BlockDialog
        task={editing}
        onClose={() => setEditing(null)}
        tasks={open}
        hour12={hour12}
        labels={labels}
        waf={waf}
        onSave={saveBlock}
        onComplete={(task) => {
          setEditing(null);
          complete(task);
        }}
        onReopen={(task) => {
          setEditing(null);
          actions.reopen.mutate(task.id);
        }}
        onUnschedule={(task) => {
          setEditing(null);
          unschedule(task);
        }}
        onDelete={(task) => {
          setEditing(null);
          remove(task);
        }}
      />

      <Dialog open={sheet} onOpenChange={setSheet} title={t("المهام", "Tasks")} description={t("المهام بلا وقت أولاً، ثم المحجوزة حسب وقتها.", "Tasks without a time first, then booked ones by time.")}>
        <TaskList {...taskListProps} bind={null} />
      </Dialog>
    </div>
  );
}
