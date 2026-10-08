// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, ArrowRight, CalendarClock, LayoutGrid, Timer } from "lucide-react";
import { Link } from "wouter";
import { PLATFORM_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import mountains from "@/assets/night-mountains.jpg";
import LangToggle from "@/components/LangToggle";
import { dir, pair, pick, t } from "@/lib/i18n";

/**
 * إدارة الوقت — باب إلى ثلاثة إطارات، لا أكثر.
 *
 * كل إطار منتجٌ قائم بذاته: بتصميمه ومهامه، ولا يحتاج شيئاً قبله ولا يقود إلى
 * غيره. فهذه الصفحة تعرضها متجاورةً وتترك الاختيار — لا قائمة مهام هنا ولا
 * إعدادات ولا خطوات، لأن شيئاً منها ليس شرطاً لدخول أيّها.
 */

const FRAMEWORKS = [
  {
    id: "eisenhower",
    href: TIME_METHOD_ROUTES.eisenhower,
    icon: LayoutGrid,
    eyebrow: "EISENHOWER MATRIX",
    name: pair("مصفوفة أيزنهاور", "Eisenhower matrix"),
    summary: pair(
      "رتّب مهامك بين المهم والعاجل، فيظهر ما يستحق وقتك اليوم وما يُفوَّض أو يُترك.",
      "Sort tasks by importance and urgency to see what deserves today, what to delegate, and what to drop.",
    ),
  },
  {
    id: "time-blocking",
    href: TIME_METHOD_ROUTES.timeBlocking,
    icon: CalendarClock,
    eyebrow: "TIME BLOCKING",
    name: pair("حجز الوقت", "Time blocking"),
    summary: pair(
      "ضع يومك على جدول واحد: لكل مهمة ساعتها، وترى أين يذهب وقتك قبل أن يذهب.",
      "Lay your day on one timeline: every task gets its hour, and you see where the time goes before it does.",
    ),
  },
  {
    id: "focus",
    href: TIME_METHOD_ROUTES.focus,
    icon: Timer,
    eyebrow: "FOCUS SESSION",
    name: pair("جلسة التركيز", "Focus session"),
    summary: pair(
      "مؤقّت وبومودورو وساعة إيقاف على مسرح واحد، مع أصوات تعينك على البقاء فيما بين يديك.",
      "A timer, Pomodoro and stopwatch on one stage, with sounds that help you stay with what is in front of you.",
    ),
  },
] as const;

export default function TimeManagement() {
  const Back = dir() === "rtl" ? ArrowRight : ArrowLeft;
  const Go = dir() === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <main className="platform-shell" data-waf-theme="navy" dir={dir()}>
      <img className="platform-sky" src={mountains} alt="" aria-hidden="true" />
      <div className="platform-inner">
        <header className="platform-head">
          <div className="tf-bar">
            <Link className="tf-back" href={PLATFORM_ROUTE}>
              <Back size={15} aria-hidden="true" />
              {t("الخدمات", "Services")}
            </Link>
            <LangToggle className="tf-back" />
          </div>
          <div className="brand-lockup platform-lockup">
            <span className="brand-mark" aria-hidden="true">
              <CalendarClock size={17} />
            </span>
            <div>
              <h1 className="brand-title">{t("إدارة الوقت", "Time management")}</h1>
              <p className="brand-subtitle">{t("ثلاثة إطارات، كل واحد يعمل وحده", "Three frameworks, each works on its own")}</p>
            </div>
          </div>
          <p className="platform-lede">
            {t(
              "اختر الإطار الذي تريده وادخل مباشرة. لا إعداد قبله، ولا يحتاج أحدها الآخر.",
              "Pick the framework you want and go straight in. Nothing to set up first, and none of them needs another.",
            )}
          </p>
        </header>

        <section className="platform-section" aria-labelledby="frameworks-heading">
          <div className="platform-section-head">
            <h2 id="frameworks-heading" className="platform-section-title">
              {t("الإطارات", "Frameworks")}
            </h2>
            <span className="platform-count">{t("ثلاثة إطارات", "Three frameworks")}</span>
          </div>
          <div className="service-grid">
            {FRAMEWORKS.map(framework => (
              <Link key={framework.id} className="service-card" href={framework.href}>
                <div className="service-card-head">
                  <p className="service-eyebrow">{framework.eyebrow}</p>
                  <framework.icon size={16} aria-hidden="true" />
                </div>
                <h3 className="service-name">{pick(framework.name)}</h3>
                <p className="service-summary">{pick(framework.summary)}</p>
                <span className="service-go">
                  <Go size={15} aria-hidden="true" />
                  {t("ادخل الإطار", "Open framework")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
