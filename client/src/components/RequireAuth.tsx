import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthSession } from "@/contexts/AuthContext";
import { loginHref } from "@/lib/auth-routes";
import { dir, t } from "@/lib/i18n";

/**
 * حارس الصفحات الخاصّة.
 *
 * ثلاث حالات لا حالتان. «ليس مسجَّلاً» و«لا نعرف بعد» ليستا واحدة: الخلط
 * بينهما يقذف مستخدماً مسجَّلاً إلى صفحة الدخول في كل مرّة يُحدِّث فيها
 * الصفحة، لأن الجلسة لم تصل بعد. فننتظر، ثم نقرّر.
 *
 * والحارس للتجربة لا للأمان: البيانات محميّة بـRLS في قاعدة البيانات. لو
 * عُطِّل هذا الملفّ كلّه لما قرأ أحد صفّاً ليس له — كان سيرى صفحةً فارغة وخطأً.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, user, configured } = useAuthSession();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (loading || user) return;
    // الوجهة تُحفظ مع ما فيها من معاملات: `?task=` جزء من المكان المقصود.
    const intended = location + window.location.search;
    navigate(loginHref(intended), { replace: true });
  }, [loading, user, location, navigate]);

  if (!configured) {
    return (
      <div className="au-screen" data-waf-theme="navy" dir={dir()}>
        <main className="au-card">
          <h1 className="au-title">{t("المصادقة غير مضبوطة.", "Authentication is not configured.")}</h1>
          <p className="au-lede">
            {t("اضبط", "Set")} <code>VITE_SUPABASE_URL</code> {t("و", "and ")}<code>VITE_SUPABASE_ANON_KEY</code> {t("ثم أعد النشر.", "then redeploy.")}
          </p>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="au-screen" data-waf-theme="navy" dir={dir()}>
        <main className="au-card au-loading">
          <div className="loading-orb" />
          <p className="au-lede">{t("جارٍ تحميل بياناتك…", "Loading your data…")}</p>
        </main>
      </div>
    );
  }

  // أثناء التحويل لا يُرسم شيء: وميض صفحةٍ خاصّة قبل القذف أسوأ من انتظار.
  if (!user) return null;

  return <>{children}</>;
}
