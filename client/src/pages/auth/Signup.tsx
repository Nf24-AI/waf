// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { LOGIN_ROUTE, VERIFY_EMAIL_ROUTE, redirectTarget } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import AuthShell, { AuthError, arabicAuthError } from "./AuthShell";

/**
 * إنشاء حساب.
 *
 * الاسم يُحفظ في بيانات المستخدم، ويقرؤه مُشغِّل قاعدة البيانات فينشئ الملفّ
 * الشخصي. لا ينشئه المتصفّح: عميلٌ يُغلق بعد التسجيل وقبل النداء الثاني يترك
 * حساباً بلا ملفّ، ولا أحد يعرف أنه ناقص حتى يُفتَح.
 *
 * وتأكيد كلمة المرور يُقارن هنا لا في الخادم: خطأ مطبعيّ يُقال فوراً، وليس
 * بعد رحلة شبكة.
 */
export default function Signup() {
  const search = useSearch();
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError(t("المصادقة غير مضبوطة على هذا الخادم.", "Sign-in is not configured on this server."));
      return;
    }
    if (password !== confirm) {
      setError(t("كلمتا المرور غير متطابقتين.", "The passwords do not match."));
      return;
    }
    if (password.length < 8) {
      setError(t("كلمة المرور قصيرة — ثمانية أحرف على الأقل.", "Password is too short. Use at least eight characters."));
      return;
    }

    setBusy(true);
    setError(null);
    const intended = redirectTarget(search);
    const { data, error: failure } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
        // بعد التحقّق يعود إلى ما كان يريده، لا إلى الجذر.
        emailRedirectTo: `${window.location.origin}${intended}`,
      },
    });
    setBusy(false);

    if (failure) {
      console.error("[auth] sign-up failed", failure);
      setError(arabicAuthError(failure.message));
      return;
    }

    // جلسة فورية تعني أن التحقّق بالبريد مُعطَّل، فيدخل مباشرة.
    navigate(data.session ? intended : VERIFY_EMAIL_ROUTE, { replace: true });
  }

  return (
    <AuthShell
      title={t("ابدأ مع واف.", "Get started with Waf.")}
      lede={t("أنشئ حسابك لتستخدم الخدمة وتحفظ أعمالك.", "Create your account to use the service and keep your work.")}
      footer={
        <>
          <span>{t("لديك حساب؟", "Already have an account?")}</span>
          <Link href={`${LOGIN_ROUTE}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}>
            {t("تسجيل الدخول", "Sign in")}
          </Link>
        </>
      }
    >
      <form className="au-form" onSubmit={submit}>
        <label className="tm-field">
          <span>{t("الاسم", "Name")}</span>
          <input type="text" value={name} required maxLength={40} autoComplete="name" onChange={e => setName(e.target.value)} />
        </label>

        <label className="tm-field">
          <span>{t("البريد الإلكتروني", "Email")}</span>
          <input type="email" value={email} required autoComplete="email" dir="ltr" onChange={e => setEmail(e.target.value)} />
        </label>

        <label className="tm-field">
          <span>{t("كلمة المرور", "Password")}</span>
          <input
            type="password"
            value={password}
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <label className="tm-field">
          <span>{t("تأكيد كلمة المرور", "Confirm password")}</span>
          <input
            type="password"
            value={confirm}
            required
            autoComplete="new-password"
            dir="ltr"
            onChange={e => setConfirm(e.target.value)}
          />
        </label>

        <AuthError message={error} />

        <button type="submit" className="tp-btn tp-btn-primary tp-btn-wide" disabled={busy}>
          {busy && <Loader2 size={16} className="tm-spin" aria-hidden="true" />}
          {t("إنشاء الحساب", "Create account")}
        </button>
      </form>
    </AuthShell>
  );
}
