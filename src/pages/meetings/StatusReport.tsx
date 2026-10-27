// تقرير الحالة: أسبوع تقويمي من الأحد إلى السبت، في صفحة واحدة تُرسَل أو تُطبع كما هي.
// حقائق فقط: ما انعقد، وما تقرّر، وما بقي، وما يحتاج انتباهاً. بلا أحكام.

import { Check, ChevronLeft, ChevronRight, Copy, Printer } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";
import { PageHead } from "@/app/AppShell";
import { useMeetings } from "@/data/hooks";
import type { Meeting } from "@/data/types";
import { formatClock, formatDay, pick, t, useLang } from "@/lib/i18n";
import { buildStatusReport, KIND_LABEL, type AttentionKind, type StatusReport as Report } from "@/lib/meetings";
import { addDays, dayOf, isDay, parseDay } from "@/lib/time";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Empty, Failure, Loading } from "@/ui/States";
import "./status-print.css";

/** الأحد الذي يبدأ به أسبوع اليوم المعطى */
function weekStart(day: string): string {
  return addDays(day, -parseDay(day).getDay());
}

const ATTENTION: Record<AttentionKind, [string, string]> = {
  "unowned-decision": ["بلا مالك", "No owner"],
  "met-without-deciding": ["بلا قرار", "No decision"],
  "overdue-draft": ["مسودة فات موعدها", "Overdue draft"],
};

/**
 * التقرير حقائق: ما لم يأتِ يومه بعد لا يُعدّ «انعقد». فيُبنى الأسبوع حتى اليوم فقط،
 * وما بعده يذهب إلى «القادم». والأسبوع المقبل كله قادم.
 */
function weekReport(meetings: Meeting[], from: string, to: string, today: string): Report {
  if (to <= today) return buildStatusReport(meetings, from, to);
  if (from <= today) return { ...buildStatusReport(meetings, from, today), to };
  const r = buildStatusReport(meetings, from, to);
  const upcoming = [...r.held.map((h) => h.meeting).filter((m) => m.status !== "done"), ...r.upcoming];
  upcoming.sort((a, b) => (a.day! + (a.startTime ?? "")).localeCompare(b.day! + (b.startTime ?? "")));
  return { ...r, held: [], decided: [], tasks: [], people: [], upcoming, attention: r.attention.filter((a) => a.kind === "overdue-draft") };
}

const titleOf = (m: Pick<Meeting, "title">) => m.title.trim() || t("اجتماع بلا عنوان", "Untitled meeting");

