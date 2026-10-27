// اختيار مصدر البيانات: Supabase حين يكون مضبوطاً، وإلا العرض التجريبي.
// ?demo=1 في الرابط يفتح العرض التجريبي دائماً (ويبقى حتى ?demo=0).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMemoryApi } from "./memory-api";
import { createSupabaseApi } from "./supabase-api";
import type { Api } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function demoRequested(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search).get("demo");
  try {
    if (p === "1") sessionStorage.setItem("waf2:demo-mode", "1");
    if (p === "0") sessionStorage.removeItem("waf2:demo-mode");
    return sessionStorage.getItem("waf2:demo-mode") === "1";
  } catch {
    return p === "1";
  }
}

/**
 * يُقلب إلى true بعد تشغيل supabase/waf2-schema.sql على قاعدة Supabase.
 * قبل ذلك تعمل النسخة على العرض التجريبي حتى لو كان Supabase مضبوطاً،
 * لأن جداول waf2_ غير موجودة بعد.
 */
export const WAF2_TABLES_READY = false;

export const isDemo: boolean = !WAF2_TABLES_READY || !url || !key || demoRequested();

export const supabase: SupabaseClient | null = isDemo
  ? null
  : createClient(url!, key!, { auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

export const demoApi = isDemo ? createMemoryApi() : null;

export const api: Api = supabase ? createSupabaseApi(supabase) : demoApi!;
