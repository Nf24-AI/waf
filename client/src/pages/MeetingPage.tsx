import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  Download,
  FileText,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatAgendaIndex } from "@shared/meeting";
import { toArabicDigits } from "@shared/meeting-date";
import { meetingFileName } from "@shared/meeting-pdf";
import type { SharedMeeting } from "@shared/meeting-share";
import { readUiSettings } from "./ui-settings";

/**
 * The words a shared page uses.
 *
 * A reader arrives with no workspace and no language preference, so the
 * shared page is Arabic and carries only the labels that survive read-only.
 */
const SHARED_COPY = {
  back: "",
  refresh: "",
  fullScreen: "ملء الشاشة",
  exitFullScreen: "الخروج من ملء الشاشة",
  pdf: "تنزيل PDF",
  pdfHint: "اختر «حفظ كملف PDF» في وجهة الطباعة، ثم شارك الملف.",
  goal: "هدف الاجتماع",
  topics: "محاور النقاش",
  actions: "نقاط متابعة",
  notes: "ملاحظات",
  attendees: "الحضور",
};
/**
 * The stage — what you read on your own screen while the meeting runs.
 *
 * Deliberately unlike the console: a light document on the `.waf-stage` scope.
 * Nothing paginates and nothing truncates, because the whole point is having
 * the context, the goal, the follow-ups and your notes in front of you at once.
 */
