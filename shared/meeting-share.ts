import { toIsoDate } from "./meeting-date";
import type { MeetingRecord } from "./meeting-store";

/**
 * Read-only share links.
 *
 * A meeting page can be handed to someone outside the workspace without giving
 * them the workspace. The link carries an unguessable token; the token names
 * one meeting and nothing else, so there is no list to walk and no way to move
 * sideways from one meeting to another.
 *
 * What the holder of a link can do is read. Every write still sits behind
 * appProcedure and the password.
 */

/** Where a shared meeting is read. The token is the rest of the path. */
export const SHARE_ROUTE = "/s";

/** A link outlives its meeting by this much, then stops working. */
export const SHARE_GRACE_DAYS = 1;

/**
 * Expiry is a calendar day, not a moment, and the calendar is the one the
 * meetings are written in. Vercel runs its lambdas in UTC, which is three
 * hours behind Riyadh: comparing raw UTC days would retire a link while it was
 * still the previous day for everyone reading it.
 */
const SHARE_TIME_ZONE = "Asia/Riyadh";

const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHARE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today where the meetings live, as "YYYY-MM-DD". */
export function shareToday(now: Date = new Date()): string {
  return isoDay.format(now);
}

/**
 * The last day a link works: the meeting's own day plus the grace.
 *
 * Null when the meeting has no readable date — a meeting that has never been
 * given a date has no window for a link to be inside of.
 */
export function shareExpiresOn(meetingDate: string): string | null {
  const iso = toIsoDate(meetingDate);
  if (!iso) return null;

  const day = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;

  day.setUTCDate(day.getUTCDate() + SHARE_GRACE_DAYS);
  return day.toISOString().slice(0, 10);
}

/**
 * Fails closed: an undated meeting counts as expired rather than as forever.
 *
 * Sharing is refused for those up front, so this is the second line — but the
 * safe answer to "how long should this live" is never "always".
 */
export function isShareExpired(meetingDate: string, now: Date = new Date()): boolean {
  const last = shareExpiresOn(meetingDate);
  if (!last) return true;
  return shareToday(now) > last;
}

/** A meeting can only be shared once it has a date to expire against. */
export function canShare(meeting: Pick<MeetingRecord, "date">): boolean {
  return shareExpiresOn(meeting.date) !== null;
}

/** What a link holder receives. Never the token, never the private notes. */
export type SharedMeeting = Omit<MeetingRecord, "note" | "share">;

/**
 * Strip the meeting down to what leaves the workspace.
 *
 * `note` is "ملاحظاتك التحضيرية" — written by the organiser, for the
 * organiser. `share` is the token itself, which would let a reader hand the
 * link on as if it were theirs to give.
 *
 * Written as a rebuild rather than a delete so a field added to MeetingRecord
 * later has to be named here before it can reach a stranger.
 */
export function toSharedMeeting(meeting: MeetingRecord): SharedMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    time: meeting.time,
    type: meeting.type,
    status: meeting.status,
    attendees: meeting.attendees,
    summary: meeting.summary,
    agenda: meeting.agenda,
    actions: meeting.actions,
    link: meeting.link,
    image: meeting.image,
  };
}

/** The address to hand over, e.g. "https://waf.example.com/s/<token>". */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${SHARE_ROUTE}/${token}`;
}
