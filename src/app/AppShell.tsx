// إطار التطبيق بعد الدخول: شريط علوي يحمل خط اليوم في حافته، وتنقّل بين ثلاث مساحات.
// على الجوّال ينزل التنقّل إلى شريط سفلي في متناول الإبهام.

import * as DM from "@radix-ui/react-dropdown-menu";
import { CalendarClock, LogOut, Sun as Today, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { signOut, useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { LangToggle, ThemeToggle, Wordmark } from "@/ui/Chrome";
import { cx } from "@/ui/cx";
import { DayLine } from "@/ui/DayLine";

const NAV = [
  { href: "/today", match: ["/today"], icon: Today, ar: "اليوم", en: "Today" },
  { href: "/meetings", match: ["/meetings", "/decisions", "/status"], icon: Users, ar: "الاجتماعات", en: "Meetings" },
  { href: "/time", match: ["/time", "/waf"], icon: CalendarClock, ar: "الوقت", en: "Time" },
];

function useActive() {
  const [path] = useLocation();
  return (match: string[]) => match.some((m) => path === m || path.startsWith(`${m}/`));
}

function AccountMenu() {
  const { account, demo } = useAuth();
  if (!account) return null;
  const initial = account.name.trim().charAt(0) || "؟";
  return (
    <DM.Root dir={document.documentElement.dir as "rtl" | "ltr"}>
      <DM.Trigger asChild>
        <button
          type="button"
          className="press inline-flex size-9 items-center justify-center rounded-full bg-dusk-wash font-display text-sm font-semibold text-dusk"
          aria-label={t(`حسابك: ${account.name}`, `Your account: ${account.name}`)}
        >
          {initial}
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="waf-pop z-50 min-w-60 rounded-md border border-line bg-sheet p-1.5 text-sm shadow-[var(--shadow-float)]">
          <div className="px-2.5 py-2">
            <p className="font-medium">{account.name}</p>
            <p className="truncate text-xs text-ink-3" dir="ltr">
              {account.email}
            </p>
            {demo && <p className="mt-2 rounded-sm bg-saffron-wash px-2 py-1 text-xs text-saffron-ink">{t("عرض تجريبي: البيانات محفوظة في هذا المتصفّح فقط.", "Demo: data is kept in this browser only.")}</p>}
          </div>
          {!demo && (
            <>
              <DM.Separator className="my-1 h-px bg-line" />
              <DM.Item
                onSelect={() => signOut()}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-ink-2 outline-none data-[highlighted]:bg-sunk data-[highlighted]:text-ink"
              >
                <LogOut className="size-4" />
                {t("تسجيل الخروج", "Sign out")}
              </DM.Item>
            </>
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const isActive = useActive();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-sm focus:bg-inverse focus:px-3 focus:py-2 focus:text-on-inverse">
        {t("تخطَّ إلى المحتوى", "Skip to content")}
      </a>
      <header className="no-print sticky top-0 z-40 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className={cx("mx-auto flex h-14 items-center gap-2 px-4 sm:px-6", wide ? "max-w-[96rem]" : "max-w-6xl")}>
          <Wordmark href="/today" className="me-4" />
          <nav aria-label={t("المساحات", "Spaces")} className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const on = isActive(n.match);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx("press relative h-9 rounded-sm px-3 text-sm font-medium leading-9 transition-colors", on ? "text-ink" : "text-ink-2 hover:bg-sunk hover:text-ink")}
                >
                  {t(n.ar, n.en)}
                  {on && <span className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-ink" aria-hidden />}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <LangToggle short />
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
        <DayLine thickness={1} showNow className="!h-[5px] -mb-[2px]" />
      </header>

      <main id="main" className={cx("mx-auto w-full flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12", wide ? "max-w-[96rem]" : "max-w-6xl")}>
        {children}
      </main>

      <nav
        aria-label={t("المساحات", "Spaces")}
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-3">
          {NAV.map((n) => {
            const on = isActive(n.match);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cx("press flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-ink" : "text-ink-3")}>
                <Icon className="size-[22px]" strokeWidth={on ? 2.1 : 1.6} />
                {t(n.ar, n.en)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** رأس الصفحة داخل التطبيق: عنوان، وسطر يقول ما تفعله الصفحة، وأفعالها */
export function PageHead({ title, lede, actions, back }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-72">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex text-sm text-ink-2 hover:text-ink">
            <span aria-hidden className="me-1 inline-block rtl:rotate-180">←</span>
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {lede && <p className="mt-1.5 max-w-2xl text-ink-2">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