function rangeText(from: string, to: string): string {
  const a = parseDay(from);
  const b = parseDay(to);
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = formatDay(from, sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
  const right = formatDay(to, { day: "numeric", month: "long", year: "numeric" });
  return `${left} – ${right}`;
}

export default function StatusReport() {
  useLang();
  const q = useMeetings();
  const [, navigate] = useLocation();
  const search = new URLSearchParams(useSearch());
  const today = dayOf();
  const thisWeek = weekStart(today);
  const raw = search.get("week");
  const from = raw && isDay(raw) ? weekStart(raw) : thisWeek;
  const to = addDays(from, 6);
  const isThisWeek = from === thisWeek;

  const go = (start: string) => navigate(start === thisWeek ? "/status" : `/status?week=${start}`, { replace: true });
  const report = useMemo(() => (q.data ? weekReport(q.data, from, to, today) : null), [q.data, from, to, today]);

  const empty = report && report.held.length === 0 && report.decided.length === 0 && report.attention.length === 0 && report.upcoming.length === 0;

  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(plainText(report));
      toast.success(t("نُسخ التقرير", "Report copied"));
    } catch {
      toast.error(t("تعذّر النسخ. حدّد النص وانسخه يدوياً.", "Couldn’t copy. Select the text and copy it manually."));
    }
  }

  return (
    <div className="status-report">
      <PageHead
        back={{ href: "/meetings", label: t("الاجتماعات", "Meetings") }}
        title={t("تقرير الحالة", "Status report")}
        lede={t("ما انعقد وما تقرّر وما يحتاج انتباهاً، في صفحة واحدة تُرسَل كما هي.", "What met, what was decided and what needs attention, on one page you can send as is.")}
      />

      {/* نافذة الأسبوع */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3">
        <p className="tnum me-auto font-display text-lg font-semibold">
          <span className="sr-only">{t("الأسبوع: ", "Week: ")}</span>
          {rangeText(from, to)}
          {isThisWeek && <span className="ms-3 align-middle font-ui text-xs font-medium text-saffron-ink">{t("هذا الأسبوع", "This week")}</span>}
        </p>
        <nav aria-label={t("تنقّل بين الأسابيع", "Move between weeks")} className="no-print flex items-center gap-1">
          <button type="button" onClick={() => go(addDays(from, -7))} className="press inline-flex h-11 items-center gap-1 rounded-sm px-3 text-sm text-ink-2 hover:bg-sunk hover:text-ink sm:h-9">
            <ChevronRight className="size-4 ltr:rotate-180" strokeWidth={1.75} aria-hidden />
            {t("الأسبوع السابق", "Previous week")}
          </button>
          {!isThisWeek && (
            <button type="button" onClick={() => go(thisWeek)} className="press inline-flex h-11 items-center rounded-sm px-3 text-sm font-medium text-ink hover:bg-sunk sm:h-9">
              {t("هذا الأسبوع", "This week")}
            </button>
          )}
          <button type="button" onClick={() => go(addDays(from, 7))} className="press inline-flex h-11 items-center gap-1 rounded-sm px-3 text-sm text-ink-2 hover:bg-sunk hover:text-ink sm:h-9">
            {t("الأسبوع التالي", "Next week")}
            <ChevronLeft className="size-4 ltr:rotate-180" strokeWidth={1.75} aria-hidden />
          </button>
        </nav>
        {report && !empty && (
          <div className="no-print flex w-full gap-2 sm:w-auto sm:border-s sm:border-line sm:ps-3">
            <Button variant="quiet" onClick={copy} icon={<Copy className="size-4" strokeWidth={1.75} />} className="max-sm:h-11 max-sm:flex-1">
              {t("انسخ التقرير", "Copy report")}
            </Button>
            <Button variant="ghost" onClick={() => window.print()} icon={<Printer className="size-4" strokeWidth={1.75} />} className="max-sm:h-11">
              {t("اطبع", "Print")}
            </Button>
          </div>
        )}
      </div>

      {q.isPending ? (
        <Loading className="mt-8" />
      ) : q.isError ? (
        <Failure
          className="mt-8"
          title={t("تعذّر قراءة الاجتماعات.", "Couldn’t read your meetings.")}
          body={t("التقرير يُقرأ من الاجتماعات. تحقّق من الاتصال، ثم أعد المحاولة.", "The report reads from your meetings. Check your connection, then try again.")}
          onRetry={() => q.refetch()}
        />
      ) : empty || !report ? (
        <Empty title={t("أسبوع هادئ", "A quiet week")} body={t("لا اجتماعات ولا قرارات في هذه الفترة. جرّب أسبوعاً آخر.", "No meetings or decisions in this period. Try another week.")} />
      ) : (
        <Body report={report} />
      )}
    </div>
  );
}

