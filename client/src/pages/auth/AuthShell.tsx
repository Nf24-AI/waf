import React from "react";
import { Link } from "wouter";
import { LANDING_ROUTE } from "@shared/routes";
import tanomah from "@/assets/village-at-dusk.jpg";

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
    <div className="au-screen" data-waf-theme="navy" dir="rtl">
      <img className="au-photo" src={tanomah} alt="" aria-hidden="true" />

      <main className="au-card">
        <Link className="au-brand" href={LANDING_ROUTE}>
          واف
        </Link>

        <h1 className="au-title">{title}</h1>
        <p className="au-lede">{lede}</p>

        {children}

        {footer && <div className="au-foot">{footer}</div>}
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

  if (message.includes("invalid login credentials")) return "البريد أو كلمة المرور غير صحيحة.";
  if (message.includes("email not confirmed")) return "لم يُفعَّل بريدك بعد. افتح رابط التحقّق في بريدك.";
  if (message.includes("user already registered")) return "هذا البريد مسجَّل. سجّل دخولك بدل إنشاء حساب.";
  if (message.includes("password should be at least")) return "كلمة المرور قصيرة — ثمانية أحرف على الأقل.";
  if (message.includes("rate limit") || message.includes("too many")) return "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.";
  if (message.includes("network") || message.includes("fetch")) return "تعذّر الاتصال. تحقّق من شبكتك ثم أعد المحاولة.";

  return "تعذّر تنفيذ العملية. حاول مرة أخرى.";
}
