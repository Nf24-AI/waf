// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { FORGOT_PASSWORD_ROUTE, LOGIN_ROUTE } from "@/lib/auth-routes";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
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
          ? t("انتهت صلاحية الرابط. اطلب رابطاً جديداً.", "This link has expired. Request a new one.")
          : t("هذا الرابط لم يعد صالحاً. اطلب رابطاً جديداً.", "This link is no longer valid. Request a new one."),
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
      setError(t("كلمتا المرور غير متطابقتين.", "The passwords do not match."));
      return;
    }
    if (password.length < 8) {
      setError(t("كلمة المرور قصيرة — ثمانية أحرف على الأقل.", "Password is too short. Use at least eight characters."));
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
          ? t("انتهت صلاحية الرابط. اطلب رابطاً جديداً.", "This link has expired. Request a new one.")
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
      <AuthShell title={t("لحظة…", "One moment…")} lede={t("نتحقّق من الرابط.", "Checking the link.")}>
        <div className="au-loading">
          <div className="loading-orb" />
        </div>
      </AuthShell>
    );
  }

  if (stage === "no-session") {
    return (
      <AuthShell
        title={t("الرابط لم يعد صالحاً.", "This link is no longer valid.")}
        lede={t("روابط الاستعادة تُستعمل مرّة واحدة وتنتهي بعد مدّة قصيرة.", "Reset links work once and expire after a short time.")}
        footer={<Link href={FORGOT_PASSWORD_ROUTE}>{t("اطلب رابطاً جديداً", "Request a new link")}</Link>}
      >
        <AuthError message={error} />
        <p className="au-note">
          {t(
            "افتح الرابط الجديد من نفس الجهاز الذي وصلك فيه البريد.",
            "Open the new link on the same device where you received the email.",
          )}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("كلمة مرور جديدة.", "New password.")} lede={t("اخترها ثم ادخل بها.", "Choose it, then sign in with it.")}>
      <form className="au-form" onSubmit={submit}>
        <label className="tm-field">
          <span>{t("كلمة المرور الجديدة", "New password")}</span>
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
          <span>{t("تأكيدها", "Confirm it")}</span>
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
          {t("حفظ كلمة المرور", "Save password")}
        </button>
      </form>
    </AuthShell>
  );
}
