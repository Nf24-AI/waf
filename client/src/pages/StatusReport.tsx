import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckSquare, Gavel, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import LangToggle from "@/components/LangToggle";
import { dir, getLang, pair, pick, t, type Pair } from "@/lib/i18n";
import { SERVICES_ROUTE, meetingHref } from "@shared/routes";
import {
  buildStatusReport,
  lastSevenDays,
  reportIsEmpty,
  type Attention,
  type ReportMeeting,
} from "@shared/status-report";
import { fromIsoDate } from "@shared/meeting-date";

/**
 * تقرير الحالة الأسبوعي.
 *
 * صفحة واحدة تُقرأ وتُرسَل كما هي. تُشتقّ من الاجتماعات، فلا شيء يُكتب هنا
 * ولا شيء يحتاج تحديثاً يدوياً — وكل سطر يعيدك إلى اجتماعه.
 *
 * ولا يكتب التقرير حكماً: لا «على المسار» ولا «تقدّم جيد». وقائع ومصادرها،
 * لأن التقرير الذي يفسّر بدل أن يذكر رأيٌ يُقدَّم على أنه حالة.
 */

const ATTENTION_LABEL: Record<Attention["kind"], Pair> = {
  "unowned-decision": pair("بلا مالك", "No owner"),
  "met-without-deciding": pair("بلا قرار", "No decision"),
  "overdue-draft": pair("مسودة فات موعدها", "Overdue draft"),
};

function shownDate(date: string, isoDate: string | null) {
  return getLang() === "en" && isoDate ? fromIsoDate(isoDate, "en") : date;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="report-stat">
      <span className="report-stat-icon" aria-hidden="true">{icon}</span>
      <span className="report-stat-value">{value}</span>
      <span className="report-stat-label">{label}</span>
    </div>
  );
}

function MeetingLine({ meeting }: { meeting: ReportMeeting }) {
  return (
    <Link className="report-row" href={meetingHref(meeting.id)}>
      <span className="report-row-date">{shownDate(meeting.date, meeting.isoDate)}</span>
      <span className="report-row-title">{meeting.title || t("اجتماع بلا عنوان", "Untitled meeting")}</span>
      <span className="report-row-tail">
        {meeting.type && <span className="report-tag">{meeting.type}</span>}
        {meeting.decisions > 0 && (
          <span className="report-tag">
            {t(`${meeting.decisions} قرار`, meeting.decisions === 1 ? "1 decision" : `${meeting.decisions} decisions`)}
          </span>
        )}
      </span>
    </Link>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="report-section">
      <div className="platform-section-head">
        <h2 className="platform-section-title report-section-title">{title}</h2>
        <span className="platform-count">{count}</span>
      </div>
      {children}
    </section>
  );
}

