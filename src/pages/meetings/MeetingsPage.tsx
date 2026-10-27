// مساحة الاجتماعات: القائمة على جانب، والاجتماع المختار في محرّره على الجانب الآخر.
// على الجوّال القائمة وحدها، والضغط على اجتماع يفتحه في صفحته.

import * as DM from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, ChevronDown, FileText, Plus, ScrollText, Search } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMeetingActions, useMeetings } from "@/data/hooks";
import type { Meeting, MeetingStatus } from "@/data/types";
import { t } from "@/lib/i18n";
import { decisionsOf } from "@/lib/meetings";
import { PageHead } from "@/app/AppShell";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { useNow } from "@/ui/DayLine";
import { Segmented, Select, control } from "@/ui/Field";
import { Empty, Failure, Loading, Skeleton } from "@/ui/States";
import { Editor, markJustCreated } from "./Editor";
import { STATUS_TONE, dayLabel, groupByDay, inScope, isLive, matches, meetingsCount, nextMeeting, statusLabel, templates, timeRange, titleOf, type Scope, type TemplateId } from "./model";
import "./meetings.css";

const SCOPE_KEY = "waf:meetings-scope";

function readScope(): Scope {
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    return v === "past" || v === "all" ? v : "upcoming";
  } catch {
    return "upcoming";
  }
}

export default function MeetingsPage({ id }: { id?: string }) {
  const { data, isLoading, error, refetch } = useMeetings();
  const now = useNow(60_000);
  const meetings = data ?? [];
  const selected = id ? meetings.find((m) => m.id === id) : nextMeeting(meetings, now);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cx(id && "max-lg:hidden")}>
        <PageHead
          title={t("الاجتماعات", "Meetings")}
          lede={t("جهّز الاجتماع، اعرضه على الشاشة، واخرج منه بقرار له مالك.", "Prepare the meeting, present it on screen, and leave with decisions that have owners.")}
          actions={meetings.length > 0 && <NewMeetingMenu />}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
          <Loading className="max-lg:hidden" />
        </div>
      ) : error ? (
        <Failure title={t("تعذّرت قراءة الاجتماعات", "Couldn’t load your meetings")} body={t("تحقّق من الاتصال ثم أعد المحاولة.", "Check your connection, then try again.")} onRetry={() => refetch()} />
      ) : meetings.length === 0 ? (
        <FirstMeeting />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] xl:gap-10">
          <MeetingList meetings={meetings} selectedId={selected?.id} desktopOnly={!id} now={now} className={cx(id && "max-lg:hidden")} />
          <section className={cx("min-w-0", !id && "max-lg:hidden")} aria-label={t("الاجتماع المختار", "Selected meeting")}>
            <Link href="/meetings" className="press -ms-2 mb-3 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm text-ink-2 hover:text-ink lg:hidden">
              <ArrowLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
              {t("كل الاجتماعات", "All meetings")}
            </Link>
            {selected ? (
              <Editor key={selected.id} meeting={selected} />
            ) : (
              <Empty
                title={t("لم نجد هذا الاجتماع", "We couldn’t find this meeting")}
                body={t("ربما أُرشف أو تغيّر رابطه. اختر اجتماعاً من القائمة.", "It may have been archived or its link changed. Pick a meeting from the list.")}
              />
            )}
          </section>
        </div>
      )}
    </MotionConfig>
  );
}

// ───────── إنشاء ─────────

function useCreate() {
  const actions = useMeetingActions();
  const [, navigate] = useLocation();
  return {
    pending: actions.create.isPending,
    create: (template: TemplateId | "blank") => {
      const fields = template === "blank" ? { title: "" } : templates().find((x) => x.id === template)!.fields;
      actions.create.mutate(fields, {
        onSuccess: (m) => {
          markJustCreated(m.id);
          navigate(`/meetings/${m.id}`);
        },
      });
    },
  };
}

