import React, { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuthSession } from "@/contexts/AuthContext";
import { redirectTarget } from "@/lib/auth-routes";

/**
 * صفحات المصادقة لا تُعرض لمن دخل.
 *
 * من عنده جلسة ويفتح ‎/login يرى نموذجاً يطلب منه ما فعله بالفعل. والأسوأ
 * أنّ ‎/login?redirect=/login يصير حلقةً لا تنتهي بلا هذا.
 *
 * ويُحترم `redirect` هنا أيضاً: من عاد من رابط بريد وهو مسجَّل يمضي إلى
 * وجهته لا إلى الرئيسية.
 */
export default function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuthSession();
  const search = useSearch();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    navigate(redirectTarget(search), { replace: true });
  }, [loading, user, search, navigate]);

  if (!loading && user) return null;
  return <>{children}</>;
}
