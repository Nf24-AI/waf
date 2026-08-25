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
}
