import { toIsoDate } from "./meeting-date";
import { parseTimeRange } from "./meeting-time";
import type { MeetingRecord } from "./meeting-store";

export type MeetingStatus = "مسودة" | "جاهز للعرض" | "تم الاجتماع";

/** The five things that make a meeting ready to walk into. */
const READINESS_CHECKS = [
  (m: MeetingRecord) => toIsoDate(m.date) !== null,
  (m: MeetingRecord) => parseTimeRange(m.time).start !== "",
  (m: MeetingRecord) => m.summary.trim() !== "",
  (m: MeetingRecord) => m.agenda.some((item) => item.title.trim() !== ""),
  (m: MeetingRecord) => m.attendees.length > 0,
];

/**
 * How prepared the meeting actually is, 0–100.
 *
 * This used to read the status field, which made "تم الاجتماع" score 100 —
 * a finished meeting displayed as though it were ready to present, and a
 * fully-prepared draft displayed as 60 no matter how complete it was. Status
 * is a label the user sets; readiness is a fact about the content.
 */
export function getMeetingReadiness(meeting: MeetingRecord): number {
  const met = READINESS_CHECKS.filter((check) => check(meeting)).length;
  return Math.round((met / READINESS_CHECKS.length) * 100);
}

export function formatAgendaIndex(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function moveListItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
