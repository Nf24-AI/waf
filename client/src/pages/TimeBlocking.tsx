// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Brain,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Flag,
  GripVertical,
  Heart,
  Layers,
  Menu,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Repeat,
  Search,
  Sun,
  Target,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { TASK_CATEGORIES, type Task, type TaskCategory, type TaskPriority } from "@shared/tasks";
import { SETTINGS_ROUTE, STATISTICS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import FlowSteps from "@/components/time/FlowSteps";
import TimeLayout from "@/components/time/TimeLayout";
import BlockModal, { type BlockDraft } from "@/components/timeblock/BlockModal";
import MusicButton from "@/components/timeblock/MusicButton";
import TaskComposer, { type ComposerPrefill, type ComposerResult } from "@/components/timeblock/TaskComposer";
import { useAuthSession } from "@/contexts/AuthContext";
import { toDateInput } from "@/lib/clock";
import { flowHref, useInFlow } from "@/lib/flow";
import { readName } from "@/lib/preferences";
import { useTaskParam } from "@/lib/task-param";
import {
  DAY_END_MIN,
  SECTIONS,
  WEEKDAY_SHORT,
  blocksOn,
  clashWith,
  dateOf,
  dayStats,
  firstFreeSlot,
  firstHour,
  formatDuration,
  formatTime,
  greeting,
  isoAt,
  shiftDay,
  sortTasks,
  weekOf,
  type Block,
  type TimeFormat,
} from "@/lib/timeblock";
import { trpc } from "@/lib/trpc";

/**
 * حجز الوقت — يوم كامل على جدول واحد: المهام يميناً، والساعات في الوسط،
 * وأرقام اليوم يساراً.
 *
 * الحجز ليس كائناً ثانياً: هو المهمة نفسها وقد أُعطيت ساعة. فالسحب إلى ساعةٍ
 * يكتب `scheduledStart` على صفّها، و«إلغاء الحجز» يمحوه ويُبقيها. ولذلك لا
 * قائمتان تتباعدان — ما في الجدول وما في القائمة صفوفٌ واحدة تُقرأ مرّتين.
 */

const CATEGORY_ICON: Record<TaskCategory, typeof Brain> = {
  deep: Brain,
  meeting: Users,
  personal: Heart,
  project: Layers,
  other: MoreHorizontal,
};

const TONE = Object.fromEntries(TASK_CATEGORIES.map(item => [item.id, item.tone])) as Record<TaskCategory, string>;
const DEFAULT_LABELS = Object.fromEntries(TASK_CATEGORIES.map(item => [item.id, item.label])) as Record<TaskCategory, string>;

const FILTERS = [
  { id: "all", label: "الكل" },
  { id: "unscheduled", label: "بلا وقت" },
  { id: "work", label: "العمل" },
  { id: "personal", label: "شخصي" },
  { id: "meeting", label: "اجتماعات" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const QUICK: { label: string; category: TaskCategory; tone: string; icon: typeof Brain; title?: string }[] = [
  { label: "عمل عميق", category: "deep", tone: "purple", icon: Brain },
  { label: "اجتماع", category: "meeting", tone: "blue", icon: Users },
  { label: "شخصي", category: "personal", tone: "teal", icon: Heart },
  { label: "غداء", category: "other", tone: "orange", icon: Utensils },
  { label: "استراحة", category: "other", tone: "gray", icon: Coffee },
  { label: "أخرى", category: "other", tone: "gray", icon: MoreHorizontal, title: "" },
];

const REPEAT_LABEL = { daily: "كل يوم", weekdays: "أيام العمل", weekly: "كل أسبوع", custom: "مخصّص" } as const;

/**
 * ما يُحفظ في المتصفّح: ذوق العرض، وفئةُ مهمةٍ لم يحفظها الخادم بعد.
 *
 * `meta` مظلّة لا مصدر: أعمدة الفئة والأولوية تُرحَّل بيدٍ (waf-timeblock.sql)،
 * وقبل ترحيلها يُسقطها الخادم من الطلب. فتُحفظ هنا كي لا يعود اللون رمادياً
 * بعد كل تحديث — ومتى أعادها الخادم غلبت قيمتُه.
 */
interface Prefs {
  format: TimeFormat;
  theme: "dark" | "light";
  labels: Partial<Record<TaskCategory, string>>;
  meta: Record<string, { category?: TaskCategory; priority?: TaskPriority }>;
}
const PREFS_KEY = "waf:timeblock";

function readPrefs(): Prefs {
  const base: Prefs = { format: 12, theme: "dark", labels: {}, meta: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return base;
    return {
      format: saved.format === 24 ? 24 : 12,
      theme: saved.theme === "light" ? "light" : "dark",
      labels: saved.labels && typeof saved.labels === "object" ? saved.labels : {},
      meta: saved.meta && typeof saved.meta === "object" ? saved.meta : {},
    };
  } catch {
    return base;
  }
}

interface Toast {
  id: number;
  text: string;
  tone?: "error";
  action?: { label: string; run?: () => void; href?: string };
}

/**
 * نصّ الخطأ كما يُقال لصاحبه.
 *
 * رفضُ التحقق يصل مصفوفة JSON خاماً من zod؛ عرضها كما هي يملأ الإشعار رموزاً
 * لا يفهمها أحد. فتؤخذ رسالة أول مشكلة، وما لا يُقرأ يُستبدل بجملة عامّة.
 */
function readable(error: unknown): string {
  const fallback = "تعذّر تنفيذ العملية. حاول مرة أخرى.";
  const message = (error as Error)?.message?.trim();
  if (!message) return fallback;
  if (!message.startsWith("[")) return message;
  try {
    const first = (JSON.parse(message) as { message?: string }[])[0]?.message;
    return first && /[؀-ۿ]/.test(first) ? first : fallback;
  } catch {
    return fallback;
  }
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable));
}

export default function TimeBlocking() {
  const preselected = useTaskParam();
  // الرحلة تُغيّر الوجهة التالية وحدها، لا ما تفعله الصفحة.
  const inFlow = useInFlow();
  const auth = useAuthSession();

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });
  const create = trpc.tasks.create.useMutation();
  const update = trpc.tasks.update.useMutation();
  const complete = trpc.tasks.complete.useMutation();
  const archive = trpc.tasks.archive.useMutation();
  const restore = trpc.tasks.restore.useMutation();
  const reopen = trpc.tasks.reopen.useMutation();
  const pending = create.isPending || update.isPending || complete.isPending || archive.isPending;

  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [now, setNow] = useState(() => new Date());
  const today = toDateInput(now);
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [spot, setSpot] = useState<TaskCategory | null>(null);
  const [editLabels, setEditLabels] = useState(false);
  const [composer, setComposer] = useState<{ prefill: ComposerPrefill | null; key: number } | null>(null);
  const [modal, setModal] = useState<{ task: Task | null; initial: BlockDraft; key: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [over, setOver] = useState<number | "zone" | null>(null);
  const [finished, setFinished] = useState<Task[]>([]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* لا شيء يُفعل: الذوق يعود إلى افتراضه في الزيارة التالية. */
    }
  }, [prefs]);

  // خطّ «الآن» يتحرّك بالدقيقة؛ أسرع من ذلك رسمٌ بلا فرق يُرى.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.action ? 6000 : 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const say = useCallback((text: string, extra: Omit<Toast, "id" | "text"> = {}) => {
    setToast({ id: Date.now(), text, ...extra });
  }, []);

  const tasks: Task[] = open.data ?? [];
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...prefs.labels }), [prefs.labels]);
  const format = prefs.format;

  const categoryOf = useCallback(
    (task: Task): TaskCategory => task.category ?? prefs.meta[task.id]?.category ?? "other",
    [prefs.meta],
  );
  const priorityOf = useCallback(
    (task: Task): TaskPriority => task.priority ?? prefs.meta[task.id]?.priority ?? "medium",
    [prefs.meta],
  );

  const blocks = useMemo(() => blocksOn(tasks, day), [tasks, day]);
  const stats = useMemo(() => dayStats(blocks, categoryOf), [blocks, categoryOf]);
  const week = useMemo(() => weekOf(day), [day]);
  const busyDays = useMemo(() => new Set(week.filter(date => blocksOn(tasks, date).length > 0)), [tasks, week]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startHour = firstHour(blocks);
  const hours = useMemo(() => Array.from({ length: 24 - startHour }, (_, index) => startHour + index), [startHour]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = tasks.filter(task => {
      if (needle && !task.title.toLowerCase().includes(needle)) return false;
      const category = categoryOf(task);
      if (filter === "unscheduled") return !task.scheduledStart;
      if (filter === "work") return category === "deep" || category === "project";
      if (filter === "personal") return category === "personal";
      if (filter === "meeting") return category === "meeting";
      return true;
    });
    return sortTasks(list, priorityOf);
  }, [tasks, query, filter, categoryOf, priorityOf]);

  /** من أين يبدأ البحث عن فراغ: الآن إن كان اليوم يومَنا، وإلا التاسعة. */
  const defaultFrom = useCallback(
    (target: string) => (target === today ? Math.min(nowMin, DAY_END_MIN - 15) : 9 * 60),
    [today, nowMin],
  );

  const focusHref = (id: string) =>
    inFlow ? flowHref(TIME_METHOD_ROUTES.focus, id) : `${TIME_METHOD_ROUTES.focus}?task=${id}`;

  /**
   * كل كتابة تمرّ من هنا: تُنفَّذ، ثم تُحدَّث القائمة، والخطأ يُقال في إشعار.
   *
   * يعود بالنتيجة أو `null`، فمن ينادي يعرف هل يُغلق نافذته أم يُبقيها.
   */
  async function act<T>(run: () => Promise<T>): Promise<T | null> {
    try {
      const result = await run();
      await utils.tasks.listOpen.invalidate();
      return result;
    } catch (error) {
      say(readable(error), { tone: "error" });
      return null;
    }
  }

  /** يحفظ الفئة والأولوية محلياً حين يعود الصفّ بدونهما (أعمدة لم تُرحَّل بعد). */
  function remember(task: Task, category: TaskCategory, priority?: TaskPriority) {
    if (task.category && (task.priority || !priority)) return;
    setPrefs(current => ({
      ...current,
      meta: { ...current.meta, [task.id]: { category, priority: priority ?? current.meta[task.id]?.priority } },
    }));
  }

  /**
   * يحجز مهمةً في يومٍ، من دقيقةٍ بعينها أو من أول فراغ بعدها.
   *
   * الإسقاط على ساعةٍ مأخوذة لا يُرفض: يُزاح إلى أول فراغ ويُقال ذلك. من
   * سحب مهمةً يريدها في جدوله، لا رسالةَ خطأ تعيدها إلى القائمة.
   */
  async function schedule(task: Task, target: string, from: number) {
    const own = (block: Pick<Block, "start" | "end">) => (block as Block).task?.id === task.id;
    const taken = blocksOn(tasks, target).filter(block => !block.ghost || block.task.id !== task.id);
    const current = taken.find(block => block.task.id === task.id && !block.ghost);
    const length = current ? current.end - current.start : task.estimatedMinutes ?? 30;

    const exact = from + length <= DAY_END_MIN && !clashWith(taken, from, from + length, own);
    const slot = exact ? from : firstFreeSlot(taken, from, length, own);
    if (slot === null) return say("لا فراغ يسع هذه المهمة في بقيّة اليوم.", { tone: "error" });

    const saved = await act(() =>
      update.mutateAsync({ id: task.id, schedule: { start: isoAt(target, slot), end: isoAt(target, slot + length) } }),
    );
    if (!saved) return;
    say(
      `حُجزت «${task.title}» ${formatTime(slot, format)}${exact ? "" : " — أول وقت فارغ"}`,
      { action: { label: "ابدأ التركيز", href: focusHref(task.id) } },
    );
  }

  async function createTask(result: ComposerResult) {
    const saved = await act(() =>
      create.mutateAsync({
        title: result.title,
        estimatedMinutes: result.minutes,
        category: result.category,
        priority: result.priority,
        dueDate: result.day,
        ...(result.repeatRule ? { repeatRule: result.repeatRule } : {}),
        ...(result.repeatDays.length ? { repeatDays: result.repeatDays } : {}),
        ...(result.schedule
          ? { scheduledStart: isoAt(result.day, result.schedule.start), scheduledEnd: isoAt(result.day, result.schedule.end) }
          : {}),
      }),
    );
    if (!saved) return;
    remember(saved as Task, result.category, result.priority);
    setComposer(null);
    if (result.schedule && result.day !== day) setDay(result.day);
    say(result.schedule ? "حُجزت المهمة على الجدول" : "أُضيفت المهمة إلى القائمة");
  }

  async function saveBlock(draft: BlockDraft) {
    const editing = modal?.task ?? null;
    const when = { start: isoAt(day, draft.start), end: isoAt(day, draft.end) };
    const saved = await act(() =>
      editing
        ? update.mutateAsync({
            id: editing.id,
            title: draft.title,
            category: draft.category,
            estimatedMinutes: draft.end - draft.start,
            schedule: when,
          })
        : create.mutateAsync({
            title: draft.title,
            category: draft.category,
            estimatedMinutes: draft.end - draft.start,
            scheduledStart: when.start,
            scheduledEnd: when.end,
          }),
    );
    if (!saved) return;
    remember(saved as Task, draft.category);
    setModal(null);
    say(editing ? "حُفظ الحجز" : "أُضيف الحجز");
  }

  async function finish(task: Task) {
    const saved = await act(() => complete.mutateAsync({ id: task.id }));
    if (!saved) return;
    setModal(null);
    setFinished(current => [task, ...current.filter(item => item.id !== task.id)]);
    say(`أُنجزت «${task.title}»`, { action: { label: "تراجع", run: () => void unfinish(task) } });
  }

  async function unfinish(task: Task) {
    const saved = await act(() => reopen.mutateAsync({ id: task.id }));
    if (!saved) return;
    setFinished(current => current.filter(item => item.id !== task.id));
    say("أُعيد فتح المهمة");
  }

  async function remove(task: Task) {
    const saved = await act(() => archive.mutateAsync({ id: task.id }));
    if (!saved) return;
    setModal(null);
    say(`حُذفت «${task.title}»`, {
      action: {
        label: "تراجع",
        run: () => void act(() => restore.mutateAsync({ id: task.id })).then(back => back && say("أُعيدت المهمة")),
      },
    });
  }

  async function unschedule(task: Task) {
    // المدّة تبقى مع المهمة: من ألغى ساعتين لم يقل إنها صارت نصف ساعة.
    const length =
      task.scheduledStart && task.scheduledEnd
        ? Math.round((new Date(task.scheduledEnd).getTime() - new Date(task.scheduledStart).getTime()) / 60_000)
        : undefined;
    const saved = await act(() =>
      update.mutateAsync({ id: task.id, schedule: null, ...(length ? { estimatedMinutes: length } : {}) }),
    );
    if (!saved) return;
    setModal(null);
    say("أُلغي الحجز، والمهمة عادت إلى القائمة");
  }

  function openAdd(from?: number) {
    const start = firstFreeSlot(blocks, from ?? defaultFrom(day), 60) ?? Math.min(from ?? 9 * 60, DAY_END_MIN - 60);
    setModal({ task: null, initial: { title: "", start, end: start + 60, category: "deep" }, key: Date.now() });
  }

  function openEdit(block: Block) {
    if (block.ghost) {
      return say("موعد متكرّر قادم. يظهر للتعديل حين تُنجَز المهمة التي قبله.");
    }
    setModal({
      task: block.task,
      initial: { title: block.task.title, start: block.start, end: block.end, category: categoryOf(block.task) },
      key: Date.now(),
    });
  }

  const openComposer = useCallback((prefill: ComposerPrefill | null = null) => {
    setComposer({ prefill, key: Date.now() });
  }, []);

  function goTo(next: string) {
    setDay(next);
    setSpot(null);
  }

  function drop(event: React.DragEvent, from: number | null) {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData("text/plain");
    const task = tasks.find(item => item.id === id);
    if (task) void schedule(task, day, from ?? defaultFrom(day));
  }

  // الاختصارات: ⌘K معروض على الزرّ فليعمل، والأسهم لمن يقلّب أيامه بلا فأرة.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openComposer();
        return;
      }
      if (event.key === "Escape") {
        setComposer(null);
        setModal(null);
        setSearching(false);
        setQuery("");
        return;
      }
      if (composer || modal || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      // RTL: السهم الأيمن يعود يوماً، كما يعود الزرّ الذي على اليمين.
      if (event.key === "ArrowRight") setDay(current => shiftDay(current, -1));
      else if (event.key === "ArrowLeft") setDay(current => shiftDay(current, 1));
      else if (event.code === "KeyT") setDay(toDateInput(new Date()));
      else if (event.code === "KeyN") {
        event.preventDefault();
        setModal({
          task: null,
          initial: { title: "", start: 9 * 60, end: 10 * 60, category: "deep" },
          key: Date.now(),
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [composer, modal, openComposer]);

  // يُفتح الجدول على الساعة الحالية (أو أول حجز)، لا على السادسة صباحاً دائماً.
  const loaded = open.isSuccess;
  useEffect(() => {
    const box = timelineRef.current;
    if (!box || !loaded || box.scrollHeight <= box.clientHeight) return;
    const hour = day === today ? now.getHours() : Math.floor((blocks[0]?.start ?? 9 * 60) / 60);
    const row = box.querySelector<HTMLElement>(`[data-hour="${Math.max(hour, startHour)}"]`);
    if (row) box.scrollTo({ top: Math.max(0, row.offsetTop - 70), behavior: "smooth" });
    // يُعاد عند تبديل اليوم وحده: إعادته مع كل حجز تخطف التمرير من يد صاحبه.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, loaded]);

  const name = readName() || (auth.user?.user_metadata?.full_name as string | undefined) || auth.user?.email?.split("@")[0] || "";
  const dayLabel = dateOf(day).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const realBlocks = blocks.filter(block => !block.ghost);

  const top = (onOpenNav: () => void) => (
    <header className="tbk-top">
      <button type="button" className="tbk-iconbtn tbk-burger" onClick={onOpenNav} aria-label="فتح القائمة">
        <Menu size={18} aria-hidden="true" />
      </button>
      <div className="tbk-brand">
        <span className="tbk-brandmark" aria-hidden="true">
          <CalendarClock size={16} />
        </span>
        <b>حجز الوقت</b>
      </div>

      <div className="tbk-navcenter">
        <div className="tbk-navpill">
          <button type="button" onClick={() => goTo(shiftDay(day, -1))} aria-label="اليوم السابق">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="tbk-today" onClick={() => { goTo(today); say("اليوم"); }}>
            اليوم
          </button>
          <button type="button" onClick={() => goTo(shiftDay(day, 1))} aria-label="اليوم التالي">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>
        <time className="tbk-date" dateTime={day}>{dayLabel}</time>
        <FormatSwitch format={format} short onChange={next => setPrefs(current => ({ ...current, format: next }))} />
        <MusicButton />
      </div>

      <div className="tbk-actions">
        <button
          type="button"
          className="tbk-iconbtn"
          aria-label="بحث في المهام"
          aria-pressed={searching}
          onClick={() => {
            setSearching(true);
            window.setTimeout(() => searchRef.current?.focus(), 30);
          }}
        >
          <Search size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="tbk-iconbtn"
          aria-label={prefs.theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          onClick={() => setPrefs(current => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }))}
        >
          {prefs.theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
        <Link className="tbk-profile" href={SETTINGS_ROUTE} aria-label="الإعدادات">
          <span className="tbk-avatar">{(name || "و").slice(0, 1).toUpperCase()}</span>
          <span>{name}</span>
        </Link>
      </div>
    </header>
  );

  return (
    <TimeLayout top={top}>
      <div className="tbk" data-theme={prefs.theme}>
        <FlowSteps current="schedule" />

        <section className="tbk-hero">
          <div className="tbk-greeting">
            <h1>
              {greeting(now.getHours())}
              {name && <>، <span>{name}</span></>}
              {/* مع ما قبلها في سطر واحد: يدٌ تلوّح وحدها في سطرٍ تبدو خطأ. */}
              &nbsp;👋
            </h1>
            <p className="tbk-sub">خطّط وقتك، وركّز على ما يهمّ.</p>
          </div>
          <div className="tbk-stats">
            <Stat icon={<CalendarClock size={18} />} value={formatDuration(stats.planned)} label="محجوز" />
            <Stat icon={<Target size={18} />} value={formatDuration(stats.focus)} label="وقت التركيز" color="#22d3b0" />
            <Stat icon={<Zap size={18} />} value={formatDuration(stats.free)} label="وقت حرّ" color="#ffae28" />
          </div>
        </section>

        <section className="tbk-layout">
          <aside className="tbk-card tbk-tasks" aria-labelledby="tbk-tasks-title">
            <div className="tbk-taskhead">
              <h2 id="tbk-tasks-title">
                المهام <span className="tbk-count">{tasks.length}</span>
              </h2>
            </div>
            <button type="button" className="tbk-addtask" onClick={() => openComposer()}>
              <Plus size={16} aria-hidden="true" />
              إضافة مهمة <kbd>Ctrl K</kbd>
            </button>
            {searching && (
              <input
                ref={searchRef}
                className="tbk-search"
                type="search"
                placeholder="ابحث في مهامك…"
                aria-label="بحث في المهام"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            )}
            <div className="tbk-filters" role="group" aria-label="تصفية المهام">
              {FILTERS.map(item => (
                <button key={item.id} type="button" className="tbk-filter" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="tbk-tasklist">
              {status.data?.configured === false && (
                <p className="tbk-empty">المهام غير موصولة بعد. اضبط SUPABASE_URL و SUPABASE_ANON_KEY ثم أعد النشر.</p>
              )}
              {/* سؤال الإعداد يسبق سؤال المهام؛ وبينهما لا يصحّ أن تبدو القائمة فارغة. */}
              {(status.isLoading || open.isLoading) && <p className="tbk-empty">تُحمَّل مهامك…</p>}
              {open.isError && <p className="tbk-empty">تعذّر تحميل المهام. حدّث الصفحة.</p>}
              {open.isSuccess && visible.length === 0 && finished.length === 0 && (
                <p className="tbk-empty">{tasks.length ? "لا مهام في هذا العرض." : "لا مهام بعد. أضف أول مهمة."}</p>
              )}
              {visible.map(task => {
                const category = categoryOf(task);
                const at = task.scheduledStart ? new Date(task.scheduledStart) : null;
                const minutes =
                  task.scheduledStart && task.scheduledEnd
                    ? Math.round((new Date(task.scheduledEnd).getTime() - new Date(task.scheduledStart).getTime()) / 60_000)
                    : task.estimatedMinutes ?? 30;
                return (
                  <div
                    key={task.id}
                    className="tbk-task"
                    draggable
                    data-current={task.id === preselected}
                    onDragStart={event => {
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDoubleClick={() => void schedule(task, day, defaultFrom(day))}
                  >
                    <button type="button" className="tbk-check" aria-label={`إنجاز «${task.title}»`} onClick={() => void finish(task)} />
                    <div>
                      <div className="tbk-tasktitle">
                        <span className="tbk-dot" data-tone={TONE[category]} aria-hidden="true" />
                        {task.title}
                        {priorityOf(task) === "high" && <Flag className="tbk-flag" size={12} aria-label="أولوية عالية" />}
                      </div>
                      <div className="tbk-taskmeta">
                        {labels[category]} · {formatDuration(minutes)}
                        {task.repeatRule && ` · ${REPEAT_LABEL[task.repeatRule]}`}
                        {at && (
                          <>
                            {" · "}
                            <b>
                              {toDateInput(at) === day ? "" : `${WEEKDAY_SHORT[at.getDay()]} `}
                              {formatTime(at.getHours() * 60 + at.getMinutes(), format)}
                            </b>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="tbk-drag"
                      title="اسحبها إلى الجدول، أو اضغط لحجز أول وقت فارغ"
                      aria-label={`حجز أول وقت فارغ لـ«${task.title}»`}
                      onClick={() => void schedule(task, day, defaultFrom(day))}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
              {finished.map(task => (
                <div key={task.id} className="tbk-task is-done">
                  <button type="button" className="tbk-check" aria-label={`إعادة فتح «${task.title}»`} onClick={() => void unfinish(task)}>
                    ✓
                  </button>
                  <div>
                    <div className="tbk-tasktitle">{task.title}</div>
                    <div className="tbk-taskmeta">أُنجزت</div>
                  </div>
                  <span />
                </div>
              ))}
            </div>
          </aside>

          <section className="tbk-planner" aria-label="الجدول الزمني">
            <div className="tbk-section">
              <div className="tbk-sectionhead">
                <Clock size={16} aria-hidden="true" />
                <strong>{dayLabel}</strong>
                <small>جدول اليوم المتّصل</small>
                <span className="tbk-sectionmeta">{realBlocks.length} حجز</span>
                <button type="button" className="tbk-plus" onClick={() => openAdd()} aria-label="إضافة حجز">
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>

              <div className="tbk-timeline" ref={timelineRef}>
                {hours.map(hour => {
                  const marker = SECTIONS.find(section => section.from === hour);
                  const inHour = blocks.filter(block => Math.floor(block.start / 60) === hour);
                  return (
                    <React.Fragment key={hour}>
                      {marker && (
                        <div className="tbk-daysection">
                          <span aria-hidden="true">{marker.icon}</span>
                          <strong>{marker.label}</strong>
                          <small>
                            {formatTime(marker.from * 60, format)} – {formatTime(marker.to * 60, format)}
                          </small>
                          <button
                            type="button"
                            className="tbk-plus"
                            onClick={() => openAdd(marker.from * 60)}
                            aria-label={`إضافة حجز في ${marker.label}`}
                          >
                            <Plus size={15} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                      <div
                        className={over === hour ? "tbk-row is-over" : "tbk-row"}
                        data-hour={hour}
                        onDragOver={event => {
                          event.preventDefault();
                          if (over !== hour) setOver(hour);
                        }}
                        onDragLeave={() => setOver(current => (current === hour ? null : current))}
                        onDrop={event => drop(event, hour * 60)}
                      >
                        <span className="tbk-time">{formatTime(hour * 60, format)}</span>
                        {day === today && now.getHours() === hour && (
                          <div className="tbk-nowline" style={{ insetBlockStart: `${(now.getMinutes() / 60) * 100}%` }}>
                            <span>الآن {formatTime(nowMin, format)}</span>
                          </div>
                        )}
                        {inHour.map(block => {
                          const category = categoryOf(block.task);
                          const Icon = CATEGORY_ICON[category];
                          return (
                            <button
                              key={`${block.task.id}-${block.ghost}`}
                              type="button"
                              className={[
                                "tbk-block",
                                block.ghost && "is-ghost",
                                spot && spot !== category && "is-dim",
                              ].filter(Boolean).join(" ")}
                              data-tone={TONE[category]}
                              data-block={block.task.id}
                              draggable={!block.ghost}
                              title={block.ghost ? "موعد متكرّر قادم" : "اضغط للتعديل، أو اسحب لتغيير الساعة"}
                              onDragStart={event => {
                                event.dataTransfer.setData("text/plain", block.task.id);
                                event.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => openEdit(block)}
                            >
                              <span className="tbk-when">
                                {formatTime(block.start, format)} – {formatTime(block.end, format)}
                              </span>
                              <span className="tbk-ico"><Icon size={18} aria-hidden="true" /></span>
                              <span className="tbk-block-main">
                                <span className="tbk-title">{block.task.title}</span>
                                <span className="tbk-desc">
                                  {labels[category]} · {formatDuration(block.end - block.start)}
                                  {block.task.repeatRule && ` · ${REPEAT_LABEL[block.task.repeatRule]}`}
                                </span>
                              </span>
                              <span className="tbk-dots">
                                {block.ghost ? <Repeat size={15} aria-hidden="true" /> : <MoreVertical size={16} aria-hidden="true" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                })}
                <button
                  type="button"
                  className={over === "zone" ? "tbk-dropzone is-over" : "tbk-dropzone"}
                  onClick={() => openAdd()}
                  onDragOver={event => {
                    event.preventDefault();
                    if (over !== "zone") setOver("zone");
                  }}
                  onDragLeave={() => setOver(null)}
                  onDrop={event => drop(event, null)}
                >
                  أسقط مهمةً هنا لتُحجز في أول وقت فارغ، أو اضغط لإضافة حجز
                </button>
              </div>
            </div>
          </section>

          <aside className="tbk-rightcol">
            <div className="tbk-card">
              <div className="tbk-month">
                <strong>{dateOf(day).toLocaleDateString("ar", { month: "long", year: "numeric" })}</strong>
                <span className="tbk-calnav">
                  <button type="button" onClick={() => goTo(shiftDay(day, -7))} aria-label="الأسبوع السابق">
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => goTo(shiftDay(day, 7))} aria-label="الأسبوع التالي">
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <div className="tbk-week">
                {WEEKDAY_SHORT.map(short => (
                  <span key={short}>{short}</span>
                ))}
                {week.map(date => (
                  <button
                    key={date}
                    type="button"
                    className="tbk-day"
                    aria-pressed={date === day}
                    aria-label={dateOf(date).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" })}
                    data-today={date === today}
                    data-busy={busyDays.has(date)}
                    onClick={() => goTo(date)}
                  >
                    {dateOf(date).getDate()}
                  </button>
                ))}
              </div>
            </div>

            <div className="tbk-card tbk-format">
              <h3>
                <Clock size={15} aria-hidden="true" />
                صيغة الوقت
              </h3>
              <FormatSwitch format={format} onChange={next => setPrefs(current => ({ ...current, format: next }))} />
            </div>

            <div className="tbk-card">
              <h2>
                التركيز
                <Link className="tbk-link" href={STATISTICS_ROUTE}>
                  عرض التفاصيل ←
                </Link>
              </h2>
              <div className="tbk-focusrow">
                <div className="tbk-ring" style={{ "--p": stats.focusPercent } as React.CSSProperties}>
                  <span>
                    {stats.focusPercent}%<small>تركيز</small>
                  </span>
                </div>
                <div className="tbk-legend">
                  <Legend tone="teal" label="تركيز" value={stats.focus} />
                  <Legend tone="blue" label="اجتماعات" value={stats.meetings} />
                  <Legend tone="purple" label="شخصي" value={stats.personal} />
                  <Legend tone="gray" label="حرّ" value={stats.free} />
                </div>
              </div>
            </div>

            <div className="tbk-card">
              <h2>
                الفئات
                <button type="button" className="tbk-link" onClick={() => setEditLabels(current => !current)}>
                  {editLabels ? "تم" : "تعديل"}
                </button>
              </h2>
              {stats.byCategory
                .filter(item => editLabels || item.id !== "other" || item.minutes > 0)
                .map(item =>
                  editLabels ? (
                    <div key={item.id} className="tbk-cat">
                      <div className="tbk-cathead">
                        <span>
                          <span className="tbk-dot" data-tone={TONE[item.id]} aria-hidden="true" />
                          <input
                            aria-label={`اسم فئة ${DEFAULT_LABELS[item.id]}`}
                            value={prefs.labels[item.id] ?? DEFAULT_LABELS[item.id]}
                            maxLength={24}
                            onChange={event =>
                              setPrefs(current => ({ ...current, labels: { ...current.labels, [item.id]: event.target.value } }))
                            }
                            onBlur={event => {
                              // اسمٌ فارغ يعود إلى أصله: فئةٌ بلا اسم لا تُختار من قائمة.
                              if (!event.target.value.trim()) {
                                setPrefs(current => {
                                  const { [item.id]: _dropped, ...rest } = current.labels;
                                  return { ...current, labels: rest };
                                });
                              }
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      className="tbk-cat"
                      aria-pressed={spot === item.id}
                      title="اضغط لإبراز حجوزات هذه الفئة في الجدول"
                      onClick={() => setSpot(current => (current === item.id ? null : item.id))}
                    >
                      <div className="tbk-cathead">
                        <span>
                          <span className="tbk-dot" data-tone={TONE[item.id]} aria-hidden="true" />
                          {labels[item.id] || DEFAULT_LABELS[item.id]}
                        </span>
                        <span>
                          {formatDuration(item.minutes)} · {item.percent}%
                        </span>
                      </div>
                      <div className="tbk-bar" data-tone={TONE[item.id]}>
                        <span style={{ inlineSize: `${item.percent}%` }} />
                      </div>
                    </button>
                  ),
                )}
            </div>

            <div className="tbk-card">
              <h2>إضافة سريعة</h2>
              <div className="tbk-quick">
                {QUICK.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    data-tone={item.tone}
                    onClick={() => openComposer({ title: item.title ?? item.label, category: item.category })}
                  >
                    <item.icon size={18} aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {createPortal(
        <div className="tbk-portal" data-theme={prefs.theme} dir="rtl">
          {composer && (
            <TaskComposer
              key={composer.key}
              viewDay={day}
              format={format}
              labels={labels}
              prefill={composer.prefill}
              pending={pending}
              suggestStart={(target, minutes) => firstFreeSlot(blocksOn(tasks, target), defaultFrom(target), minutes)}
              clashTitle={(target, start, end) => clashWith(blocksOn(tasks, target), start, end)?.task.title ?? null}
              onClose={() => setComposer(null)}
              onCreate={result => void createTask(result)}
            />
          )}
          {modal && (
            <BlockModal
              key={modal.key}
              task={modal.task}
              initial={modal.initial}
              format={format}
              labels={labels}
              pending={pending}
              focusHref={modal.task ? focusHref(modal.task.id) : null}
              clashTitle={(start, end) =>
                clashWith(blocks, start, end, block => block.task.id === modal.task?.id)?.task.title ?? null
              }
              onClose={() => setModal(null)}
              onSave={draft => void saveBlock(draft)}
              onDelete={() => modal.task && void remove(modal.task)}
              onUnschedule={() => modal.task && void unschedule(modal.task)}
              onComplete={() => modal.task && void finish(modal.task)}
            />
          )}
          {toast && (
            <div className="tbk-toast" key={toast.id} data-tone={toast.tone} role="status">
              {toast.text}
              {toast.action?.href ? (
                <Link href={toast.action.href}>{toast.action.label}</Link>
              ) : (
                toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      const run = toast.action?.run;
                      setToast(null);
                      run?.();
                    }}
                  >
                    {toast.action.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </TimeLayout>
  );
}

function Stat({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color?: string }) {
  return (
    <div className="tbk-stat">
      <div className="tbk-staticon" style={color ? { color } : undefined} aria-hidden="true">
        {icon}
      </div>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function Legend({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <div>
      <span>
        <span className="tbk-dot" data-tone={tone} aria-hidden="true" />
        {label}
      </span>
      <b>{formatDuration(value)}</b>
    </div>
  );
}

function FormatSwitch({ format, short = false, onChange }: { format: TimeFormat; short?: boolean; onChange: (next: TimeFormat) => void }) {
  return (
    <div className="tbk-seg" role="group" aria-label="صيغة الوقت">
      <button type="button" aria-pressed={format === 12} onClick={() => onChange(12)}>
        {short ? "12س" : "12 ساعة (ص/م)"}
      </button>
      <button type="button" aria-pressed={format === 24} onClick={() => onChange(24)}>
        {short ? "24س" : "24 ساعة"}
      </button>
    </div>
  );
}