function Body({ report }: { report: Report }) {
  const stats = [
    { n: report.held.length, label: t("اجتماع", "Meetings") },
    { n: report.decided.length, label: t("قرار", "Decisions") },
    { n: report.tasks.length, label: t("مهمة", "Tasks") },
    { n: report.people.length, label: t("مشارك", "People") },
  ];
  return (
    <>
      <dl className="status-stats mt-8 grid grid-cols-4 divide-x divide-line">
        {stats.map((s) => (
          <div key={s.label} className="px-3 first:ps-0 sm:px-6">
            <dd className="tnum font-display text-3xl font-semibold leading-none sm:text-4xl">{s.n}</dd>
            <dt className="mt-2 text-xs text-ink-2 sm:text-sm">{s.label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-10 space-y-10">
        <Section title={t("يحتاج انتباهاً", "Needs attention")} count={report.attention.length} tone="ember">
          {report.attention.map((a, i) => (
            <Row key={`${a.kind}-${a.meeting.id}-${i}`} href={`/meetings/${a.meeting.id}`} meta={a.kind === "unowned-decision" ? titleOf(a.meeting) : dateOf(a.meeting)}>
              <Tag tone="ember">{pick(ATTENTION[a.kind])}</Tag>
              <span className="min-w-0 break-words">{a.kind === "unowned-decision" ? a.text : titleOf(a.meeting)}</span>
            </Row>
          ))}
        </Section>

        <Section title={t("ما انعقد", "What met")} count={report.held.length}>
          {report.held.map(({ meeting: m, decisions }) => (
            <Row key={m.id} href={`/meetings/${m.id}`} meta={dateOf(m)}>
              <span className="min-w-0 break-words">{titleOf(m)}</span>
              <Tag>{pick(KIND_LABEL[m.kind])}</Tag>
              {decisions > 0 && <Tag tone="dusk">{t(`${decisions} قرار`, `${decisions} ${decisions === 1 ? "decision" : "decisions"}`)}</Tag>}
            </Row>
          ))}
        </Section>

        <Section title={t("ما تقرّر", "What was decided")} count={report.decided.length}>
          {report.decided.map((d) => (
            <Row key={d.id} href={`/meetings/${d.meetingId}`} meta={d.meetingTitle.trim() || t("اجتماع بلا عنوان", "Untitled meeting")}>
              <span className="min-w-0 break-words">{d.decision}</span>
              {d.owner ? <Tag tone="dusk">{d.owner}</Tag> : <Tag tone="ember">{t("بلا مالك", "No owner")}</Tag>}
            </Row>
          ))}
        </Section>

        <Section title={t("المهام", "Tasks")} count={report.tasks.length}>
          {report.tasks.map((x, i) => (
            <Row key={`${x.meeting.id}-${i}`} href={`/meetings/${x.meeting.id}`} meta={titleOf(x.meeting)}>
              <span className={cx("inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border", x.done ? "border-palm bg-palm text-bg" : "border-line-strong")} aria-hidden>
                {x.done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cx("min-w-0 break-words", x.done && "text-ink-3 line-through decoration-ink-3/50")}>{x.text}</span>
              <span className="sr-only">{x.done ? t("(منجزة)", "(done)") : t("(مفتوحة)", "(open)")}</span>
            </Row>
          ))}
        </Section>

        <Section title={t("القادم", "Coming up")} count={report.upcoming.length}>
          {report.upcoming.map((m) => (
            <Row key={m.id} href={`/meetings/${m.id}`} meta={dateOf(m)}>
              <span className="min-w-0 break-words">{titleOf(m)}</span>
              <Tag>{pick(KIND_LABEL[m.kind])}</Tag>
            </Row>
          ))}
        </Section>
      </div>
    </>
  );
}

const sep = () => t("، ", ", ");

function dateOf(m: Meeting): string {
  if (!m.day) return "";
  const d = formatDay(m.day, { weekday: "short", day: "numeric", month: "short" });
  return m.startTime ? `${d}${sep()}${formatClock(m.startTime)}` : d;
}

function Section({ title, count, tone, children }: { title: string; count: number; tone?: "ember"; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="status-section" aria-label={title}>
      <h2 className="flex items-baseline gap-2 font-display text-lg font-semibold">
        {title}
        <span className={cx("tnum font-ui text-sm font-normal", tone === "ember" ? "text-ember" : "text-ink-3")}>{count}</span>
      </h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">{children}</ul>
    </section>
  );
}

function Row({ href, meta, children }: { href: string; meta: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group grid min-h-12 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <span className="min-w-0 break-words group-hover:text-dusk [&>*]:me-2 [&>*]:align-middle">{children}</span>
        <span className="tnum truncate text-xs text-ink-3 sm:max-w-64 sm:text-end">{meta}</span>
      </Link>
    </li>
  );
}

function Tag({ tone, children }: { tone?: "ember" | "dusk"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "status-tag inline-flex max-w-full shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        tone === "ember" ? "bg-ember-wash text-ember" : tone === "dusk" ? "bg-dusk-wash text-dusk" : "bg-slate-wash text-slate",
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

// ───────── نسخة نصّية ─────────

function plainText(r: Report): string {
  const lines: string[] = [];
  const sec = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push("", `${title} (${items.length})`, ...items.map((x) => `- ${x}`));
  };
  lines.push(`${t("تقرير الحالة", "Status report")}: ${rangeText(r.from, r.to)}`);
  lines.push(
    t(
      `${r.held.length} اجتماع، ${r.decided.length} قرار، ${r.tasks.length} مهمة، ${r.people.length} مشارك`,
      `${r.held.length} meetings, ${r.decided.length} decisions, ${r.tasks.length} tasks, ${r.people.length} people`,
    ),
  );
  sec(
    t("يحتاج انتباهاً", "Needs attention"),
    r.attention.map((a) => `${pick(ATTENTION[a.kind])}: ${a.kind === "unowned-decision" ? `${a.text} (${titleOf(a.meeting)})` : titleOf(a.meeting)}`),
  );
  sec(
    t("ما انعقد", "What met"),
    r.held.map(({ meeting: m, decisions }) => [titleOf(m), dateOf(m), decisions ? t(`${decisions} قرار`, `${decisions} decisions`) : ""].filter(Boolean).join(sep())),
  );
  sec(
    t("ما تقرّر", "What was decided"),
    r.decided.map((d) => `${d.decision} (${d.owner || t("بلا مالك", "no owner")})`),
  );
  sec(
    t("المهام", "Tasks"),
    r.tasks.map((x) => `${x.done ? t("[منجزة] ", "[done] ") : ""}${x.text} (${titleOf(x.meeting)})`),
  );
  sec(
    t("القادم", "Coming up"),
    r.upcoming.map((m) => [titleOf(m), dateOf(m)].filter(Boolean).join(sep())),
  );
  return lines.join("\n");
}
