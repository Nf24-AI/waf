import type { MeetingStatus } from "./meeting";

/**
 * The shared meeting model. Records live in Notion; this is only the shape the
 * client and server agree on. The prototype in-memory source that used to sit
 * here is gone — Notion is the single source of truth.
 */

export interface MeetingAgendaItem {
  title: string;
  context: string;
  goal: string;
  /** Captured live during the meeting — this is what turns a plan into minutes. */
  decision: string;
  owner: string;
}

export interface MeetingRecord {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  status: MeetingStatus;
  attendees: string[];
  summary: string;
  agenda: MeetingAgendaItem[];
  actions: string[];
  note: string;
  link: string;
  /** Optional image shown on the meeting page: a partner logo, a diagram. */
  image: string;

  /**
   * Token for the read-only share link, or "" when the meeting is not shared.
   *
   * Owner-side only. It never travels to a link holder — see toSharedMeeting
   * in meeting-share.ts, which rebuilds the record without it.
   */
  share: string;
}

/**
 * A meeting as the workspace edits it.
 *
 * No id, because Notion assigns it, and no share token, because the
 * workspace never writes one — that goes through meetings.share alone, so an
 * ordinary save can never mint or drop a live link.
 */
export type MeetingDraft = Omit<MeetingRecord, "id" | "share">;
