import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CalendarDays, Search, UserRound, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MEETING_ROUTES, PLATFORM_ROUTE } from "@shared/routes";
import {
  collectDecisions,
  decisionOwners,
  filterDecisions,
  unownedCount,
  type DecisionEntry,
} from "@shared/decisions";

/**
 * سجلّ القرارات.
 *
 * يقرأ من الاجتماعات نفسها — لا قاعدة بيانات ثانية تتباعد عنها. لهذا هو
 * للقراءة لا للتحرير: القرار يُكتب حيث اتُّخذ، في بند جدول الأعمال، وكل بطاقة
 * هنا تعيدك إلى اجتماعها.
 */

function DecisionCard({ entry }: { entry: DecisionEntry }) {
  return (
    <article className="decision-card">
      <p className="decision-text">{entry.decision}</p>

      <div className="decision-meta">
        {entry.topic && <span className="decision-topic">{entry.topic}</span>}

        <span className="decision-chip">
          <UserRound size={12} aria-hidden="true" />
          {entry.owner || <span className="decision-unowned">بلا مالك</span>}
        </span>

        {entry.date && (
          <span className="decision-chip">
            <CalendarDays size={12} aria-hidden="true" />
            {entry.date}
          </span>
        )}

        {entry.attendees.length > 0 && (
          <span className="decision-chip" title={entry.attendees.join("، ")}>
            <Users size={12} aria-hidden="true" />
            {entry.attendees.length}
          </span>
        )}
      </div>

      {entry.context && <p className="decision-context">{entry.context}</p>}

      {/* القرار يُحرَّر في اجتماعه لا هنا، فالرابط يعيدك إلى مصدره. */}
      <Link className="decision-source" href={MEETING_ROUTES.prepare}>
        <ArrowRight size={13} aria-hidden="true" />
        {entry.meetingTitle || "الاجتماع"}
        {entry.meetingType && <span className="decision-source-type">{entry.meetingType}</span>}
      </Link>
    </article>
  );
}

export default function Decisions() {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");

  const meetingsQuery = trpc.meetings.list.useQuery(undefined, { retry: false });

  const all = useMemo(
    () => collectDecisions(meetingsQuery.data?.meetings ?? []),
    [meetingsQuery.data],
  );
  const owners = useMemo(() => decisionOwners(all), [all]);
  const shown = useMemo(() => filterDecisions(all, { query, owner }), [all, query, owner]);
  const unowned = useMemo(() => unownedCount(all), [all]);

  const filtering = query.trim() !== "" || owner !== "";

  return (
    <main className="platform-shell waf-dots" dir="rtl">
      <div className="platform-inner">
        <header className="platform-head">
          <Link className="decision-back" href={PLATFORM_ROUTE}>
            <ArrowRight size={14} aria-hidden="true" />
            خدمات واف
          </Link>
          <p className="service-eyebrow decision-eyebrow">DECISION LOG</p>
          <h1 className="platform-section-title decision-title">سجلّ القرارات</h1>
          <p className="platform-lede">
            كل قرار اتُّخذ في اجتماع، ومن يملكه ومتى. يُقرأ من الاجتماعات نفسها، فما تكتبه هناك يظهر
            هنا دون خطوة إضافية.
          </p>
        </header>

        {meetingsQuery.isLoading ? (
          <div className="state-card decision-state">
            <div className="loading-orb" />
          </div>
        ) : meetingsQuery.isError ? (
          <div className="empty-state">
            <h4>تعذّر قراءة الاجتماعات</h4>
            <p>السجلّ يقرأ من قاعدة الاجتماعات. تحقّق من الاتصال بـ Notion، ثم حدّث الصفحة.</p>
          </div>
        ) : all.length === 0 ? (
          <div className="empty-state">
            <h4>لا قرارات بعد</h4>
            <p>
              القرار يُكتب في بند جدول الأعمال أثناء الاجتماع. أول قرار تكتبه هناك يظهر هنا.
            </p>
            <Link className="decision-source" href={MEETING_ROUTES.prepare}>
              <ArrowRight size={13} aria-hidden="true" />
              خدمة الاجتماعات
            </Link>
          </div>
        ) : (
          <>
            <div className="decision-controls">
              <div className="search-field decision-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث في القرارات…"
                  aria-label="بحث في القرارات"
                />
              </div>

              <select
                className="decision-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                aria-label="تصفية بالمالك"
              >
                <option value="">كل المالكين</option>
                {owners.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <p className="decision-count">
                {shown.length} من {all.length}
                {/* رقم يستحق الظهور: قرار بلا مالك لن يتحرّك من نفسه. */}
                {unowned > 0 && !filtering && (
                  <span className="decision-warn"> · {unowned} بلا مالك</span>
                )}
              </p>
            </div>

            {shown.length === 0 ? (
              <div className="empty-state">
                <h4>لا قرارات مطابقة</h4>
                <p>جرّب كلمة أخرى، أو أزل التصفية.</p>
              </div>
            ) : (
              <div className="decision-list">
                {shown.map((entry) => (
                  <DecisionCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
