// وضع العرض: الاجتماع على شاشة القاعة. المحاور واحداً بعد الآخر، القرار والمسؤول يُكتبان
// وأنت فيه ويُحفظان تلقائياً، ومؤقّت زعفراني لأنه «الآن».

import { ArrowLeft, Maximize, Minimize, Pause, Play, Printer, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useMeetingActions, useMeetings } from "@/data/hooks";
import type { AgendaItem, Followup, Meeting } from "@/data/types";
import { isRtl, t } from "@/lib/i18n";
import { IconButton } from "@/ui/Button";
import { ThemeToggle } from "@/ui/Chrome";
import { cx } from "@/ui/cx";
import { Empty, Failure, Loading } from "@/ui/States";
import { MeetingDocument } from "./MeetingDocument";
import { printTitle, titleOf } from "./model";
import "./meetings.css";

export default function Present({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useMeetings();
  const meeting = data?.find((m) => m.id === id);

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Failure title={t("تعذّرت قراءة الاجتماع", "Couldn’t load the meeting")} body={t("تحقّق من الاتصال ثم أعد المحاولة.", "Check your connection, then try again.")} onRetry={() => refetch()} />
      </div>
    );
  if (!meeting)
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Empty
          title={t("لم نجد هذا الاجتماع", "We couldn’t find this meeting")}
          body={t("ربما أُرشف أو تغيّر رابطه. ارجع إلى قائمة الاجتماعات واختر منها.", "It may have been archived or its link changed. Go back to your meetings and pick one.")}
          action={
            <Link href="/meetings" className="press inline-flex h-10 items-center rounded-sm bg-inverse px-4 text-sm font-medium text-on-inverse">
              {t("إلى الاجتماعات", "Go to meetings")}
            </Link>
          }
        />
      </div>
    );
  return <Stage key={meeting.id} meeting={meeting} />;
}

// ───────── المؤقّت ─────────

interface TimerState {
  startedAt: number | null;
  acc: number;
}

function useElapsed(id: string) {
  const key = `waf:meeting-timer:${id}`;
  const [state, setState] = useState<TimerState>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return JSON.parse(raw) as TimerState;
    } catch {
      /* بلا تخزين */
    }
    return { startedAt: null, acc: 0 };
  });
  const [, tick] = useState(0);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* بلا تخزين */
    }
    if (state.startedAt === null) return;
    const h = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, [key, state]);
  const ms = state.acc + (state.startedAt ? Date.now() - state.startedAt : 0);
  return {
    running: state.startedAt !== null,
    seconds: Math.floor(ms / 1000),
    toggle: () => setState((s) => (s.startedAt ? { startedAt: null, acc: s.acc + Date.now() - s.startedAt } : { ...s, startedAt: Date.now() })),
    reset: () => setState({ startedAt: null, acc: 0 }),
  };
}

function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// ───────── المسرح ─────────

type SaveState = "idle" | "saving" | "saved" | "error";

