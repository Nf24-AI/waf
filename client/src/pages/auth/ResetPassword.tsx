// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { FORGOT_PASSWORD_ROUTE, LOGIN_ROUTE } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import AuthShell, { AuthError, arabicAuthError } from "./AuthShell";

/**
 * كلمة مرور جديدة.
 *
 * تُفتح من رابط البريد، والرابط يحمل الجلسة. لكنها لا تصل في اللحظة الأولى:
 * العميل يقرأ الرابط ثم يُعلن الجلسة. فننتظرها قبل أن نعرض النموذج — عرضُه
 * قبلها يعني أن أوّل من يكتب كلمته بسرعة يُقابَل بفشلٍ لا ذنب له فيه.
 *
 * وإن لم تصل الجلسة أصلاً فالسبب يُقال صراحةً: رابط منتهٍ أو مستعمَل. وهذا
 * ما كان ينقص — كانت الصفحة تقول «تعذّر تنفيذ العملية» وهي لا تعرف أصلاً
 * أنّها بلا جلسة.
 */

type Stage = "checking" | "ready" | "no-session";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStage("no-session");
      return;
    }

    let settled = false;
    const ready = () => {
      settled = true;
      setStage("ready");
    };

    // الحدث يصل حين يفرغ العميل من قراءة الرابط.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === "PASSWORD_RECOVERY") ready();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) ready();
    });

    // الرابط قد يحمل سبب الرفض صراحةً؛ وهو أدقّ من أي تخمين.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const described = hash.get("error_description");
    if (described) {
      setError(
        /expired/i.test(described)
          ? "انتهت صلاحية الرابط. اطلب رابطاً جديداً."
          : "هذا الرابط لم يعد صالحاً. اطلب رابطاً جديداً.",
      );
    }

    const timer = window.setTimeout(() => {
      if (!settled) setStage("no-session");
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
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
      setError(
        /session|not authenticated/i.test(failure.message)
          ? "انتهت صلاحية الرابط. اطلب رابطاً جديداً."
          : arabicAuthError(failure.message),
      );
      return;
    }

    // الجلسة قائمة بعد التغيير، لكن نعيده إلى الدخول ليدخل بكلمته الجديدة
    // مرّة واحدة — فيتأكّد أنها حُفظت فعلاً.
    await supabase.auth.signOut();
    navigate(LOGIN_ROUTE, { replace: true });
  }

  if (stage === "checking") {
    return (
      <AuthShell title="لحظة…" lede="نتحقّق من الرابط.">
        <div className="au-loading">
          <div className="loading-orb" />
        </div>
      </AuthShell>
    );
  }

  if (stage === "no-session") {
    return (
      <AuthShell
        title="الرابط لم يعد صالحاً."
        lede="روابط الاستعادة تُستعمل مرّة واحدة وتنتهي بعد مدّة قصيرة."
        footer={<Link href={FORGOT_PASSWORD_ROUTE}>اطلب رابطاً جديداً</Link>}
      >
        <AuthError message={error} />
        <p className="au-note">افتح الرابط الجديد من نفس الجهاز الذي وصلك فيه البريد.</p>
      </AuthShell>
    );
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
          حفظ كلمة المرور
        </button>
      </form>
    </AuthShell>
  );
}
