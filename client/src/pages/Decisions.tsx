import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CalendarDays, Search, UserRound, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import LangToggle from "@/components/LangToggle";
import { dir, getLang, t } from "@/lib/i18n";
import { MEETING_ROUTES, SERVICES_ROUTE, meetingHref } from "@shared/routes";
import {
  collectDecisions,
  decisionOwners,
  filterDecisions,
  unownedCount,
  type DecisionEntry,
} from "@shared/decisions";
import { fromIsoDate } from "@shared/meeting-date";

/**
 * سجلّ القرارات.
 *
 * يقرأ من الاجتماعات نفسها — لا قاعدة بيانات ثانية تتباعد عنها. لهذا هو
 * للقراءة لا للتحرير: القرار يُكتب حيث اتُّخذ، في بند جدول الأعمال، وكل بطاقة
 * هنا تعيدك إلى اجتماعها.
 */

function DecisionCard({ entry }: { entry: DecisionEntry }) {
  const Back = dir() === "rtl" ? ArrowRight : ArrowLeft;
  const date = getLang() === "en" && entry.isoDate ? fromIsoDate(entry.isoDate, "en") : entry.date;

  return (
    <article className="decision-card">
      <p className="decision-text">{entry.decision}</p>

      <div className="decision-meta">
        {entry.topic && <span className="decision-topic">{entry.topic}</span>}

        <span className="decision-chip">
          <UserRound size={12} aria-hidden="true" />
          {entry.owner || <span className="decision-unowned">{t("بلا مالك", "No owner")}</span>}
        </span>

        {date && (
          <span className="decision-chip">
            <CalendarDays size={12} aria-hidden="true" />
            {date}
          </span>
        )}

        {entry.attendees.length > 0 && (
          <span className="decision-chip" title={entry.attendees.join(t("، ", ", "))}>
            <Users size={12} aria-hidden="true" />
            {entry.attendees.length}
          </span>
        )}
      </div>

      {entry.context && <p className="decision-context">{entry.context}</p>}

      {/* القرار يُحرَّر في اجتماعه لا هنا، فالرابط يعيدك إلى مصدره. */}
      <Link className="decision-source" href={meetingHref(entry.meetingId)}>
        <Back size={13} aria-hidden="true" />
        {entry.meetingTitle || t("الاجتماع", "Meeting")}
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
  const Back = dir() === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <main className="platform-shell waf-dots" dir={dir()}>
      <div className="platform-inner">
        <header className="platform-head">
          <Link className="decision-back" href={SERVICES_ROUTE}>
            <Back size={14} aria-hidden="true" />
            {t("خدمات واف", "Waf services")}
          </Link>
          <LangToggle className="decision-back" />
          <p className="service-eyebrow decision-eyebrow">DECISION LOG</p>
          <h1 className="platform-section-title decision-title">{t("سجلّ القرارات", "Decision log")}</h1>
          <p className="platform-lede">
            {t(
              "كل قرار اتُّخذ في اجتماع، ومن يملكه ومتى. يُقرأ من الاجتماعات نفسها، فما تكتبه هناك يظهر هنا دون خطوة إضافية.",
              "Every decision taken in a meeting, who owns it and when. It is read from the meetings themselves, so what you write there shows up here with no extra step.",
            )}
          </p>
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
                "السجلّ يقرأ من قاعدة الاجتماعات. تحقّق من الاتصال بـ Notion، ثم حدّث الصفحة.",
                "The log reads from the meetings database. Check the Notion connection, then refresh the page.",
              )}
            </p>
          </div>
        ) : all.length === 0 ? (
          <div className="empty-state">
            <h4>{t("لا قرارات بعد", "No decisions yet")}</h4>
            <p>
              {t(
                "القرار يُكتب في بند جدول الأعمال أثناء الاجتماع. أول قرار تكتبه هناك يظهر هنا.",
                "A decision is written in the agenda item during the meeting. The first one you write there shows up here.",
              )}
            </p>
            <Link className="decision-source" href={MEETING_ROUTES.prepare}>
              <Back size={13} aria-hidden="true" />
              {t("خدمة الاجتماعات", "Meetings service")}
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
                  placeholder={t("ابحث في القرارات…", "Search decisions…")}
                  aria-label={t("بحث في القرارات", "Search decisions")}
                />
              </div>

              <select
                className="decision-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                aria-label={t("تصفية بالمالك", "Filter by owner")}
              >
                <option value="">{t("كل المالكين", "All owners")}</option>
                {owners.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <p className="decision-count">
                {t(`${shown.length} من ${all.length}`, `${shown.length} of ${all.length}`)}
                {/* رقم يستحق الظهور: قرار بلا مالك لن يتحرّك من نفسه. */}
                {unowned > 0 && !filtering && (
                  <span className="decision-warn"> · {t(`${unowned} بلا مالك`, `${unowned} with no owner`)}</span>
                )}
              </p>
            </div>

            {shown.length === 0 ? (
              <div className="empty-state">
                <h4>{t("لا قرارات مطابقة", "No matching decisions")}</h4>
                <p>{t("جرّب كلمة أخرى، أو أزل التصفية.", "Try another word, or clear the filter.")}</p>
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