function NewMeetingMenu() {
  const { create, pending } = useCreate();
  return (
    <DM.Root dir={document.documentElement.dir as "rtl" | "ltr"}>
      <DM.Trigger asChild>
        <Button variant="solid" disabled={pending} icon={<Plus className="size-4" strokeWidth={2} />} className="max-sm:h-11">
          {t("اجتماع جديد", "New meeting")}
          <ChevronDown className="-me-1 size-4 opacity-70" strokeWidth={1.75} />
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} collisionPadding={12} className="mt-pop z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-md border border-line bg-sheet p-1.5 shadow-[var(--shadow-float)]">
          <DM.Item onSelect={() => create("blank")} className="flex cursor-pointer flex-col rounded-sm px-3 py-2.5 outline-none data-[highlighted]:bg-sunk">
            <span className="text-sm font-medium">{t("اجتماع فارغ", "Blank meeting")}</span>
            <span className="text-xs text-ink-3">{t("تبدأ من الصفر، وخطوات التحضير ترشدك.", "Start from scratch; the preparation steps guide you.")}</span>
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Label className="px-3 pb-1 pt-2 text-xs text-ink-3">{t("أو ابدأ بقالب", "Or start from a template")}</DM.Label>
          {templates().map((tpl) => (
            <DM.Item key={tpl.id} onSelect={() => create(tpl.id)} className="flex cursor-pointer flex-col rounded-sm px-3 py-2.5 outline-none data-[highlighted]:bg-sunk">
              <span className="text-sm font-medium">{tpl.name}</span>
              <span className="text-xs text-ink-3">{tpl.line}</span>
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

/** لا اجتماعات بعد: القوالب نفسها هي الدعوة */
function FirstMeeting() {
  const { create, pending } = useCreate();
  return (
    <div className="border-t border-line pt-8">
      <Empty title={t("لا اجتماعات بعد", "No meetings yet")} body={t("ابدأ بقالب يناسب اجتماعك القادم، أو باجتماع فارغ. كل شيء يُحفظ وأنت تكتب.", "Start from a template that fits your next meeting, or a blank one. Everything saves as you type.")} className="pt-0" />
      <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {templates().map((tpl) => (
          <li key={tpl.id} className="bg-sheet">
            <button type="button" disabled={pending} onClick={() => create(tpl.id)} className="press flex h-full w-full flex-col items-start gap-1 p-5 text-start hover:bg-sunk/50">
              <span className="font-display text-lg font-semibold">{tpl.name}</span>
              <span className="text-sm text-ink-2">{tpl.line}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="quiet" className="mt-4 max-sm:h-11" disabled={pending} icon={<Plus className="size-4" />} onClick={() => create("blank")}>
        {t("اجتماع فارغ", "Blank meeting")}
      </Button>
    </div>
  );
}

// ───────── القائمة ─────────

function MeetingList({ meetings, selectedId, desktopOnly, now, className }: { meetings: Meeting[]; selectedId?: string; desktopOnly: boolean; now: Date; className?: string }) {
  const [scope, setScopeState] = useState<Scope>(readScope);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | MeetingStatus>("all");
  const setScope = (s: Scope) => {
    setScopeState(s);
    try {
      localStorage.setItem(SCOPE_KEY, s);
    } catch {
      /* بلا تخزين */
    }
  };

  const pastCount = useMemo(() => inScope(meetings, "past").length, [meetings]);
  const upcomingCount = meetings.length - pastCount;
  const list = useMemo(() => inScope(meetings, scope).filter((m) => (status === "all" || m.status === status) && matches(m, q)), [meetings, scope, status, q]);
  const groups = groupByDay(list);
  const decisions = useMemo(() => decisionsOf(meetings).length, [meetings]);
  const filtered = q.trim() !== "" || status !== "all";

  return (
    <aside className={cx("flex min-w-0 flex-col lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100dvh-7rem)]", className)} aria-label={t("قائمة الاجتماعات", "Meeting list")}>
      <Segmented<Scope>
        label={t("أيّ الاجتماعات", "Which meetings")}
        value={scope}
        onChange={setScope}
        className="w-full [&>button]:flex-1 max-sm:[&>button]:h-10"
        options={[
          { value: "upcoming", label: <ScopeLabel text={t("القادمة", "Upcoming")} n={upcomingCount} /> },
          { value: "past", label: <ScopeLabel text={t("السابقة", "Past")} n={pastCount} /> },
          { value: "all", label: t("الكل", "All") },
        ]}
      />
      <div className="mt-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("ابحث في الاجتماعات", "Search meetings")}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث بالعنوان أو الاسم", "Search by title or name")} enterKeyHint="search" className={cx(control, "h-10 ps-9 max-sm:h-11")} />
        </label>
        <div className="w-[8.5rem] shrink-0">
        <Select value={status} onChange={(e) => setStatus(e.target.value as "all" | MeetingStatus)} aria-label={t("الحالة", "Status")} className="max-sm:h-11">
          <option value="all">{t("كل الحالات", "Any status")}</option>
          <option value="draft">{statusLabel("draft")}</option>
          <option value="ready">{statusLabel("ready")}</option>
          <option value="done">{statusLabel("done")}</option>
        </Select>
        </div>
      </div>

      <div className="scroll-thin -mx-2 mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 lg:-me-3 lg:pe-3">
        {list.length === 0 ? (
          <div className="py-8">
            <p className="font-medium">{filtered ? t("لا اجتماعات مطابقة", "No matching meetings") : scope === "past" ? t("لا اجتماعات سابقة", "No past meetings") : t("لا اجتماعات قادمة", "No upcoming meetings")}</p>
            <p className="mt-1 text-sm text-ink-2">
              {filtered ? t("جرّب كلمة أخرى أو حالة أخرى.", "Try another word or status.") : scope === "past" ? t("ما تعقده من اجتماعات يظهر هنا بعد يومه.", "Meetings you hold show up here after their day.") : t("أنشئ اجتماعاً جديداً من الزر أعلاه.", "Create a new meeting with the button above.")}
            </p>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                }}
                className="press mt-3 h-10 rounded-sm px-3 text-sm font-medium text-dusk hover:bg-dusk-wash"
              >
                {t("امسح البحث", "Clear search")}
              </button>
            )}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.day ?? "none"} className="pb-2">
              <h3 className="sticky top-0 z-[1] bg-bg px-3 pb-1.5 pt-3 font-ui text-xs font-medium text-ink-3">{g.day ? dayLabel(g.day, { weekday: "long", day: "numeric", month: "long" }) : t("بلا تاريخ", "No date")}</h3>
              <ul>
                {g.items.map((m) => (
                  <li key={m.id}>
                    <Row meeting={m} selected={m.id === selectedId} desktopOnly={desktopOnly} live={isLive(m, now)} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <nav className="mt-3 border-t border-line pt-3" aria-label={t("مخرجات الاجتماعات", "What meetings produce")}>
        <OutputLink href="/decisions" icon={<ScrollText className="size-[18px]" strokeWidth={1.75} />} name={t("سجلّ القرارات", "Decision log")} meta={decisions ? t(decisions === 1 ? "قرار واحد" : decisions === 2 ? "قراران" : decisions <= 10 ? `${decisions} قرارات` : `${decisions} قراراً`, `${decisions} decided`) : undefined} />
        <OutputLink href="/status" icon={<FileText className="size-[18px]" strokeWidth={1.75} />} name={t("تقرير الحالة الأسبوعي", "Weekly status report")} />
        <p className="sr-only">{meetingsCount(meetings.length)}</p>
      </nav>
    </aside>
  );
}

function ScopeLabel({ text, n }: { text: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      {n > 0 && <span className="tnum text-[11px] text-ink-3">{n}</span>}
    </span>
  );
}

/** الاجتماع المفتوح افتراضياً يُبرز على الحاسب فقط، فالجوّال يعرض القائمة وحدها */
function Row({ meeting: m, selected, desktopOnly, live }: { meeting: Meeting; selected: boolean; desktopOnly: boolean; live: boolean }) {
  const time = timeRange(m);
  return (
    <Link
      href={`/meetings/${m.id}`}
      aria-current={selected && !desktopOnly ? "page" : undefined}
      className={cx(
        "group relative flex min-h-14 gap-3 rounded-md px-3 py-2.5 transition-colors duration-150",
        selected && (desktopOnly ? "lg:bg-sheet lg:shadow-[inset_0_0_0_1px_var(--line)]" : "bg-sheet shadow-[inset_0_0_0_1px_var(--line)]"),
        !selected || desktopOnly ? "hover:bg-sunk/70" : "",
      )}
    >
      {selected && <span className={cx("absolute inset-y-3 start-0 w-0.5 rounded-full bg-ink", desktopOnly && "max-lg:hidden")} aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className={cx("line-clamp-2 text-sm leading-snug [overflow-wrap:anywhere]", selected ? "font-medium text-ink" : "text-ink", !m.title.trim() && "text-ink-3")}>
          <bdi>{titleOf(m)}</bdi>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
          <span className="tnum">{time ?? t("الوقت غير محدد", "No time set")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cx("size-1.5 rounded-full", STATUS_TONE[m.status].dot)} aria-hidden />
            {statusLabel(m.status)}
          </span>
        </p>
      </div>
      {live && (
        <span className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full bg-saffron-wash px-2 text-[11px] font-medium text-saffron-ink">
          <span className="size-1.5 rounded-full bg-saffron" aria-hidden />
          {t("الآن", "Now")}
        </span>
      )}
    </Link>
  );
}

function OutputLink({ href, icon, name, meta }: { href: string; icon: ReactNode; name: string; meta?: string }) {
  return (
    <Link href={href} className="press flex h-11 items-center gap-3 rounded-sm px-2 text-sm text-ink-2 hover:bg-sunk hover:text-ink">
      <span className="text-ink-3">{icon}</span>
      <span className="flex-1">{name}</span>
      {meta && <span className="tnum text-xs text-ink-3">{meta}</span>}
      <ArrowLeft className="size-4 text-ink-3 ltr:-scale-x-100" strokeWidth={1.75} />
    </Link>
  );
}
