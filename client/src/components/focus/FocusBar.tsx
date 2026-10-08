import React from "react";
import { Timer } from "lucide-react";
import { Link } from "wouter";
import { TIME_MANAGEMENT_ROUTE } from "@shared/routes";
import LangToggle from "@/components/LangToggle";
import { useAuthSession } from "@/contexts/AuthContext";
import { t } from "@/lib/i18n";

/**
 * شريط جلسة التركيز.
 *
 * الإطار قائم بذاته، فالشريط لا يقود إلى إطارٍ آخر ولا إلى صفحةٍ مشتركة: فيه
 * مخرجٌ واحد إلى صفحة الإطارات، والمؤقّت الحيّ، واللغة، والخروج من الحساب.
 */
export default function FocusBar({ liveTime }: { liveTime: string | null }) {
  const { user, signOut } = useAuthSession();
  const name = (user?.user_metadata?.name as string | undefined)?.trim() || user?.email || t("الحساب", "Account");

  return (
    <header className="ft-nav">
      <div className="ft-nav-in">
        <Link className="ft-brand" href={TIME_MANAGEMENT_ROUTE} aria-label={t("العودة إلى الإطارات", "Back to frameworks")}>
          {t("واف", "Waf")}
        </Link>

        <nav aria-label={t("جلسة التركيز", "Focus session")}>
          <span className="ft-nav-timer" data-live={liveTime !== null}>
            <Timer size={14} aria-hidden="true" />
            <span dir="ltr">{liveTime ?? "00:00"}</span>
            <i aria-hidden="true" />
          </span>
        </nav>

        <div className="ft-nav-end">
          <LangToggle className="ft-nav-link" short />
          <span className="ft-nav-user" dir="auto">
            {name}
          </span>
          <button type="button" className="ft-nav-cta" onClick={() => void signOut()}>
            {t("تسجيل الخروج", "Sign Out")}
          </button>
        </div>
      </div>
    </header>
  );
}
