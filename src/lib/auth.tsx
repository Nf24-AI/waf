// الحساب: Supabase بالبريد وكلمة المرور. في العرض التجريبي مستخدم ضيف دائماً.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { isDemo, supabase } from "@/data/client";

export interface Account {
  id: string;
  email: string;
  name: string;
  meta: Record<string, unknown>;
}

interface AuthState {
  account: Account | null;
  loading: boolean;
  demo: boolean;
}

const AuthContext = createContext<AuthState>({ account: null, loading: true, demo: isDemo });

const DEMO: Account = { id: "demo", email: "guest@waf.demo", name: "ضيف واف", meta: {} };

function toAccount(u: User): Account {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (typeof meta.name === "string" && meta.name) || (typeof meta.full_name === "string" && meta.full_name) || (u.email ?? "").split("@")[0];
  return { id: u.id, email: u.email ?? "", name, meta };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => (isDemo ? { account: DEMO, loading: false, demo: true } : { account: null, loading: true, demo: false }));

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState({ account: data.session ? toAccount(data.session.user) : null, loading: false, demo: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ account: session ? toAccount(session.user) : null, loading: false, demo: false });
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

/** يحفظ قيمة في بيانات الحساب (مثل أسماء الفئات). في التجربة تُحفظ محلياً. */
export async function saveAccountMeta(patch: Record<string, unknown>) {
  if (!supabase) {
    try {
      const cur = JSON.parse(localStorage.getItem("waf2:demo-meta") ?? "{}");
      localStorage.setItem("waf2:demo-meta", JSON.stringify({ ...cur, ...patch }));
    } catch {
      /* لا تخزين */
    }
    return;
  }
  const { error } = await supabase.auth.updateUser({ data: patch });
  if (error) throw error;
}

export function demoMeta(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem("waf2:demo-meta") ?? "{}");
  } catch {
    return {};
  }
}

/** وجهة آمنة بعد الدخول: مسار داخلي فقط، لا "//" ولا رابط خارجي */
export function safeRedirect(raw: string | null | undefined, fallback = "/today"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
