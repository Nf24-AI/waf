import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAY_LABELS, greetingOf, monthLabel, weekAround } from "@shared/calendar";
import mountains from "@/assets/night-mountains.jpg";

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

  return (
    <section className="bd-hero" aria-labelledby="bd-hero-title">
      <img className="bd-hero-photo" src={mountains} alt="" aria-hidden="true" />

      <div className="bd-hero-text">
        <p className="bd-hello">
          {greetingOf(now)}
          <span aria-hidden="true"> 👋</span>
        </p>
        <h1 id="bd-hero-title">لننجز المزيد اليوم</h1>
        <p className="bd-hero-line">خطّط، ركّز، وأنجز ما يهمّك.</p>
      </div>

      {/*
        الرزنامة تُقرأ ولا تُستعمل بعد: الأسهم معطّلة لا مخفيّة، فيُعرف أنها
        موضع التنقّل حين يُبنى التقويم، ولا تَعِد بما لا يقع اليوم.
      */}
      <div className="bd-cal" aria-label={monthLabel(now.getFullYear(), now.getMonth())}>
        <div className="bd-cal-head">
          <button type="button" className="bd-cal-arrow" disabled aria-label="الشهر السابق">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="bd-cal-month">{monthLabel(now.getFullYear(), now.getMonth())}</span>
          <button type="button" className="bd-cal-arrow" disabled aria-label="الشهر التالي">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="bd-cal-grid" role="row">
          {WEEKDAY_LABELS.map(label => (
            <abbr className="bd-cal-day" key={label} title={label}>
              {label}
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
