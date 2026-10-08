// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { LOGIN_ROUTE, RESET_PASSWORD_ROUTE } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import AuthShell, { AuthError, arabicAuthError } from "./AuthShell";

/**
 * طلب استعادة كلمة المرور.
 *
 * الجواب واحد سواء وُجد البريد أو لم يوجد: «أرسلنا رابطاً إن كان مسجَّلاً».
 * الصيغة الأخرى — «لا حساب بهذا البريد» — تجعل الصفحة أداةً لمعرفة من عندنا
 * ومن ليس عندنا، وهي معلومة لا تخصّ من يسأل.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError(t("المصادقة غير مضبوطة على هذا الخادم.", "Sign-in is not configured on this server."));
      return;
    }

    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${RESET_PASSWORD_ROUTE}`,
    });
    setBusy(false);

    if (failure) {
      console.error("[auth] reset request failed", failure);
      setError(arabicAuthError(failure.message));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell
        title={t("تحقّق من بريدك.", "Check your email.")}
        lede={t("إن كان هذا البريد مسجَّلاً عندنا فقد أرسلنا إليه رابط استعادة.", "If this email is registered with us, we have sent it a reset link.")}
        footer={<Link href={LOGIN_ROUTE}>{t("العودة لتسجيل الدخول", "Back to sign in")}</Link>}
      >
        <p className="au-note">
          {t(
            "الرابط صالح لمدّة محدودة. إن لم يصل خلال دقائق، تحقّق من مجلّد الرسائل غير المرغوبة.",
            "The link is valid for a limited time. If it does not arrive within a few minutes, check your spam folder.",
          )}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("استعادة كلمة المرور.", "Reset your password.")}
      lede={t("اكتب بريدك ونرسل إليك رابطاً.", "Enter your email and we will send you a link.")}
      footer={<Link href={LOGIN_ROUTE}>{t("العودة لتسجيل الدخول", "Back to sign in")}</Link>}
    >
      <form className="au-form" onSubmit={submit}>
        <label className="tm-field">
          <span>{t("البريد الإلكتروني", "Email")}</span>
          <input type="email" value={email} required autoComplete="email" dir="ltr" onChange={e => setEmail(e.target.value)} />
        </label>

        <AuthError message={error} />

        <button type="submit" className="tp-btn tp-btn-primary tp-btn-wide" disabled={busy}>
          {busy && <Loader2 size={16} className="tm-spin" aria-hidden="true" />}
          {t("أرسل الرابط", "Send link")}
        </button>
      </form>
    </AuthShell>
  );
}
