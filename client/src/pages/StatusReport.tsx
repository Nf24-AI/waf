import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CalendarClock, CheckSquare, Gavel, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PLATFORM_ROUTE, meetingHref } from "@shared/routes";
import {
  buildStatusReport,
  lastSevenDays,
  reportIsEmpty,
  type Attention,
  type ReportMeeting,
} from "@shared/status-report";

/**
 * تقرير الحالة الأسبوعي.
 *
 * صفحة واحدة تُقرأ وتُرسَل كما هي. تُشتقّ من الاجتماعات، فلا شيء يُكتب هنا
 * ولا شيء يحتاج تحديثاً يدوياً — وكل سطر يعيدك إلى اجتماعه.
 *
 * ولا يكتب التقرير حكماً: لا «على المسار» ولا «تقدّم جيد». وقائع ومصادرها،
 * لأن التقرير الذي يفسّر بدل أن يذكر رأيٌ يُقدَّم على أنه حالة.
 */

const ATTENTION_LABEL: Record<Attention["kind"], string> = {
  "unowned-decision": "بلا مالك",
  "met-without-deciding": "بلا قرار",
  "overdue-draft": "مسودة فات موعدها",
};

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
      <span className="report-row-date">{meeting.date}</span>
      <span className="report-row-title">{meeting.title || "اجتماع بلا عنوان"}</span>
      <span className="report-row-tail">
        {meeting.type && <span className="report-tag">{meeting.type}</span>}
        {meeting.decisions > 0 && <span className="report-tag">{meeting.decisions} قرار</span>}
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

  const meetingsQuery = trpc.meetings.list.useQuery(undefined, { retry: false });

  const report = useMemo(
    () => buildStatusReport(meetingsQuery.data?.meetings ?? [], window),
    [meetingsQuery.data, window],
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
    <main className="platform-shell waf-dots" dir="rtl">
      <div className="platform-inner">
        <header className="platform-head">
          <Link className="decision-back" href={PLATFORM_ROUTE}>
            <ArrowRight size={14} aria-hidden="true" />
            خدمات واف
          </Link>
          <p className="service-eyebrow decision-eyebrow">STATUS REPORT</p>
          <h1 className="platform-section-title decision-title">تقرير الحالة</h1>
          <p className="platform-lede">
            ما انعقد وما تقرّر وما يحتاج انتباهاً، في صفحة واحدة تُرسَل كما هي. مُشتقّ من
            الاجتماعات، فلا شيء هنا يحتاج تحديثاً يدوياً.
          </p>

          <div className="report-window">
            <button className="report-nav" type="button" onClick={() => shiftWindow(-7)}>
              الأسبوع السابق
            </button>
            <span className="report-range">
              <CalendarClock size={13} aria-hidden="true" />
              {report.window.from} ← {report.window.to}
            </span>
            <button className="report-nav" type="button" onClick={() => shiftWindow(7)}>
              الأسبوع التالي
            </button>
            <button className="report-nav" type="button" onClick={() => setWindow(lastSevenDays())}>
              هذا الأسبوع
            </button>
          </div>
        </header>

        {meetingsQuery.isLoading ? (
          <div className="state-card decision-state">
            <div className="loading-orb" />
          </div>
        ) : meetingsQuery.isError ? (
          <div className="empty-state">
            <h4>تعذّر قراءة الاجتماعات</h4>
            <p>التقرير يُشتقّ من قاعدة الاجتماعات. تحقّق من الاتصال بـ Notion، ثم حدّث الصفحة.</p>
          </div>
        ) : reportIsEmpty(report) ? (
          <div className="empty-state">
            <h4>أسبوع هادئ</h4>
            <p>لا اجتماعات ولا قرارات في هذه الفترة. جرّب أسبوعاً آخر.</p>
          </div>
        ) : (
          <>
            <div className="report-stats">
              <Stat icon={<CalendarClock size={15} />} value={report.held.length} label="اجتماع" />
              <Stat icon={<Gavel size={15} />} value={report.decisions.length} label="قرار" />
              <Stat icon={<CheckSquare size={15} />} value={report.actions.length} label="مهمة" />
              <Stat icon={<Users size={15} />} value={report.people.length} label="مشارك" />
            </div>

            {/* ما يحتاج انتباهاً أولاً: هو سبب قراءة التقرير، لا خاتمته. */}
            <Section title="يحتاج انتباهاً" count={report.attention.length}>
              <div className="report-attention">
                {report.attention.map((item, index) => (
                  <Link
                    className="report-alert"
                    key={`${item.kind}-${item.meetingId}-${index}`}
                    href={meetingHref(item.meetingId)}
                  >
                    <AlertTriangle size={14} aria-hidden="true" className="report-alert-icon" />
                    <span className="report-alert-what">{item.what}</span>
                    <span className="report-alert-why">{ATTENTION_LABEL[item.kind]}</span>
                    <span className="report-alert-source">{item.meetingTitle}</span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section title="ما انعقد" count={report.held.length}>
              <div className="report-rows">
                {report.held.map((meeting) => (
                  <MeetingLine key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </Section>

            <Section title="ما تقرّر" count={report.decisions.length}>
              <div className="report-rows">
                {report.decisions.map((entry) => (
                  <Link className="report-row" key={entry.id} href={meetingHref(entry.meetingId)}>
                    <span className="report-row-date">{entry.date}</span>
                    <span className="report-row-title">{entry.decision}</span>
                    <span className="report-row-tail">
                      <span className="report-tag">{entry.owner || "بلا مالك"}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Section>

            <Section title="المهام" count={report.actions.length}>
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

            <Section title="القادم" count={report.upcoming.length}>
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
