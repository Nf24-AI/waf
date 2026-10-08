// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { LOGIN_ROUTE } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import { useAuthSession } from "@/contexts/AuthContext";
import { t } from "@/lib/i18n";
import AuthShell, { AuthError, arabicAuthError } from "./AuthShell";

/**
 * بانتظار التحقّق من البريد.
 *
 * لا نصنع منطق تحقّق من عندنا: Supabase يرسل الرابط ويعلّم الحساب مفعَّلاً.
 * هذه الصفحة تقول ما حدث وتتيح إعادة الإرسال، لا أكثر.
 */
export default function VerifyEmail() {
  const { user } = useAuthSession();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    if (!supabase || !user?.email) {
      setError(t("تعذّر تحديد بريدك. سجّل دخولك ثم أعد المحاولة.", "We could not identify your email. Sign in and try again."));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.resend({ type: "signup", email: user.email });
    setBusy(false);
    if (failure) {
      console.error("[auth] resend failed", failure);
      setError(arabicAuthError(failure.message));
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title={t("تحقّق من بريدك الإلكتروني.", "Verify your email.")}
      lede={t("أرسلنا لك رابط التحقّق. افتحه لتفعيل حسابك.", "We sent you a verification link. Open it to activate your account.")}
      footer={<Link href={LOGIN_ROUTE}>{t("العودة لتسجيل الدخول", "Back to sign in")}</Link>}
    >
      <p className="au-note">
        {t(
          "إن لم يصل خلال دقائق، تحقّق من مجلّد الرسائل غير المرغوبة قبل إعادة الإرسال.",
          "If it does not arrive within a few minutes, check your spam folder before resending.",
        )}
      </p>

      <AuthError message={error} />

      {sent ? (
        <p className="au-note" role="status">
          {t("أُرسل رابط جديد.", "A new link has been sent.")}
        </p>
      ) : (
        <button type="button" className="tp-btn tp-btn-wide" onClick={resend} disabled={busy}>
          {busy && <Loader2 size={16} className="tm-spin" aria-hidden="true" />}
          {t("إعادة إرسال البريد", "Resend email")}
        </button>
      )}
    </AuthShell>
  );
}
