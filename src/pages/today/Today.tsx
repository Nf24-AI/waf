// «اليوم»: أول ما يراه المستخدم بعد الدخول. يجيب عن سؤال واحد: ماذا يحمل يومي؟
// خط اليوم هو العنصر الأقوى، وما حوله هادئ: التالي، ثم الجدول، ثم ما بقي مفتوحاً.

import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useMeetingActions, useMeetings, useTasks } from "@/data/hooks";
import type { Meeting, Task } from "@/data/types";
import { useAuth } from "@/lib/auth";
import { count, formatClock, formatDay, t, useLang } from "@/lib/i18n";
import { decisionsOf, readiness } from "@/lib/meetings";
import { isScheduled } from "@/lib/tasks";
import { addDays, dayOf, formatDuration, minutesOfDay, toMinutes } from "@/lib/time";
import { Button, ButtonLink } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { useNow } from "@/ui/DayLine";
import { Failure, Skeleton } from "@/ui/States";
import { TodayHorizon, type HorizonItem } from "./TodayHorizon";

const FOLLOWUP_WINDOW_DAYS = 14;
const LIST_LIMIT = 5;

const meetingTitle = (m: Pick<Meeting, "title">) => m.title.trim() || t("اجتماع بلا عنوان", "Untitled meeting");
const percent = (n: number) => t(`${n}٪`, `${n}%`);

function meetingEnd(m: Meeting): number {
  if (m.endTime) return toMinutes(m.endTime);
  return m.startTime ? toMinutes(m.startTime) + 60 : 0;
}

/** أقرب اجتماع لم ينتهِ: اليوم أولاً ثم الأيام القادمة */
function nextMeeting(meetings: Meeting[], today: string, minute: number): Meeting | null {
  const open = meetings
    .filter((m) => m.day && m.status !== "done" && (m.day > today || (m.day === today && (!m.startTime || meetingEnd(m) > minute))))
    .sort((a, b) => (a.day! + (a.startTime ?? "99")).localeCompare(b.day! + (b.startTime ?? "99")));
  return open[0] ?? null;
}

