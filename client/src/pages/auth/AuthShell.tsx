import React from "react";
import { Link } from "wouter";
import { LANDING_ROUTE } from "@shared/routes";
import mountains from "@/assets/night-mountains.jpg";
import LangToggle from "@/components/LangToggle";
import { dir, t } from "@/lib/i18n";

/**
 * إطار صفحات المصادقة.
 *
 * الدخول جزء من واف لا صفحة مستعارة: نفس الكحليّ، نفس الخطّ، نفس الجبل.
 * ومن يصل إليها من صفحة الهبوط يجب ألّا يشعر أنه غادر الموقع.
 *
 * والنموذج وحده في المنتصف: لا قائمة ولا روابط جانبية. الصفحة لها غرض واحد،
 * وكل ما يزيد عليه يؤخّره.
 */
export default function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="au-screen" data-waf-theme="navy" dir={dir()}>
      <img className="au-photo" src={mountains} alt="" aria-hidden="true" />

      <main className="au-card">
        <Link className="au-brand" href={LANDING_ROUTE}>
          {t("واف", "Waf")}
        </Link>

        <h1 className="au-title">{title}</h1>
        <p className="au-lede">{lede}</p>

        {children}

        {footer && <div className="au-foot">{footer}</div>}

        <LangToggle className="au-quiet" />
      </main>
    </div>
  );
}

/** رسالة خطأ بالعربية — لا نصّ Supabase الخام. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="au-error" role="alert">
      {message}
    </p>
  );
}

/**
 * ترجمة أخطاء Supabase.
 *
 * الرسالة الأصلية إنجليزية وتقنية، وبعضها يكشف ما لا يجب كشفه: «المستخدم غير
 * موجود» تخبر من يجرّب العناوين أيّها مسجَّل عندنا. فيُقال للحالتين شيء واحد.
 */
export function arabicAuthError(raw: string | undefined): string {
  const message = (raw ?? "").toLowerCase();

  if (message.includes("invalid login credentials")) return t("البريد أو كلمة المرور غير صحيحة.", "Incorrect email or password.");
  if (message.includes("email not confirmed")) {
    return t("لم يُفعَّل بريدك بعد. افتح رابط التحقّق في بريدك.", "Your email is not verified yet. Open the verification link in your inbox.");
  }
  if (message.includes("user already registered")) {
    return t("هذا البريد مسجَّل. سجّل دخولك بدل إنشاء حساب.", "This email is already registered. Sign in instead of creating an account.");
  }
  if (message.includes("password should be at least")) {
    return t("كلمة المرور قصيرة — ثمانية أحرف على الأقل.", "Password is too short. Use at least eight characters.");
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return t("محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.", "Too many attempts. Wait a minute and try again.");
  }
  if (message.includes("network") || message.includes("fetch")) {
    return t("تعذّر الاتصال. تحقّق من شبكتك ثم أعد المحاولة.", "Could not connect. Check your network and try again.");
  }

  return t("تعذّر تنفيذ العملية. حاول مرة أخرى.", "Something went wrong. Try again.");
}
