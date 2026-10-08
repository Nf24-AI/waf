import { useSyncExternalStore } from "react";

/**
 * لغة الواجهة: عربية أو إنجليزية، باختيار صاحبها.
 *
 * النصّان يُكتبان متجاورين حيث يُعرضان — `t("حفظ", "Save")` — لا في قاموسٍ
 * بمفاتيح: من يقرأ المكوّن يرى ما سيُعرض باللغتين، ومن يغيّر جملةً لا ينسى
 * أختها في ملفٍّ آخر. والعربية أولاً لأنها الأصل الذي كُتب به المنتج.
 *
 * واللغة حالٌ عامّة لا سياق React: الدوالّ الخالصة (صيغة الوقت، أسماء
 * الأيام) تسألها كما تسألها المكوّنات. والجذر يُعيد رسم الشجرة كلّها عند
 * التبديل (انظر App.tsx)، فلا يحتاج مكوّنٌ أن يشترك بنفسه.
 */

export type Lang = "ar" | "en";

/** نصٌّ باللغتين، لما يُعرَّف خارج الرسم (ثوابت القوائم والتسميات). */
export interface Pair {
  ar: string;
  en: string;
}

const KEY = "waf:lang";
const listeners = new Set<() => void>();

function stored(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "ar";
  } catch {
    // بلا متصفّح (الاختبارات، الخادم): العربية هي الأصل.
    return "ar";
  }
}

let current: Lang = stored();

/** يكتب اللغة والاتجاه على الجذر: به تنقلب الصفحة كلّها، وبه يقرأ القارئ الآليّ اللغة الصحيحة. */
function apply(lang: Lang): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

apply(current);

export function getLang(): Lang {
  return current;
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* لا شيء يُفعل: اللغة تبقى لهذه الزيارة وحدها. */
  }
  apply(next);
  listeners.forEach(listener => listener());
}

/** للجذر وحده: يشترك في تبديل اللغة ليُعيد رسم ما تحته. */
export function useLang(): Lang {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLang,
    () => "ar" as Lang,
  );
}

/** النصّ بلغة الواجهة الحالية. يُنادى أثناء الرسم، لا عند تحميل الملف. */
export function t(ar: string, en: string): string {
  return current === "ar" ? ar : en;
}

export function pair(ar: string, en: string): Pair {
  return { ar, en };
}

export function pick(text: Pair): string {
  return text[current];
}

export function dir(): "rtl" | "ltr" {
  return current === "ar" ? "rtl" : "ltr";
}

/**
 * اللغة لدوالّ التاريخ والأرقام.
 *
 * «ar» لا «ar-SA»: الأخيرة تُخرج أرقاماً هندية وتقويماً هجرياً، وبقيّة الواجهة
 * بأرقام غربية وتقويم ميلادي. و«en-GB» لأن يومها يسبق شهرها كما في العربية.
 */
export function locale(): string {
  return current === "ar" ? "ar" : "en-GB";
}
