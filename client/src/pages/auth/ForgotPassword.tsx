// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { LOGIN_ROUTE, RESET_PASSWORD_ROUTE } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
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
      setError("المصادقة غير مضبوطة على هذا الخادم.");
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
        title="تحقّق من بريدك."
        lede="إن كان هذا البريد مسجَّلاً عندنا فقد أرسلنا إليه رابط استعادة."
        footer={<Link href={LOGIN_ROUTE}>العودة لتسجيل الدخول</Link>}
      >
        <p className="au-note">الرابط صالح لمدّة محدودة. إن لم يصل خلال دقائق، تحقّق من مجلّد الرسائل غير المرغوبة.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="استعادة كلمة المرور."
      lede="اكتب بريدك ونرسل إليك رابطاً."
      footer={<Link href={LOGIN_ROUTE}>العودة لتسجيل الدخول</Link>}
    >
      <form className="au-form" onSubmit={submit}>
        <label className="tm-field">
          <span>البريد الإلكتروني</span>
          <input type="email" value={email} required autoComplete="email" dir="ltr" onChange={e => setEmail(e.target.value)} />
        </label>

        <AuthError message={error} />

        <button type="submit" className="tp-btn tp-btn-primary tp-btn-wide" disabled={busy}>
          {busy && <Loader2 size={16} className="tm-spin" aria-hidden="true" />}
          أرسل الرابط
        </button>
      </form>
    </AuthShell>
  );
}
