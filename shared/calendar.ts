/**
 * شبكة شهر — للرزنامة المصغّرة في الهيرو.
 *
 * تُخطئ بصمت: صفٌّ ناقص أو يوم مزاح لا يُرى في الشاشة، ويُرى بعد أسبوعين
 * حين يُحجز موعد في اليوم الخطأ. فحسابها هنا، مفصولاً عن الرسم، ومغطّى.
 */

/** أوّل أيام الأسبوع في التقويم العربي: السبت. */
export const WEEK_START = 6;

/** أحرف الأيام كما تُكتب فوق الشبكة، بدءاً من السبت. */
export const WEEKDAY_LABELS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] as const;

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

export interface CalendarDay {
  /** «2026-09-27» */
  key: string;
  /** رقم اليوم كما يُعرض. */
  day: number;
  /** من الشهر المعروض، لا من الذي قبله أو بعده. */
  inMonth: boolean;
  isToday: boolean;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

function key(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * أسبوع واحد يحيط باليوم — وهو ما يعرضه المرجع، لا الشهر كاملاً.
 *
 * صفٌّ واحد يكفي في الهيرو: من يريد الشهر يفتح التقويم. وعرض ستّة صفوف هنا
 * يأخذ من الهيرو أكثر ممّا يعطي.
 */
export function weekAround(now: Date = new Date()): CalendarDay[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = key(today);

  // الرجوع إلى السبت: getDay() للسبت = 6.
  const start = new Date(today);
  const back = (start.getDay() - WEEK_START + 7) % 7;
  start.setDate(start.getDate() - back);

  const month = today.getMonth();
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      key: key(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: key(date) === todayKey,
    });
  }
  return days;
}

/** «الأحد، 27 سبتمبر 2026» — تاريخ الشريط العلوي. */
export function longDate(now: Date = new Date()): string {
  const weekday = WEEKDAY_LABELS[(now.getDay() - WEEK_START + 7) % 7];
  return `${weekday}، ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/** التحيّة بحسب الساعة — بلا اسم، فالواجهة عامّة. */
export function greetingOf(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "مساء الخير";
  return "مساء الخير";
}