export default function StatusReport() {
  const [window, setWindow] = useState(() => lastSevenDays());

  const lang = getLang();
  const Back = dir() === "rtl" ? ArrowRight : ArrowLeft;

  const meetingsQuery = trpc.meetings.list.useQuery(undefined, { retry: false });

  const report = useMemo(
    () => buildStatusReport(meetingsQuery.data?.meetings ?? [], window, lang),
    [meetingsQuery.data, window, lang],
  );

  const shiftWindow = (days: number) => {
    const move = (iso: string) => {
      const date = new Date(`${iso}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    setWindow({ from: move(window.from), to: move(window.to) });
  };

  return (
    <main className="platform-shell waf-dots" dir={dir()}>
      <div className="platform-inner">
        <header className="platform-head">
          <Link className="decision-back" href={SERVICES_ROUTE}>
            <Back size={14} aria-hidden="true" />
            {t("خدمات واف", "Waf services")}
          </Link>
          <LangToggle className="decision-back" />
          <p className="service-eyebrow decision-eyebrow">STATUS REPORT</p>
          <h1 className="platform-section-title decision-title">{t("تقرير الحالة", "Status report")}</h1>
          <p className="platform-lede">
            {t(
              "ما انعقد وما تقرّر وما يحتاج انتباهاً، في صفحة واحدة تُرسَل كما هي. مُشتقّ من الاجتماعات، فلا شيء هنا يحتاج تحديثاً يدوياً.",
              "What was held, what was decided and what needs attention, on one page you can send as is. It is derived from the meetings, so nothing here needs manual updating.",
            )}
          </p>

          <div className="report-window">
            <button className="report-nav" type="button" onClick={() => shiftWindow(-7)}>
              {t("الأسبوع السابق", "Previous week")}
            </button>
            <span className="report-range">
              <CalendarClock size={13} aria-hidden="true" />
              {report.window.from} {dir() === "rtl" ? "←" : "→"} {report.window.to}
            </span>
            <button className="report-nav" type="button" onClick={() => shiftWindow(7)}>
              {t("الأسبوع التالي", "Next week")}
            </button>
            <button className="report-nav" type="button" onClick={() => setWindow(lastSevenDays())}>
              {t("هذا الأسبوع", "This week")}
            </button>
          </div>
        </header>

        {meetingsQuery.isLoading ? (
          <div className="state-card decision-state">
            <div className="loading-orb" />
          </div>
        ) : meetingsQuery.isError ? (
          <div className="empty-state">
            <h4>{t("تعذّر قراءة الاجتماعات", "Could not read meetings")}</h4>
            <p>
              {t(
                "التقرير يُشتقّ من قاعدة الاجتماعات. تحقّق من الاتصال بـ Notion، ثم حدّث الصفحة.",
                "The report is derived from the meetings database. Check the Notion connection, then refresh the page.",
              )}
            </p>
          </div>
        ) : reportIsEmpty(report) ? (
          <div className="empty-state">
            <h4>{t("أسبوع هادئ", "A quiet week")}</h4>
            <p>
              {t(
                "لا اجتماعات ولا قرارات في هذه الفترة. جرّب أسبوعاً آخر.",
                "No meetings or decisions in this period. Try another week.",
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="report-stats">
              <Stat icon={<CalendarClock size={15} />} value={report.held.length} label={t("اجتماع", report.held.length === 1 ? "Meeting" : "Meetings")} />
              <Stat
                icon={<Gavel size={15} />}
                value={report.decisions.length}
                label={t("قرار", report.decisions.length === 1 ? "Decision" : "Decisions")}
              />
              <Stat icon={<CheckSquare size={15} />} value={report.actions.length} label={t("مهمة", report.actions.length === 1 ? "Task" : "Tasks")} />
              <Stat
                icon={<Users size={15} />}
                value={report.people.length}
                label={t("مشارك", report.people.length === 1 ? "Participant" : "Participants")}
              />
            </div>

            {/* ما يحتاج انتباهاً أولاً: هو سبب قراءة التقرير، لا خاتمته. */}
            <Section title={t("يحتاج انتباهاً", "Needs attention")} count={report.attention.length}>
              <div className="report-attention">
                {report.attention.map((item, index) => (
                  <Link
                    className="report-alert"
                    key={`${item.kind}-${item.meetingId}-${index}`}
                    href={meetingHref(item.meetingId)}
                  >
                    <AlertTriangle size={14} aria-hidden="true" className="report-alert-icon" />
                    <span className="report-alert-what">{item.what}</span>
                    <span className="report-alert-why">{pick(ATTENTION_LABEL[item.kind])}</span>
                    <span className="report-alert-source">{item.meetingTitle}</span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section title={t("ما انعقد", "Held")} count={report.held.length}>
              <div className="report-rows">
                {report.held.map((meeting) => (
                  <MeetingLine key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </Section>

            <Section title={t("ما تقرّر", "Decided")} count={report.decisions.length}>
              <div className="report-rows">
                {report.decisions.map((entry) => (
                  <Link className="report-row" key={entry.id} href={meetingHref(entry.meetingId)}>
                    <span className="report-row-date">{shownDate(entry.date, entry.isoDate)}</span>
                    <span className="report-row-title">{entry.decision}</span>
                    <span className="report-row-tail">
                      <span className="report-tag">{entry.owner || t("بلا مالك", "No owner")}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section title={t("المهام", "Tasks")} count={report.actions.length}>
              <div className="report-rows">
                {report.actions.map((action, index) => (
                  <Link
                    className="report-row"
                    key={`${action.meetingId}-${index}`}
                    href={meetingHref(action.meetingId)}
                  >
                    <span className="report-row-date" aria-hidden="true" />
                    <span className="report-row-title">{action.text}</span>
                    <span className="report-row-tail">
                      <span className="report-tag">{action.meetingTitle}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section title={t("القادم", "Upcoming")} count={report.upcoming.length}>
              <div className="report-rows">
                {report.upcoming.map((meeting) => (
                  <MeetingLine key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
