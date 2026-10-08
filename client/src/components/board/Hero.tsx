import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAY_LABELS, greetingOf, monthLabel, weekAround } from "@shared/calendar";
import mountains from "@/assets/night-mountains.jpg";
import { dir, t } from "@/lib/i18n";

const WEEKDAY_LABELS_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as const;

/**
 * الهيرو — تحيّة على صورة، ورزنامة الأسبوع في طرفه.
 *
 * التحيّة بلا اسم: الواجهة عامّة، ووضعُ اسمٍ فيها يجعلها لقطةً لشخص لا
 * منتجاً لأحد. والوقت وحده يحدّدها، فهي صادقة لكل من يفتحها.
 *
 * والرزنامة أسبوع لا شهر: صفٌّ واحد يكفي في الهيرو، ومن أراد الشهر فتح
 * التقويم. ستّة صفوف هنا تأخذ من الصورة أكثر ممّا تعطي.
 */
export default function Hero({ now = new Date() }: { now?: Date }) {
  const week = weekAround(now);
  const hour = now.getHours();
  const month = t(
    monthLabel(now.getFullYear(), now.getMonth()),
    now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  );
  const Previous = dir() === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir() === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <section className="bd-hero" aria-labelledby="bd-hero-title">
      <img className="bd-hero-photo" src={mountains} alt="" aria-hidden="true" />

      <div className="bd-hero-text">
        <p className="bd-hello">
          {t(greetingOf(now), hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening")}
          <span aria-hidden="true"> 👋</span>
        </p>
        <h1 id="bd-hero-title">{t("لننجز المزيد اليوم", "Let's get more done today")}</h1>
        <p className="bd-hero-line">{t("خطّط، ركّز، وأنجز ما يهمّك.", "Plan, focus, and finish what matters.")}</p>
      </div>

      {/*
        الرزنامة تُقرأ ولا تُستعمل بعد: الأسهم معطّلة لا مخفيّة، فيُعرف أنها
        موضع التنقّل حين يُبنى التقويم، ولا تَعِد بما لا يقع اليوم.
      */}
      <div className="bd-cal" aria-label={month}>
        <div className="bd-cal-head">
          <button type="button" className="bd-cal-arrow" disabled aria-label={t("الشهر السابق", "Previous month")}>
            <Previous size={16} aria-hidden="true" />
          </button>
          <span className="bd-cal-month">{month}</span>
          <button type="button" className="bd-cal-arrow" disabled aria-label={t("الشهر التالي", "Next month")}>
            <Next size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="bd-cal-grid" role="row">
          {WEEKDAY_LABELS.map((label, index) => (
            <abbr className="bd-cal-day" key={label} title={t(label, WEEKDAY_LABELS_EN[index])}>
              {t(label, WEEKDAY_LABELS_EN[index])}
            </abbr>
          ))}
          {week.map(day => (
            <span
              key={day.key}
              className={
                day.isToday ? "bd-cal-date is-today" : day.inMonth ? "bd-cal-date" : "bd-cal-date is-outside"
              }
              aria-current={day.isToday ? "date" : undefined}
            >
              {day.day}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
