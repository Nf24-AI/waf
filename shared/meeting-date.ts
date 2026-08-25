/**
 * Meeting dates are stored in Notion as real ISO dates, but the workspace shows
 * them as readable Arabic/English strings ("الثلاثاء، ٢٧ أغسطس ٢٠٢٦").
 * These helpers convert between the two so the Date property actually persists.
 */

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const ARABIC_WEEKDAYS = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

const ENGLISH_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const ENGLISH_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** Turn ٢٧ into 27 so the rest of the parsing can use plain numbers. */
export function toWesternDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)));
}

export function toArabicDigits(value: string | number) {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_INDIC[Number(digit)]);
}

function monthIndex(token: string) {
  const arabic = ARABIC_MONTHS.indexOf(token);
  if (arabic !== -1) return arabic;
  const english = ENGLISH_MONTHS.indexOf(token.toLowerCase());
  if (english !== -1) return english;
  return -1;
}

/**
 * Parse a display date into `YYYY-MM-DD`, or null when the field still holds a
 * placeholder such as "اختر التاريخ". Null means "do not touch Notion's Date".
 */
export function toIsoDate(display: string): string | null {
  const value = toWesternDigits((display ?? "").trim());
  if (!value) return null;

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "الثلاثاء، ٢٧ أغسطس ٢٠٢٦" or "Tuesday, 27 August 2026"
  const parts = value.replace(/[،,]/g, " ").split(/\s+/).filter(Boolean);
  let day = -1;
  let month = -1;
  let year = -1;

  for (const part of parts) {
    const asMonth = monthIndex(part);
    if (asMonth !== -1 && month === -1) {
      month = asMonth;
      continue;
    }
    if (!/^\d+$/.test(part)) continue;
    const numeric = Number(part);
    if (numeric >= 1000 && year === -1) year = numeric;
    else if (numeric >= 1 && numeric <= 31 && day === -1) day = numeric;
  }

  if (day === -1 || month === -1 || year === -1) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Render `YYYY-MM-DD` back into the workspace's display format. */
export function fromIsoDate(iso: string, language: "ar" | "en" = "ar"): string {
  const match = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso ?? "";

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11) return iso;

  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();

  if (language === "en") {
    return `${ENGLISH_WEEKDAYS[weekday]}, ${day} ${ENGLISH_MONTHS[month].replace(/^./, (c) => c.toUpperCase())} ${year}`;
  }
  // The meetings list splits on "،" to show weekday above the date.
  return `${ARABIC_WEEKDAYS[weekday]}، ${toArabicDigits(day)} ${ARABIC_MONTHS[month]} ${toArabicDigits(year)}`;
}