function Stage({ meeting }: { meeting: Meeting }) {
  const actions = useMeetingActions();
  const [agenda, setAgenda] = useState<AgendaItem[]>(meeting.agenda);
  const [followups, setFollowups] = useState<Followup[]>(meeting.followups);
  const [active, setActive] = useState(() => Math.max(0, meeting.agenda.findIndex((a) => !a.covered)));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useElapsed(meeting.id);
  const [full, setFull] = useState(false);

  // ── الحفظ: الحقول المكتوبة بعد توقّف قصير، والعلامات فوراً ──
  const pending = useRef<AgendaItem[] | null>(null);
  const handle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushAgenda = useCallback(() => {
    if (handle.current) clearTimeout(handle.current);
    handle.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState("saving");
    actions.saveAgenda.mutate(
      { id: meeting.id, agenda: next },
      { onSuccess: () => setSaveState(pending.current ? "saving" : "saved"), onError: () => setSaveState("error") },
    );
  }, [meeting.id]);
  const queueAgenda = (next: AgendaItem[], now = false) => {
    setAgenda(next);
    pending.current = next;
    setSaveState("saving");
    if (handle.current) clearTimeout(handle.current);
    if (now) flushAgenda();
    else handle.current = setTimeout(flushAgenda, 700);
  };
  useEffect(() => () => flushAgenda(), [flushAgenda]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || saveState === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const go = useCallback(
    (i: number, smooth: boolean) => {
      const n = Math.max(0, Math.min(agenda.length - 1, i));
      setActive(n);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`topic-${n}`)?.scrollIntoView({ block: "start", behavior: smooth && !reduce ? "smooth" : "auto" });
    },
    [agenda.length],
  );

  // ── لوحة المفاتيح: السهم في اتجاه القراءة يتقدّم ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const forward = isRtl() ? "ArrowLeft" : "ArrowRight";
      const back = isRtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) {
        e.preventDefault();
        go(active + 1, false);
      } else if (e.key === back) {
        e.preventDefault();
        go(active - 1, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  // ── ملء الشاشة ──
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast.error(t("ملء الشاشة غير متاح في هذا المتصفح.", "Full screen isn’t available in this browser."));
    } catch {
      toast.error(t("تعذّر فتح ملء الشاشة.", "Couldn’t open full screen."));
    }
  };

  // ── الطباعة: عنوان المستند يصير اسم ملف PDF ──
  useEffect(() => {
    const base = document.title;
    const before = () => (document.title = printTitle(meeting));
    const after = () => (document.title = base);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      document.title = base;
    };
  }, [meeting]);
  const print = () => {
    toast(t("اختر «حفظ كملف PDF» في وجهة الطباعة، ثم شارك الملف.", "Choose “Save as PDF” as the destination, then share the file."));
    window.print();
  };

  const covered = agenda.filter((a) => a.covered).length;
  const pct = agenda.length ? Math.round((covered / agenda.length) * 100) : 0;

  return (
    <div className="mt-stage min-h-dvh bg-bg">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-1 px-2 sm:gap-2 sm:px-5">
          <Link
            href={`/meetings/${meeting.id}`}
            className="press inline-flex h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink"
            aria-label={t("ارجع إلى المحرّر", "Back to the editor")}
          >
            <ArrowLeft className="size-[18px] rtl:-scale-x-100" strokeWidth={1.75} />
            <span className="hidden sm:inline">{t("المحرّر", "Editor")}</span>
          </Link>
          <p className="hidden min-w-0 flex-1 truncate text-sm text-ink-3 md:block">
            <bdi>{titleOf(meeting)}</bdi>
          </p>
          <div className="ms-auto flex items-center gap-1">
            <button
              type="button"
              onClick={timer.toggle}
              aria-pressed={timer.running}
              aria-label={timer.running ? t(`أوقف المؤقّت، مضى ${clock(timer.seconds)}`, `Pause the timer, ${clock(timer.seconds)} elapsed`) : t("شغّل المؤقّت", "Start the timer")}
              className={cx(
                "press inline-flex h-11 items-center gap-2.5 rounded-full ps-3.5 pe-4 transition-colors duration-150",
                timer.running ? "bg-saffron text-on-saffron" : timer.seconds ? "bg-saffron-wash text-saffron-ink" : "border border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              {timer.running ? <Pause className="size-4" strokeWidth={2} /> : <Play className="size-4 rtl:-scale-x-100" strokeWidth={2} />}
              <span className="tnum min-w-[3.25rem] text-start font-display text-lg leading-none font-semibold" aria-hidden>
                {timer.seconds || timer.running ? clock(timer.seconds) : t("ابدأ", "Start")}
              </span>
            </button>
            {!timer.running && timer.seconds > 0 && (
              <IconButton label={t("صفّر المؤقّت", "Reset the timer")} onClick={timer.reset} className="max-sm:size-11">
                <RotateCcw className="size-[18px]" strokeWidth={1.75} />
              </IconButton>
            )}
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
            <IconButton label={full ? t("الخروج من ملء الشاشة", "Exit full screen") : t("ملء الشاشة", "Full screen")} onClick={toggleFull} className="max-sm:size-11">
              {full ? <Minimize className="size-[18px]" strokeWidth={1.75} /> : <Maximize className="size-[18px]" strokeWidth={1.75} />}
            </IconButton>
            <IconButton label={t("تنزيل PDF", "Download PDF")} onClick={print} className="max-sm:size-11">
              <Printer className="size-[18px]" strokeWidth={1.75} />
            </IconButton>
            <ThemeToggle className="max-sm:size-11" />
          </div>
        </div>

        {/* شريط المحاور: قطعة لكل محور، والنشط بالزعفران */}
        {agenda.length > 0 && (
          <div className="mx-auto flex max-w-[96rem] items-center gap-4 px-3 pb-1 sm:px-6">
            <div className="flex min-w-0 flex-1 gap-1" role="group" aria-label={t("المحاور", "Topics")}>
              {agenda.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => go(i, true)}
                  aria-label={t(`المحور ${i + 1}: ${a.title || "بلا عنوان"}${a.covered ? " (نوقش)" : ""}`, `Topic ${i + 1}: ${a.title || "untitled"}${a.covered ? " (covered)" : ""}`)}
                  aria-current={i === active ? "step" : undefined}
                  title={a.title}
                  className="group flex h-7 min-w-0 flex-1 items-center"
                >
                  <span className={cx("mt-seg block h-1 w-full rounded-full group-hover:opacity-80", i === active ? "bg-saffron" : a.covered ? "bg-palm" : "bg-line-strong/70")} />
                </button>
              ))}
            </div>
            <p className="tnum flex shrink-0 items-center gap-2 text-xs text-ink-3" aria-live="polite">
              <span>{t(`نوقش ${covered} من ${agenda.length}`, `${covered} of ${agenda.length} covered`)}</span>
              <span className="text-ink-2" dir="ltr">{pct}%</span>
            </p>
          </div>
        )}
      </header>

      <main>
        <MeetingDocument
          meeting={meeting}
          agenda={agenda}
          followups={followups}
          live={{
            active,
            note: meeting.note,
            onActivate: (i) => setActive(i),
            onToggleCovered: (i) => {
              const next = agenda.map((a, j) => (j === i ? { ...a, covered: !a.covered } : a));
              queueAgenda(next, true);
              if (next[i].covered) {
                const open = next.findIndex((a) => !a.covered);
                if (open >= 0) go(open, true);
              }
            },
            onAgendaField: (i, patch) => queueAgenda(agenda.map((a, j) => (j === i ? { ...a, ...patch } : a))),
            onToggleFollowup: (i) => {
              const next = followups.map((f, j) => (j === i ? { ...f, done: !f.done } : f));
              setFollowups(next);
              setSaveState("saving");
              actions.saveFollowups.mutate({ id: meeting.id, followups: next }, { onSuccess: () => setSaveState("saved"), onError: () => setSaveState("error") });
            },
          }}
        />
        <p className="no-print pb-10 text-center text-xs text-ink-3" aria-live="polite">
          {saveState === "error" ? (
            <span className="text-ember">{t("لم يُحفظ آخر تعديل. تحقّق من الاتصال واكتب مرة أخرى.", "Your last change wasn’t saved. Check your connection and type again.")}</span>
          ) : saveState === "saving" ? (
            t("يُحفظ…", "Saving…")
          ) : (
            t("ما تكتبه هنا يُحفظ تلقائياً في الاجتماع وسجلّ القرارات.", "What you write here saves itself to the meeting and the decision log.")
          )}
          <span className="hidden md:inline">
            {" "}
            {t("الأسهم تنقلك بين المحاور.", "Arrow keys move between topics.")}
          </span>
        </p>
      </main>
    </div>
  );
}
