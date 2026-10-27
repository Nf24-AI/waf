// صفحة غير موجودة: تعمل للزائر وللمستخدم المسجّل، وتعيد كلّاً منهما إلى بيته.

import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { t, useLang } from "@/lib/i18n";
import { ButtonLink } from "@/ui/Button";
import { LangToggle, ThemeToggle, Wordmark } from "@/ui/Chrome";
import { DayLine } from "@/ui/DayLine";

export default function NotFound() {
  useLang();
  const { account } = useAuth();
  const [path] = useLocation();
  const home = account ? "/today" : "/";
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Wordmark href={home} />
          <div className="ms-auto flex items-center gap-1">
            <LangToggle short />
            <ThemeToggle />
          </div>
        </div>
        <DayLine thickness={1} className="!h-[5px]" />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-24 pt-12 sm:px-6">
        <p className="tnum text-sm text-ink-3">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{t("الصفحة غير موجودة", "Page not found")}</h1>
        <p className="mt-3 max-w-xl text-ink-2">
          {t("الرابط الذي فتحته لا يقود إلى صفحة في واف. ربما تغيّر عنوانها أو كُتب الرابط ناقصاً.", "The link you opened doesn’t lead to a page in Waf. Its address may have changed, or the link is incomplete.")}
        </p>
        <p className="mt-2 max-w-full truncate text-sm text-ink-3">
          <bdi dir="ltr">{path}</bdi>
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonLink href={home} variant="solid" size="lg">
            {account ? t("عُد إلى اليوم", "Back to Today") : t("العودة إلى الرئيسية", "Back to the home page")}
          </ButtonLink>
          {account && (
            <ButtonLink href="/meetings" variant="ghost" size="lg">
              {t("افتح الاجتماعات", "Open meetings")}
            </ButtonLink>
          )}
        </div>
      </main>
    </div>
  );
}
