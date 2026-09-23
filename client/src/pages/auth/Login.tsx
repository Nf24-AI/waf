// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { FORGOT_PASSWORD_ROUTE, SIGNUP_ROUTE, redirectTarget } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import AuthShell, { AuthError, arabicAuthError } from "./AuthShell";

/**
 * تسجيل الدخول.
 *
 * الوجهة المقصودة تُحمل في الرابط وتُعاد بعد النجاح: من ضغط «إدارة الوقت»
 * وهو زائر يعود إلى إدارة الوقت، لا إلى صفحة رئيسية عليه أن يبحث فيها عمّا
 * كان يريده قبل لحظة.
 */
export default function Login() {
  const search = useSearch();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError("المصادقة غير مضبوطة على هذا الخادم.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);

    if (failure) {
      // التفصيل التقني للسجلّ، والعربية للمستخدم.
      console.error("[auth] sign-in failed", failure);
      setError(arabicAuthError(failure.message));
      return;
    }

    navigate(redirectTarget(search), { replace: true });
  }

  return (
    <AuthShell
      title="أهلًا بك في واف."
      lede="سجّل دخولك لتكمل من حيث توقّفت."
      footer={
        <>
          <span>ليس لديك حساب؟</span>
          <Link href={`${SIGNUP_ROUTE}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}>
            إنشاء حساب
          </Link>
        </>
      }
    >
      <form className="au-form" onSubmit={submit}>
        <label className="tm-field">
          <span>البريد الإلكتروني</span>
          <input
            type="email"
            value={email}
            required
            autoComplete="email"
            dir="ltr"
            onChange={event => setEmail(event.target.value)}
          />
        </label>

        <label className="tm-field">
          <span>كلمة المرور</span>
          <input
            type="password"
            value={password}
            required
            autoComplete="current-password"
            dir="ltr"
            onChange={event => setPassword(event.target.value)}
          />
        </label>

        <AuthError message={error} />

        <button type="submit" className="tp-btn tp-btn-primary tp-btn-wide" disabled={busy}>
          {busy && <Loader2 size={16} className="tm-spin" aria-hidden="true" />}
          تسجيل الدخول
        </button>

        <Link className="au-quiet" href={FORGOT_PASSWORD_ROUTE}>
          نسيت كلمة المرور؟
        </Link>
      </form>
    </AuthShell>
  );
}