/** العدد مع المعدود بالعربية: واحد، مثنى، ٣–١٠ جمع، وما فوقها مفرد منصوب */
function arCount(n: number, [one, two, few, many]: [string, string, string, string]): string {
  if (n === 0) return "";
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n <= 10 ? few : many}`;
}

interface Row extends HorizonItem {
  href: string;
  done: boolean;
}

export default function Today() {
  useLang();
  const { account } = useAuth();
  const now = useNow();
  const today = dayOf(now);
  const minute = now.getHours() * 60 + now.getMinutes();
  const meetingsQ = useMeetings();
  const blocksQ = useTasks("blocks");
  const wafQ = useTasks("waf");

  const first = (account?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = now.getHours() < 12 ? t("صباح الخير", "Good morning") : t("مساء الخير", "Good evening");

  const meetings = meetingsQ.data ?? [];
  const todaysMeetings = meetings.filter((m) => m.day === today && m.startTime);
  const booked = [...(blocksQ.data ?? []), ...(wafQ.data ?? [])].filter((x): x is Task & { startsAt: string; endsAt: string } => isScheduled(x) && dayOf(new Date(x.startsAt)) === today);

  const rows: Row[] = [
    ...todaysMeetings.map((m) => ({
      id: m.id,
      kind: "meeting" as const,
      start: toMinutes(m.startTime!),
      end: meetingEnd(m),
      title: meetingTitle(m),
      href: `/meetings/${m.id}`,
      done: m.status === "done",
    })),
    ...booked.map((b) => ({
      id: b.id,
      kind: "block" as const,
      start: minutesOfDay(b.startsAt),
      end: Math.max(minutesOfDay(b.startsAt) + 5, dayOf(new Date(b.endsAt)) === today ? minutesOfDay(b.endsAt) : 24 * 60),
      title: b.title,
      href: b.origin === "waf" ? "/waf/blocks" : "/time/blocks",
      done: b.completedAt !== null,
    })),
  ].sort((a, b) => a.start - b.start || (a.kind === "meeting" ? -1 : 1));

  const loading = meetingsQ.isPending || blocksQ.isPending || wafQ.isPending;
  const failed = meetingsQ.isError;

  const summary = loading
    ? ""
    : todaysMeetings.length + booked.length === 0
      ? t("لا شيء على جدولك اليوم حتى الآن.", "Nothing on your schedule today yet.")
      : t(
          `على جدولك اليوم ${[arCount(todaysMeetings.length, ["اجتماع واحد", "اجتماعان", "اجتماعات", "اجتماعاً"]), arCount(booked.length, ["وقت محجوز واحد", "وقتان محجوزان", "أوقات محجوزة", "وقتاً محجوزاً"])].filter(Boolean).join(" و")}.`,
          `Today you have ${[todaysMeetings.length && count(todaysMeetings.length, ["", ""], ["meeting", "meetings"]), booked.length && count(booked.length, ["", ""], ["booked block", "booked blocks"])].filter(Boolean).join(" and ")}.`,
        );

  return (
    <div className="pb-4">
      <header className="pt-2 sm:pt-6">
        <p className="text-sm text-ink-2">{formatDay(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <h1 className="mt-1 break-words font-display text-3xl font-semibold sm:text-4xl">
          {first ? t(`${greeting}، ${first}`, `${greeting}, ${first}`) : greeting}
        </h1>
        <p className="mt-2 min-h-[1.6em] text-ink-2" aria-live="polite">
          {summary}
        </p>
      </header>

      <section aria-labelledby="day-title" className="mt-8 sm:mt-10">
        <h2 id="day-title" className="sr-only">
          {t("خط اليوم", "Day line")}
        </h2>
        <TodayHorizon items={rows} />
      </section>

      {failed ? (
        <Failure className="mt-10" title={t("تعذّر قراءة الاجتماعات.", "Couldn’t load your meetings.")} body={t("تحقّق من الاتصال ثم أعد المحاولة.", "Check your connection, then try again.")} onRetry={() => meetingsQ.refetch()} />
      ) : (
        <div className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          <div className="min-w-0">
            {loading ? <Skeleton className="h-36 w-full" /> : <NextMeeting meetings={meetings} today={today} minute={minute} hasToday={todaysMeetings.length > 0} />}
            <Schedule rows={rows} minute={minute} loading={loading} />
          </div>
          <aside className="min-w-0 space-y-12" aria-label={t("ما بقي مفتوحاً", "Still open")}>
            <Followups meetings={meetings} today={today} loading={loading} />
            <Unowned meetings={meetings} loading={loading} />
          </aside>
        </div>
      )}

      <Spaces />
    </div>
  );
}

// ───────── التالي ─────────

function NextMeeting({ meetings, today, minute, hasToday }: { meetings: Meeting[]; today: string; minute: number; hasToday: boolean }) {
  const lang = useLang();
  const [, navigate] = useLocation();
  const { create } = useMeetingActions();
  const m = nextMeeting(meetings, today, minute);

  const createToday = () =>
    create.mutate({ day: today }, { onSuccess: (x) => navigate(`/meetings/${x.id}`) });

  const createButton = (
    <Button variant="quiet" onClick={createToday} disabled={create.isPending} icon={<Plus className="size-4" strokeWidth={1.75} />} className="max-sm:h-11">
      {t("أنشئ اجتماعاً لليوم", "Create a meeting for today")}
    </Button>
  );

  if (!m || m.day !== today) {
    return (
      <section aria-labelledby="next-title" className="border-b border-line pb-8">
        <h2 id="next-title" className="font-display text-xl font-semibold">
          {hasToday ? t("انتهت اجتماعات اليوم", "Today’s meetings are over") : t("لا اجتماعات اليوم", "No meetings today")}
        </h2>
        <p className="mt-1 text-ink-2">
          {m
            ? t(`التالي «${meetingTitle(m)}» ${formatDay(m.day!)}${m.startTime ? ` الساعة ${formatClock(m.startTime)}` : ""}.`, `Next is “${meetingTitle(m)}” on ${formatDay(m.day!)}${m.startTime ? ` at ${formatClock(m.startTime)}` : ""}.`)
            : t("الوقت لك. وإن كان عندك لقاء لم تجهّزه بعد، ابدأه من هنا.", "The time is yours. If there’s a meeting you haven’t prepared yet, start it here.")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {createButton}
          {m && (
            <ButtonLink href={`/meetings/${m.id}`} variant="ghost" className="max-sm:h-11">
              {t("افتح التالي", "Open the next one")}
            </ButtonLink>
          )}
        </div>
      </section>
    );
  }

  const r = readiness(m);
  const ready = r === 100;
  const start = m.startTime ? toMinutes(m.startTime) : null;
  const when =
    start === null
      ? t("بلا وقت محدّد", "No time set")
      : start <= minute
        ? t("جارٍ الآن", "Happening now")
        : t(`بعد ${formatDuration(start - minute, lang)}`, `In ${formatDuration(start - minute, lang)}`);

  return (
    <section aria-labelledby="next-title" className="border-b border-line pb-8">
      <h2 id="next-title" className="font-ui text-sm font-medium text-ink-2">
        {t("اجتماعك التالي", "Your next meeting")}
      </h2>
      <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="shrink-0">
          <p className="tnum font-display text-3xl font-semibold leading-none sm:text-4xl">{m.startTime ? formatClock(m.startTime) : "—"}</p>
          <p className={cx("mt-2 text-sm", start !== null && start <= minute ? "font-medium text-saffron-ink" : "text-ink-3")}>{when}</p>
        </div>
        <div className="min-w-0 flex-1 basis-60">
          <Link href={`/meetings/${m.id}`} className="block break-words font-display text-xl font-semibold hover:text-dusk sm:text-2xl">
            {meetingTitle(m)}
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-1.5 w-32 overflow-hidden rounded-full bg-sunk"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={r}
              aria-label={t("الجاهزية", "Readiness")}
            >
              <div className={cx("h-full rounded-full", ready ? "bg-palm" : "bg-dusk")} style={{ width: `${r}%` }} />
            </div>
            <span className="tnum text-sm text-ink-2">{ready ? t("جاهز للعرض", "Ready to present") : t(`جاهز ${percent(r)}`, `${percent(r)} ready`)}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {ready ? (
              <ButtonLink href={`/meetings/${m.id}/present`} variant="saffron" className="max-sm:h-11">
                {t("اعرض", "Present")}
              </ButtonLink>
            ) : (
              <ButtonLink href={`/meetings/${m.id}`} variant="saffron" className="max-sm:h-11">
                {t("جهّز", "Prepare")}
              </ButtonLink>
            )}
            {ready && (
              <ButtonLink href={`/meetings/${m.id}`} variant="ghost" className="max-sm:h-11">
                {t("افتح الاجتماع", "Open meeting")}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────── جدول اليوم ─────────

function Schedule({ rows, minute, loading }: { rows: Row[]; minute: number; loading: boolean }) {
  return (
    <section aria-labelledby="schedule-title" className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="schedule-title" className="font-display text-xl font-semibold">
          {t("جدول اليوم", "Today’s schedule")}
        </h2>
        <Link href="/time/blocks" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-ink sm:min-h-0">
          {t("احجز وقتاً", "Book time")}
        </Link>
      </div>
      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-ink-2">{t("لا اجتماعات ولا أوقات محجوزة اليوم. احجز ساعة لأهمّ مهمة عندك.", "No meetings or booked time today. Book an hour for your most important task.")}</p>
      ) : (
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {rows.map((r) => {
            const past = r.end <= minute || r.done;
            const current = !r.done && r.start <= minute && r.end > minute;
            return (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={r.href} className="group grid min-h-12 grid-cols-[5.5rem_0.75rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 sm:grid-cols-[7rem_0.75rem_minmax(0,1fr)_auto]">
                  <span className={cx("tnum text-sm", current ? "font-medium text-saffron-ink" : past ? "text-ink-3" : "text-ink-2")}>{formatClock(clockOf(r.start))}</span>
                  <span className="flex justify-center" aria-hidden>
                    {r.kind === "meeting" ? <span className={cx("h-4 w-[2px] rounded-full", past ? "bg-ink-3/60" : "bg-ink")} /> : <span className={cx("h-2 w-3 rounded-[2px]", past ? "bg-dusk/35" : "bg-dusk/80")} />}
                  </span>
                  <span className={cx("min-w-0 truncate group-hover:text-dusk", past ? "text-ink-3" : "text-ink", r.done && "line-through decoration-ink-3/60")}>{r.title}</span>
                  <span className="text-xs text-ink-3">
                    {current ? <span className="font-medium text-saffron-ink">{t("الآن", "Now")}</span> : r.kind === "meeting" ? t("اجتماع", "Meeting") : t("محجوز", "Booked")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const clockOf = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ───────── المتابعات ─────────

function Followups({ meetings, today, loading }: { meetings: Meeting[]; today: string; loading: boolean }) {
  const { saveFollowups } = useMeetingActions();
  const from = addDays(today, -FOLLOWUP_WINDOW_DAYS);
  const open = meetings
    .filter((m) => m.day && m.day >= from && m.day <= today)
    .sort((a, b) => (a.day! < b.day! ? 1 : -1))
    .flatMap((m) => m.followups.filter((f) => !f.done && f.text.trim()).map((f) => ({ f, m })));
  const shown = open.slice(0, LIST_LIMIT);

  const setDone = (m: Meeting, id: string, done: boolean) =>
    saveFollowups.mutate({ id: m.id, followups: m.followups.map((f) => (f.id === id ? { ...f, done } : f)) });

  return (
    <section aria-labelledby="fu-title">
      <h2 id="fu-title" className="font-display text-lg font-semibold">
        {t("متابعات مفتوحة", "Open follow-ups")}
        {open.length > 0 && <span className="tnum ms-2 text-sm font-normal text-ink-3">{open.length}</span>}
      </h2>
      {loading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : open.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t("لا متابعات معلّقة من اجتماعات الأسبوعين الماضيين.", "Nothing left over from the last two weeks of meetings.")}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {shown.map(({ f, m }) => (
              <li key={f.id} className="flex items-start gap-2 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDone(m, f.id, true);
                    toast(t("أُنجزت", "Done"), { action: { label: t("تراجع", "Undo"), onClick: () => setDone(m, f.id, false) } });
                  }}
                  className="press -m-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:text-palm sm:size-8"
                  aria-label={t(`أنجزتُها: ${f.text}`, `Mark done: ${f.text}`)}
                  title={t("أنجزتُها", "Mark done")}
                >
                  <span className="inline-flex size-[18px] items-center justify-center rounded-[5px] border border-line-strong">
                    <Check className="size-3 opacity-0" strokeWidth={2.5} />
                  </span>
                </button>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="line-clamp-3 break-words text-sm">{f.text}</p>
                  <Link href={`/meetings/${m.id}`} className="mt-0.5 block truncate text-xs text-ink-3 hover:text-dusk">
                    {meetingTitle(m)}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {open.length > shown.length && (
            <p className="mt-2 text-xs text-ink-3">{t(`و${open.length - shown.length} غيرها في اجتماعاتها.`, `And ${open.length - shown.length} more in their meetings.`)}</p>
          )}
        </>
      )}
    </section>
  );
}

// ───────── قرارات بلا مالك ─────────

function Unowned({ meetings, loading }: { meetings: Meeting[]; loading: boolean }) {
  const list = decisionsOf(meetings).filter((d) => !d.owner);
  const shown = list.slice(0, LIST_LIMIT);
  return (
    <section aria-labelledby="un-title">
      <h2 id="un-title" className="font-display text-lg font-semibold">
        {t("قرارات بلا مالك", "Decisions without an owner")}
        {list.length > 0 && <span className="tnum ms-2 text-sm font-normal text-ember">{list.length}</span>}
      </h2>
      {loading ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : list.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t("كل قرار مكتوب له مالك.", "Every written decision has an owner.")}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {shown.map((d) => (
              <li key={d.id}>
                <Link href={`/meetings/${d.meetingId}`} className="group block py-2.5">
                  <span className="line-clamp-3 break-words text-sm group-hover:text-dusk">{d.decision}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {meetingTitle({ title: d.meetingTitle })}
                    {d.day && <span className="tnum">{`${t("، ", ", ")}${formatDay(d.day, { day: "numeric", month: "short" })}`}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/decisions" className="mt-2 inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-ink sm:min-h-0">
            {t("افتح سجلّ القرارات", "Open the decision log")}
          </Link>
        </>
      )}
    </section>
  );
}

// ───────── المساحات ─────────

const SPACES = [
  { href: "/meetings", ar: "الاجتماعات", en: "Meetings", hint: ["جهّز واعرض واكتب القرار", "Prepare, present, decide"] },
  { href: "/decisions", ar: "سجلّ القرارات", en: "Decision log", hint: ["كل قرار ومالكه", "Every decision and its owner"] },
  { href: "/status", ar: "تقرير الحالة", en: "Status report", hint: ["أسبوعك في صفحة", "Your week on one page"] },
  { href: "/time", ar: "إدارة الوقت", en: "Time", hint: ["ثلاثة إطارات مستقلة", "Three standalone frameworks"] },
  { href: "/waf/matrix", ar: "نظام واف", en: "The Waf system", hint: ["صنّف، احجز، ركّز", "Sort, book, focus"] },
] as const;

function Spaces() {
  return (
    <nav aria-labelledby="spaces-title" className="mt-16 border-t border-line pt-6">
      <h2 id="spaces-title" className="font-ui text-sm font-medium text-ink-2">
        {t("المساحات", "Spaces")}
      </h2>
      <ul className="mt-2 grid sm:grid-cols-3 lg:grid-cols-5">
        {SPACES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="group flex min-h-12 flex-col justify-center rounded-sm py-2 sm:pe-4">
              <span className="font-medium group-hover:text-dusk">{t(s.ar, s.en)}</span>
              <span className="text-xs text-ink-3">{t(s.hint[0], s.hint[1])}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
