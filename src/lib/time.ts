// أدوات الوقت والتاريخ. اليوم يُمثَّل "YYYY-MM-DD" بتوقيت الجهاز.

export const MINUTE = 60_000;
export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** اليوم المحلّي لتاريخ ما بصيغة YYYY-MM-DD */
export function dayOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** منتصف ليل اليوم المحلّي */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseDay(value);
  return !Number.isNaN(d.getTime()) && dayOf(d) === value;
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return dayOf(d);
}

/** الفرق بالأيام (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);
}

/** "HH:MM" → دقائق منذ منتصف الليل */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** لحظة ISO من يوم وساعة محلّيين */
export function at(day: string, hhmm: string): string {
  const d = parseDay(day);
  d.setMinutes(toMinutes(hhmm));
  return d.toISOString();
}

/** دقائق اللحظة منذ منتصف ليل يومها المحلّي */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function roundUpTo(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

/** مدة بالدقائق إلى نصّ قصير: "١س ٢٠د" أو "1h 20m" */
export function formatDuration(minutes: number, lang: "ar" | "en"): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (lang === "ar") {
    if (h && m) return `${h}س ${m}د`;
    if (h) return `${h}س`;
    return `${m}د`;
  }
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function westernDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c))).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/**
 * يقرأ مدة مكتوبة بحرّية بالعربية أو الإنجليزية ويعيدها بالدقائق، أو null.
 * أمثلة: "90"، "1h 20m"، "1.5h"، "١س ٢٠د"، "ساعتين"، "ساعة ونصف"، "نصف ساعة".
 */
export function parseDuration(input: string): number | null {
  let s = westernDigits(input).trim().toLowerCase().replace(/،/g, " ");
  if (!s) return null;

  const words: [RegExp, number][] = [
    [/^نصف ساعة$|^نص ساعة$/, 30],
    [/^ربع ساعة$/, 15],
    [/^ساعة ونصف$|^ساعة ونص$/, 90],
    [/^ساعة وربع$/, 75],
    [/^ساعتين ونصف$|^ساعتان ونصف$/, 150],
    [/^ساعتين$|^ساعتان$/, 120],
    [/^ساعة$/, 60],
  ];
  for (const [re, v] of words) if (re.test(s)) return v;

  if (/^\d+(\.\d+)?$/.test(s)) return valid(Number(s));

  s = s.replace(/\s+/g, "");
  const m = s.match(/^(?:(\d+(?:\.\d+)?)(?:h|hr|hrs|hours?|س|ساعة|ساعات))?(?:و?(\d+)(?:m|min|mins|minutes?|د|دقيقة|دقائق))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return valid((m[1] ? Number(m[1]) * 60 : 0) + (m[2] ? Number(m[2]) : 0));

  function valid(n: number) {
    const r = Math.round(n);
    return r >= 5 && r <= 1440 ? r : null;
  }
}
