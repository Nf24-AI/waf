// ساعة مشتركة لمكوّنات العرض: مؤقّت واحد للصفحة كلها، ولا يُعاد رسم إلا من يقرأ الوقت.
// تُقرأ اللحظة فوراً عند عودة التبويب إلى الظهور.

import { useSyncExternalStore } from "react";

const STEP = 250;
let now = Date.now();
let id: number | null = null;
const subs = new Set<() => void>();

function tick() {
  now = Date.now();
  subs.forEach((f) => f());
}

function onVisible() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(fn: () => void) {
  subs.add(fn);
  if (id == null) {
    now = Date.now();
    id = window.setInterval(tick, STEP);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    subs.delete(fn);
    if (!subs.size && id != null) {
      clearInterval(id);
      id = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** اللحظة الحالية بالمللي ثانية، تتحدّث أربع مرات في الثانية */
export function useNowMs(): number {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

/** يقرأ قيمة JSON من التخزين بأمان */
export function readJson(key: string): unknown {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : JSON.parse(v);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* بلا تخزين: تبقى القيمة لهذه الجلسة */
  }
}
