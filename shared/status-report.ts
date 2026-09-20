import type { MeetingRecord } from "./meeting-store";
import { toIsoDate } from "./meeting-date";
import { collectDecisions, type DecisionEntry } from "./decisions";

/**
 * تقرير الحالة الأسبوعي.
 *
 * مثل سجلّ القرارات، لا قاعدة بيانات له: كل ما يحتاجه مدير المشروع في تقريره
 * موجود في الاجتماعات — ما انعقد، وما قُرّر فيه، وما خرج منه من مهام، وما
 * ينتظر. التقرير يجمعها في نافذة زمنية ويعرضها.
 *
 * ولا يكتب سرداً: لا «تقدّم جيد» ولا «على المسار». كل سطر فيه واقعة ومصدرها،
 * لأن التقرير الذي يفسّر بدل أن يذكر هو رأي يُقدَّم على أنه حالة.
 */

export interface ReportWindow {
  /** ISO، شامل. */
  from: string;
  /** ISO، شامل. */
  to: string;
}

/** اجتماع دخل النافذة، بتاريخه المقروء. */
export interface ReportMeeting {
  id: string;
  title: string;
  type: string;
  date: string;
  isoDate: string;
  status: MeetingRecord["status"];
  attendees: number;
  decisions: number;
  actions: string[];
}

/** واقعة تستحق انتباه مدير المشروع، ومعها سببها ومصدرها. */
export interface Attention {
  kind: "unowned-decision" | "met-without-deciding" | "overdue-draft";
  what: string;
  why: string;
  meetingId: string;
  meetingTitle: string;
}

export interface StatusReport {
  window: ReportWindow;
  /** ما انعقد داخل النافذة. */
  held: ReportMeeting[];
  /** ما تقرّر داخل النافذة. */
  decisions: DecisionEntry[];
  /** المهام التي خرجت من اجتماعات النافذة، بمصدرها. */
  actions: { text: string; meetingId: string; meetingTitle: string }[];
  /** ما يحتاج قراراً أو مالكاً أو متابعة. */
  attention: Attention[];
  /** المجدول بعد نهاية النافذة. */
  upcoming: ReportMeeting[];
  /** من حضر داخل النافذة، بلا تكرار. */
  people: string[];
}

const clean = (value: string | undefined) => (value ?? "").trim();

/** النافذة الافتراضية: الأيام السبعة المنتهية اليوم، شاملةً اليوم نفسه. */
export function lastSevenDays(today: Date = new Date()): ReportWindow {
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

const withinWindow = (iso: string | null, window: ReportWindow) =>
  iso !== null && iso >= window.from && iso <= window.to;

function toReportMeeting(meeting: MeetingRecord, iso: string): ReportMeeting {
  return {
    id: meeting.id,
    title: clean(meeting.title),
    type: clean(meeting.type),
    date: clean(meeting.date),
    isoDate: iso,
    status: meeting.status,
    attendees: meeting.attendees.filter((name) => clean(name) !== "").length,
    decisions: meeting.agenda.filter((item) => clean(item.decision) !== "").length,
    actions: meeting.actions.map(clean).filter(Boolean),
  };
}

/**
 * يُبنى التقرير من الاجتماعات وحدها.
 *
 * اجتماع بتاريخ غير مقروء لا يدخل أي نافذة — ليس إهمالاً بل لأن التقرير
 * وعدُه «هذه الفترة»، وإدخال ما لا يُعرف زمنه يكسر الوعد. مثل هذه الاجتماعات
 * تظهر في سجلّ القرارات وفي قائمة الاجتماعات، فلا تختفي من المنتج.
 */
export function buildStatusReport(
  meetings: readonly MeetingRecord[],
  window: ReportWindow,
): StatusReport {
  const held: ReportMeeting[] = [];
  const upcoming: ReportMeeting[] = [];
  const actions: StatusReport["actions"] = [];
  const attention: Attention[] = [];
  const people = new Set<string>();

  for (const meeting of meetings) {
    const iso = toIsoDate(meeting.date);
    if (iso === null) continue;

    if (iso > window.to) {
      if (meeting.status !== "تم الاجتماع") upcoming.push(toReportMeeting(meeting, iso));
      continue;
    }

    if (!withinWindow(iso, window)) {
      // خارج النافذة وفي الماضي: لا يدخل التقرير إلا كمسودة فات موعدها.
      if (meeting.status === "مسودة") {
        attention.push({
          kind: "overdue-draft",
          what: clean(meeting.title) || "اجتماع بلا عنوان",
          why: "مسودة مضى تاريخها ولم تُعرض",
          meetingId: meeting.id,
          meetingTitle: clean(meeting.title),
        });
      }
      continue;
    }

    const entry = toReportMeeting(meeting, iso);
    held.push(entry);
    meeting.attendees.map(clean).filter(Boolean).forEach((name) => people.add(name));

    for (const action of entry.actions) {
      actions.push({ text: action, meetingId: meeting.id, meetingTitle: entry.title });
    }

    // انعقد ولم يُقرَّر فيه شيء: ليس خطأً دائماً، لكنه السؤال الأول في أي مراجعة.
    if (meeting.status === "تم الاجتماع" && entry.decisions === 0) {
      attention.push({
        kind: "met-without-deciding",
        what: entry.title || "اجتماع بلا عنوان",
        why: "انعقد ولم يُسجَّل فيه قرار",
        meetingId: meeting.id,
        meetingTitle: entry.title,
      });
    }
  }

  const decisions = collectDecisions(meetings).filter((entry) =>
    withinWindow(entry.isoDate, window),
  );

  for (const entry of decisions) {
    if (entry.owner) continue;
    attention.push({
      kind: "unowned-decision",
      what: entry.decision,
      why: "قرار بلا مالك",
      meetingId: entry.meetingId,
      meetingTitle: entry.meetingTitle,
    });
  }

  const newestFirst = (a: ReportMeeting, b: ReportMeeting) => b.isoDate.localeCompare(a.isoDate);
  const soonestFirst = (a: ReportMeeting, b: ReportMeeting) => a.isoDate.localeCompare(b.isoDate);

  return {
    window,
    held: held.sort(newestFirst),
    decisions,
    actions,
    attention,
    upcoming: upcoming.sort(soonestFirst),
    people: Array.from(people).sort((a, b) => a.localeCompare(b, "ar")),
  };
}

/** هل في التقرير ما يُقرأ أصلاً؟ نافذة هادئة حقيقة، لا عطل. */
export function reportIsEmpty(report: StatusReport): boolean {
  return (
    report.held.length === 0 &&
    report.decisions.length === 0 &&
    report.actions.length === 0 &&
    report.attention.length === 0 &&
    report.upcoming.length === 0
  );
}
