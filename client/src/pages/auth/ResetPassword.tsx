// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { LOGIN_ROUTE } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import AuthShell, { AuthError, arabicAuthError } from "./AuthShell";

/**
 * كلمة مرور جديدة.
 *
 * يُفتح من رابط البريد، وقد التقط العميل الجلسة من الرابط قبل أن تُرسم هذه
 * الصفحة (detectSessionInUrl)، فتكفي `updateUser` بلا رمز يُمرَّر بيدنا.
 */
export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setError("المصادقة غير مضبوطة على هذا الخادم.");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور قصيرة — ثمانية أحرف على الأقل.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (failure) {
      console.error("[auth] password update failed", failure);
      setError(arabicAuthError(failure.message));
      return;
    }

    // الجلسة قائمة بعد التغيير، لكن نعيده إلى الدخول ليدخل بكلمته الجديدة
    // مرّة واحدة — فيتأكّد أنها حُفظت فعلاً.
    await supabase.auth.signOut();
    navigate(LOGIN_ROUTE, { replace: true });
  }

  return (
    <AuthShell title="كلمة مرور جديدة." lede="اخترها ثم ادخل بها.">
      <form className="au-form" onSubmit={submit}>
        <label className="tm-field">
          <span>كلمة المرور الجديدة</span>
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
          <span>تأكيدها</span>
          <input type="password" value={confirm} required autoComplete="new-password" dir="ltr" onChange={e => setConfirm(e.target.value)} />
        </label>

        <AuthError message={error} />

        <button type="submit" className="tp-btn tp-btn-primary tp-btn-wide" disabled={busy}>
          {busy && <Loader2 size={16} className="tm-spin" aria-hidden="true" />}
          حفظ كلمة المرور
        </button>
      </form>
    </AuthShell>
  );
}
