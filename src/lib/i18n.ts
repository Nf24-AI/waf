// اللغة: نصوص مكتوبة في مكانها بالعربية والإنجليزية t("…", "…")، بلا قاموس مفاتيح.
// العربية هي الأصل. الاختيار يُحفظ في المتصفّح ويُبدَّل الجذر كله عند التغيير.

import { useSyncExternalStore } from "react";

export type Lang = "ar" | "en";
const KEY = "waf:lang";

function initial(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

let current: Lang = typeof window === "undefined" ? "ar" : initial();
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current;
  document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
}
apply();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* بلا تخزين: يبقى الاختيار لهذه الجلسة */
  }
  apply();
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => "ar",
  );
}

/** النص بلغة الواجهة الحالية */
export function t(ar: string, en: string): string {
  return current === "ar" ? ar : en;
}

/** زوج [عربي، إنجليزي] → النص الحالي */
export function pick(pair: readonly [string, string]): string {
  return current === "ar" ? pair[0] : pair[1];
}

/** "ar" لا "ar-SA" حتى تبقى الأرقام غربية والتقويم ميلادياً */
export function locale(): string {
  return current === "ar" ? "ar" : "en-GB";
}

export function isRtl(): boolean {
  return current === "ar";
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = current + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) fmtCache.set(key, (f = new Intl.DateTimeFormat(locale(), opts)));
  return f;
}

/** "الثلاثاء ٢٧ أكتوبر" بأرقام غربية */
export function formatDay(day: string | Date, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  const d = typeof day === "string" ? new Date(`${day}T00:00`) : day;
  return fmt(opts).format(d);
}

/** "10:30" → "10:30 ص" أو "10:30 AM" أو بقي ٢٤ ساعة */
export function formatClock(hhmm: string, hour12 = true): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!hour12) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const suffix = current === "ar" ? (h < 12 ? "ص" : "م") : h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** عدد مع اسم معدود بسيط: plural(3, ["اجتماع", "اجتماعات"], ["meeting", "meetings"]) */
export function count(n: number, ar: [string, string], en: [string, string]): string {
  if (current === "ar") {
    if (n === 1) return ar[0];
    if (n === 2) return `${ar[0]}ان`.replace(/ةان$/, "تان");
    return `${n} ${n >= 3 && n <= 10 ? ar[1] : ar[0]}`;
  }
  return `${n} ${n === 1 ? en[0] : en[1]}`;
}
