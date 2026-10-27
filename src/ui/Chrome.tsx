// عناصر الإطار المشتركة: الشعار، مبدّل اللغة، مبدّل المظهر.

import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { setLang, t, useLang } from "@/lib/i18n";
import { cx } from "./cx";

export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cx("press inline-flex items-baseline gap-2 rounded-sm", className)} aria-label={t("واف — الرئيسية", "Waf — home")}>
      <span className="font-display text-[1.6rem] leading-none font-bold tracking-tight">وَاف</span>
    </Link>
  );
}

/** يعرض اللغة المقصودة بلغتها: "English" في الواجهة العربية و"العربية" في الإنجليزية */
export function LangToggle({ short = false, className }: { short?: boolean; className?: string }) {
  const lang = useLang();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      lang={next}
      className={cx("press h-9 rounded-sm px-2.5 text-sm font-medium text-ink-2 hover:bg-sunk hover:text-ink", className)}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      {short ? (next === "en" ? "EN" : "ع") : next === "en" ? "English" : "العربية"}
    </button>
  );
}

type Theme = "system" | "light" | "dark";
const THEME_KEY = "waf:theme";

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyStoredTheme() {
  const v = readTheme();
  if (v === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", v);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    try {
      if (theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* بلا تخزين */
    }
    applyStoredTheme();
  }, [theme]);
  const order: Theme[] = ["system", "light", "dark"];
  const next = order[(order.indexOf(theme) + 1) % 3];
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const name = { system: t("حسب الجهاز", "Match device"), light: t("فاتح", "Light"), dark: t("داكن", "Dark") };
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cx("press inline-flex size-9 items-center justify-center rounded-sm text-ink-2 hover:bg-sunk hover:text-ink", className)}
      aria-label={t(`المظهر: ${name[theme]}. التالي: ${name[next]}`, `Theme: ${name[theme]}. Next: ${name[next]}`)}
      title={name[theme]}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}
