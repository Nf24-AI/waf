import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authConfigured, supabase } from "@/lib/supabase";

/**
 * حالة الهويّة — مصدرها Supabase وحده.
 *
 * `loading` ليست تفصيلاً: بين إقلاع الصفحة ووصول الجلسة لحظةٌ لا يُعرف فيها
 * أمسجَّلٌ هو أم زائر. من يرسم فيها يرسم «لا مهام لديك» ثم يبدّلها، أو يقذف
 * مسجَّلاً إلى صفحة الدخول. فتُنتظر، ولا يُقرَّر شيء قبلها.
 */

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** المصادقة غير مضبوطة (متغيّرات البيئة ناقصة) — الصفحات العامّة تعمل. */
  configured: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authConfigured);

  useEffect(() => {
    if (!supabase) return;

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });

    // تجديد الرمز وتسجيل الخروج من لسان آخر يصلان من هنا، فتبقى الألسنة متّفقة.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      configured: authConfigured,
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [loading, session],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuthSession(): AuthState {
  const value = useContext(AuthCtx);
  if (!value) throw new Error("useAuthSession must be used inside <AuthProvider>");
  return value;
}
