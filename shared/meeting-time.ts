import { toArabicDigits, toWesternDigits } from "./meeting-date";

/**
 * Meeting time is a display string such as "١٠:٠٠ ص – ١١:٠٠ ص". The editor uses
 * two <input type="time"> controls, which need plain 24-hour "HH:MM" values, so
 * these helpers convert between the two.
 */

const DASHES = /[–—-]/;

/** Parse one side of a range into 24-hour "HH:MM", or "" when unset. */
export function toClockValue(part: string): string {
  const value = toWesternDigits((part ?? "").trim());
  if (!value) return "";

  const match = value.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return "";

  let hours = Number(match[1]);
  const minutes = match[2];
  if (Number.isNaN(hours) || hours > 23) return "";

  const isPm = /م|pm/i.test(value) && !/ص|am/i.test(value);
  const isAm = /ص|am/i.test(value);
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

/** Split a display range into its two clock values. */
export function parseTimeRange(display: string): { start: string; end: string } {
  const [start = "", end = ""] = (display ?? "").split(DASHES);
  return { start: toClockValue(start), end: toClockValue(end) };
}

/** Render "HH:MM" as "١٠:٠٠ ص" in Arabic, or "10:00 AM" in English. */
export function fromClockValue(clock: string, language: "ar" | "en" = "ar"): string {
  const match = (clock ?? "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";

  const hours24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hours24 < 12 ? (language === "ar" ? "ص" : "AM") : language === "ar" ? "م" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  const body = `${hours12}:${minutes}`;
  return language === "ar" ? `${toArabicDigits(body)} ${suffix}` : `${body} ${suffix}`;
}

/** Join two clock values into the display string the workspace stores. */
export function buildTimeRange(start: string, end: string, language: "ar" | "en" = "ar"): string {
  const from = fromClockValue(start, language);
  const to = fromClockValue(end, language);

  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  if (to) return to;
  return language === "ar" ? "اختر الوقت" : "Choose a time";
}