export function MeetingPage({
  meeting,
  note,
  onBack,
  onRefresh,
  onUpdateAgenda,
  copy = SHARED_COPY,
  language,
  readOnly = false,
}: {
  meeting: SharedMeeting;
  /**
   * The organiser's preparation notes.
   *
   * A prop rather than a field of `meeting`, because SharedMeeting has no
   * `note` to read: a shared page cannot pass this even by mistake.
   */
  note?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  onUpdateAgenda?: (
    index: number,
    field: "decision" | "owner",
    value: string
  ) => void;
  copy?: {
    back: string;
    refresh: string;
    fullScreen: string;
    exitFullScreen: string;
    pdf: string;
    pdfHint: string;
    goal: string;
    topics: string;
    actions: string;
    notes: string;
    attendees: string;
  };
  language: "ar" | "en";
  /**
   * Read-only is the shared page: no timer, no marking topics covered, no
   * editing the decision or the owner. Those are the presenter's tools, and
   * a reader holding a link is not presenting.
   */
  readOnly?: boolean;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [covered, setCovered] = useState<Set<number>>(new Set());
  const [activeTopic, setActiveTopic] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const isArabic = language === "ar";

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Ticks only while running, so a page left open overnight shows nothing odd.
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAt),
      1000
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenEnabled) {
      toast.info(
        isArabic
          ? "ملء الشاشة غير متاح في هذا المتصفح"
          : "Full screen is not available in this browser"
      );
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error(
        isArabic ? "تعذر فتح ملء الشاشة" : "Could not open full screen"
      );
    }
  };

  /**
   * Hand the meeting over as a PDF.
   *
   * This is the browser's own print pipeline rather than a canvas exporter:
   * nothing is rasterised, so the Arabic keeps its shaping and the text in the
   * saved file stays selectable, searchable and copyable. The only lever a
   * browser gives us over the saved name is document.title, so it is swapped
   * for the length of the job and put back after.
   */
  const downloadPdf = () => {
    const original = document.title;
    document.title = meetingFileName(meeting, language);

    const restore = () => {
      document.title = original;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    // Some browsers never fire afterprint if the dialog is dismissed with Esc.
    window.setTimeout(restore, 60_000);

    toast.info(copy.pdfHint);
    // A frame, so the hint has painted before the dialog blocks the page.
    window.setTimeout(() => window.print(), 120);
  };

  const toggleCovered = (index: number) => {
    setCovered(current => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else {
        next.add(index);
        // Move focus to the first topic still open.
        const following = meeting.agenda.findIndex(
          (_, i) => i !== index && !next.has(i)
        );
        if (following !== -1) setActiveTopic(following);
      }
      return next;
    });
  };

  const clock = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    const value = `${minutes}:${seconds}`;
    return isArabic ? toArabicDigits(value) : value;
  };

  const settings = readUiSettings();
  const empty = (text: string) => <p className="stage-empty">{text}</p>;
  const progress = meeting.agenda.length
    ? Math.round((covered.size / meeting.agenda.length) * 100)
    : 0;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={`display-shell waf-stage display-${settings.displayScale}`}
    >
      <header className="display-toolbar">
        {readOnly ? (
          <span className="display-brand-sub">اجتماع مُشارَك</span>
        ) : (
          <button className="display-back" onClick={onBack}>
            <ArrowLeft size={15} /> {copy.back}
          </button>
        )}
        <div className="display-brand">
          واف
          <span className="display-divider" />
          <span className="display-brand-sub">
            {isArabic ? "صفحة الاجتماع" : "Meeting page"}
          </span>
        </div>
        <div className="display-toolbar-actions">
          {!readOnly && (
          <button
            className={`display-tool ${startedAt !== null ? "running" : ""}`}
            onClick={() => setStartedAt(startedAt === null ? Date.now() : null)}
          >
            {startedAt === null ? <Play size={15} /> : <Pause size={15} />}
            <span>
              {startedAt === null
                ? isArabic
                  ? "ابدأ"
                  : "Start"
                : clock(elapsed)}
            </span>
          </button>
          )}
          <button className="display-tool" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{" "}
            <span>{isFullscreen ? copy.exitFullScreen : copy.fullScreen}</span>
          </button>
          <button className="display-tool" onClick={downloadPdf}>
            <Download size={15} /> <span>{copy.pdf}</span>
          </button>
          {!readOnly && (
          <button className="display-tool" onClick={onRefresh}>
            <Copy size={15} /> <span>{copy.refresh}</span>
          </button>
          )}
        </div>
      </header>

      {/* Live progress across the agenda — the sense of moving through a meeting. */}
      {!readOnly && meeting.agenda.length > 0 && (
        <div className="stage-progress">
          <div className="stage-progress-rail">
            {meeting.agenda.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                className={`stage-progress-seg ${covered.has(index) ? "covered" : ""} ${activeTopic === index ? "active" : ""}`}
                onClick={() => setActiveTopic(index)}
                aria-label={`${formatAgendaIndex(index)} ${item.title}`}
              />
            ))}
          </div>
          <span className="stage-progress-count">
            {isArabic
              ? `${toArabicDigits(covered.size)}/${toArabicDigits(meeting.agenda.length)} · ${toArabicDigits(progress)}٪`
              : `${covered.size}/${meeting.agenda.length} · ${progress}%`}
          </span>
        </div>
      )}

      <main className="stage-page">
        <div className="stage-eyebrow">
          <span className="selected-dot" />
          {meeting.type}
        </div>
        <h1 className="stage-title">{meeting.title}</h1>

        {meeting.image && (
          <figure className="stage-image">
            {/* Referenced by URL; a broken link should not break the page. */}
            <img
              src={meeting.image}
              alt=""
              loading="lazy"
              onError={event => {
                (
                  event.currentTarget.closest("figure") as HTMLElement
                ).style.display = "none";
              }}
            />
          </figure>
        )}

        <div className="stage-meta">
          <span>
            <CalendarDays size={15} />
            {meeting.date}
          </span>
          <span>
            <Clock3 size={15} />
            {meeting.time || (isArabic ? "الوقت غير محدد" : "Time not set")}
          </span>
          <span>
            <Users size={15} />
            {meeting.attendees.length
              ? meeting.attendees.join(isArabic ? "، " : ", ")
              : isArabic
                ? "لم تتم إضافة الحضور"
                : "No attendees yet"}
          </span>
        </div>

        <section className="stage-purpose">
          <span className="stage-label">
            <Target size={14} /> {copy.goal}
          </span>
          {meeting.summary ? (
            <p>{meeting.summary}</p>
          ) : (
            empty(isArabic ? "لم يُضف ملخص بعد." : "No summary yet.")
          )}
        </section>

        <section className="stage-section">
          <span className="stage-label">
            <FileText size={14} /> {copy.topics}
          </span>
          {meeting.agenda.length === 0 ? (
            empty(isArabic ? "لا محاور بعد." : "No topics yet.")
          ) : (
            <div className="stage-agenda">
              {meeting.agenda.map((item, index) => (
                <article
                  className={`stage-point ${covered.has(index) ? "covered" : ""} ${activeTopic === index ? "active" : ""}`}
                  key={`${item.title}-${index}`}
                  onFocus={() => setActiveTopic(index)}
                >
                  <span className="stage-number">
                    {formatAgendaIndex(index)}
                  </span>
                  <div>
                    <div className="stage-point-head">
                      <h3>{item.title}</h3>
                      {!readOnly && (
                      <button
                        className={`stage-cover ${covered.has(index) ? "on" : ""}`}
                        onClick={() => toggleCovered(index)}
                        aria-pressed={covered.has(index)}
                      >
                        {covered.has(index) ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <Circle size={14} />
                        )}
                        <span>
                          {covered.has(index)
                            ? isArabic
                              ? "نوقش"
                              : "Covered"
                            : isArabic
                              ? "علّم كمنجز"
                              : "Mark covered"}
                        </span>
                      </button>
                      )}
                    </div>

                    {item.context && (
                      <p className="stage-context">{item.context}</p>
                    )}
                    {item.goal && (
                      <span className="stage-goal">
                        <b>{isArabic ? "نريد الخروج بـ" : "Leave with"}</b>
                        {item.goal}
                      </span>
                    )}

                    {/* Written while the topic is live; saved with the meeting. */}
                    <div className="stage-decision">
                      <label>
                        <span>{isArabic ? "القرار" : "Decision"}</span>
                        {!readOnly && (
                        <Input
                          value={item.decision}
                          placeholder={
                            isArabic
                              ? "ما الذي اتُّفق عليه؟"
                              : "What was agreed?"
                          }
                          onChange={event =>
                            onUpdateAgenda?.(
                              index,
                              "decision",
                              event.target.value
                            )
                          }
                        />
                        )}
                        {/* An input prints as an empty box; this prints the value typed into it. Print only. */}
                        <p className={readOnly ? "stage-value" : "stage-print-value"}>
                          {item.decision || "—"}
                        </p>
                      </label>
                      <label className="stage-owner">
                        <span>{isArabic ? "المسؤول" : "Owner"}</span>
                        {!readOnly && (
                        <Input
                          value={item.owner}
                          placeholder={isArabic ? "من ينفّذه؟" : "Who owns it?"}
                          onChange={event =>
                            onUpdateAgenda?.(index, "owner", event.target.value)
                          }
                        />
                        )}
                        <p className={readOnly ? "stage-value" : "stage-print-value"}>{item.owner || "—"}</p>
                      </label>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="stage-columns">
          <section className="stage-block">
            <span className="stage-label">
              <Check size={14} /> {copy.actions}
            </span>
            {meeting.actions.length === 0 ? (
              empty(isArabic ? "لا نقاط متابعة." : "No follow-ups.")
            ) : (
              <ul className="stage-actions">
                {meeting.actions.map((action, index) => (
                  <li key={`${action}-${index}`}>
                    <span className="stage-checkbox" />
                    {action}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Never rendered on a shared page: `note` is not passed there,
              and SharedMeeting has no field it could be read from. */}
          {!readOnly && (
          <section className="stage-block">
            <span className="stage-label">
              <Sparkles size={14} /> {copy.notes}
            </span>
            {note ? (
              <p className="stage-note">{note}</p>
            ) : (
              empty(isArabic ? "لا ملاحظات." : "No notes.")
            )}
          </section>
          )}
        </div>

        <footer className="stage-footer">
          <span>واف</span>
          {meeting.link && (
            <a href={meeting.link} target="_blank" rel="noreferrer">
              {isArabic ? "المرجع الخارجي" : "External reference"}
            </a>
          )}
        </footer>
      </main>
    </div>
  );
}
