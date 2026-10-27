// قواعد الاجتماعات: الجاهزية، خطوات التحضير، سجلّ القرارات، وتقرير الحالة.

import type { Meeting, MeetingKind, SharedMeeting } from "@/data/types";
import { addDays, dayOf } from "./time";

type MeetingLike = Pick<Meeting, "title" | "day" | "startTime" | "goal" | "agenda" | "attendees" | "followups">;

/** نسبة الجاهزية: خمسة شروط من المحتوى نفسه */
export function readiness(m: MeetingLike): number {
  const checks = [
    m.day !== null,
    m.startTime !== null,
    m.goal.trim().length > 0,
    m.agenda.some((a) => a.title.trim()),
    m.attendees.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export type PrepareStepId = "basics" | "goal" | "agenda" | "people" | "followups";

export interface PrepareStep {
  id: PrepareStepId;
  done: boolean;
}

/** خطوات التحضير الخمس بالترتيب، وما أُنجز منها */
export function prepareSteps(m: MeetingLike): PrepareStep[] {
  return [
    { id: "basics", done: m.title.trim().length > 0 && m.day !== null && m.startTime !== null },
    // الهدف جملة نتيجة، لا سؤال القالب الذي لم يُجَب بعد
    { id: "goal", done: m.goal.trim().length >= 15 && !/[?؟]$/.test(m.goal.trim()) },
    { id: "agenda", done: m.agenda.length > 0 && m.agenda.every((a) => a.title.trim()) },
    { id: "people", done: m.attendees.length > 0 },
    { id: "followups", done: m.followups.some((f) => f.text.trim()) },
  ];
}

export const KIND_LABEL: Record<MeetingKind, [string, string]> = {
  internal: ["داخلي", "Internal"],
  partner: ["مع شريك", "Partner"],
  leadership: ["قيادة", "Leadership"],
  other: ["أخرى", "Other"],
};

export function splitAttendees(text: string): string[] {
  return text
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ───────── رابط المشاركة ─────────

/** آخر يوم يعمل فيه رابط المشاركة: اليوم التالي للاجتماع */
export function shareLastDay(day: string | null): string | null {
  return day ? addDays(day, 1) : null;
}

/** اليوم الحالي بتوقيت الرياض */
export function riyadhToday(now: Date = new Date()): string {
  return dayOf(new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + 3 * 3_600_000));
}

export function shareExpired(day: string | null, now: Date = new Date()): boolean {
  const last = shareLastDay(day);
  return last === null || riyadhToday(now) > last;
}

/** ما يخرج لصاحب رابط القراءة: بلا ملاحظات ولا رمز */
export function toShared(m: Meeting): SharedMeeting {
  const { note: _note, shareToken: _token, updatedAt: _u, ...rest } = m;
  return rest;
}

// ───────── سجلّ القرارات ─────────

export interface DecisionEntry {
  id: string;
  decision: string;
  topic: string;
  context: string;
  owner: string;
  meetingId: string;
  meetingTitle: string;
  kind: MeetingKind;
  day: string | null;
  attendees: string[];
}

/** كل بند فيه قرار مكتوب يصير مدخلاً، الأحدث أولاً، وما بلا تاريخ في الآخر */
export function decisionsOf(meetings: Meeting[]): DecisionEntry[] {
  const out: DecisionEntry[] = [];
  for (const m of meetings) {
    m.agenda.forEach((a) => {
      if (!a.decision.trim()) return;
      out.push({
        id: `${m.id}#${a.id}`,
        decision: a.decision.trim(),
        topic: a.title,
        context: a.context,
        owner: a.owner.trim(),
        meetingId: m.id,
        meetingTitle: m.title,
        kind: m.kind,
        day: m.day,
        attendees: m.attendees,
      });
    });
  }
  return out.sort((x, y) => {
    if (x.day === y.day) return 0;
    if (x.day === null) return 1;
    if (y.day === null) return -1;
    return x.day < y.day ? 1 : -1;
  });
}

// ───────── تقرير الحالة ─────────

export type AttentionKind = "unowned-decision" | "met-without-deciding" | "overdue-draft";

export interface StatusReport {
  from: string;
  to: string;
  held: { meeting: Meeting; decisions: number }[];
  decided: DecisionEntry[];
  tasks: { text: string; done: boolean; meeting: Meeting }[];
  people: string[];
  upcoming: Meeting[];
  attention: { kind: AttentionKind; meeting: Meeting; text: string }[];
}

/** تقرير أسبوع [from, to] شاملاً الطرفين. حقائق فقط، بلا أحكام. */
export function buildStatusReport(meetings: Meeting[], from: string, to: string): StatusReport {
  const report: StatusReport = { from, to, held: [], decided: [], tasks: [], people: [], upcoming: [], attention: [] };
  const people = new Set<string>();

  for (const m of meetings) {
    if (!m.day) continue;
    if (m.day > to) {
      if (m.status !== "done") report.upcoming.push(m);
      continue;
    }
    if (m.day < from) {
      if (m.status === "draft") report.attention.push({ kind: "overdue-draft", meeting: m, text: m.title });
      continue;
    }
    const decisions = m.agenda.filter((a) => a.decision.trim());
    report.held.push({ meeting: m, decisions: decisions.length });
    m.followups.forEach((f) => f.text.trim() && report.tasks.push({ text: f.text, done: f.done, meeting: m }));
    m.attendees.forEach((p) => people.add(p));
    if (m.status === "done" && decisions.length === 0) report.attention.push({ kind: "met-without-deciding", meeting: m, text: m.title });
  }

  report.decided = decisionsOf(meetings).filter((d) => d.day !== null && d.day >= from && d.day <= to);
  for (const d of report.decided) {
    if (!d.owner) {
      const meeting = meetings.find((m) => m.id === d.meetingId)!;
      report.attention.push({ kind: "unowned-decision", meeting, text: d.decision });
    }
  }
  report.people = [...people];
  report.held.sort((a, b) => (a.meeting.day! < b.meeting.day! ? 1 : -1));
  report.upcoming.sort((a, b) => (a.day! < b.day! ? -1 : 1));
  return report;
}
