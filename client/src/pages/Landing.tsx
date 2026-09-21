// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Link } from "wouter";
import { PLATFORM_ROUTE } from "@shared/routes";
import ServicesSection from "@/components/landing/ServicesSection";
import { prefersReducedMotion } from "@/lib/motion";
import tanomah from "@/assets/village-at-dusk.jpg";

/**
 * الوجه العام لواف — المسار الوحيد الذي يُقرأ قبل كلمة المرور.
 *
 * البطل صورة فوتوغرافية حقيقية: تنومة، ١٤ يوليو ٢٠٢٠. تُعرض كما هي ولا
 * يُرسم فوقها شيء — المعالجة كلها عناصر HTML فوق الصورة: أقواس الزوايا،
 * بيانات المكان والتاريخ والإحداثيات، وعمود الحكاية. الصورة تبقى صورة.
 *
 * الصفحة مثبَّتة على ثيم navy مهما كان ثيم مساحة العمل: سماء الصورة كحلية
 * ونوافذها ذهبية، وهي ألوان navy نفسها — وفوق القماش شبه الأسود تفقد معناها.
 */

const BRAND = "واف";
const LETTERS = Array.from(BRAND);

/** بيانات الصورة كما سجّلها صاحبها. تُعرض كما تُعرض على ظهر مطبوعة. */
const FRAME = {
  place: "تنومة",
  country: "المملكة العربية السعودية",
  date: "2020 . 07 . 14",
  lat: "18.9881° N",
  lng: "42.0669° E",
  placeEn: "TANOMAH",
  countryEn: "SAUDI ARABIA",
};

export default function Landing() {
  const reduced = prefersReducedMotion();

  // النصّ مقروء من أول لحظة؛ الحركة تُضاف فوقه ولا تحجبه.
  const [typed, setTyped] = useState(reduced ? LETTERS.length : 0);
  const [meaningIn, setMeaningIn] = useState(reduced);
  const [caret, setCaret] = useState(!reduced);

  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    LETTERS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setTyped(i + 1), 420 + i * 285));
    });
    const done = 420 + LETTERS.length * 285;
    timers.push(window.setTimeout(() => setMeaningIn(true), done + 520));
    timers.push(window.setTimeout(() => setCaret(false), done + 1300));
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  return (
    <div className="landing" data-waf-theme="navy" dir="rtl">
      <header className="landing-topbar">
        <div className="landing-wrap landing-topbar-in">
          <div className="landing-lockup">
            <span className="landing-mark" aria-hidden="true">
              <LayoutGrid size={16} />
            </span>
            <b>واف</b>
          </div>
          <nav>
            <a href="#services">الخدمات</a>
            <a href="#story">الحكاية</a>
            <Link className="landing-go-btn" href={PLATFORM_ROUTE}>
              ادخل المنصّة
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="frame" id="story" aria-labelledby="story-heading">
          <img
            className="frame-photo"
            src={tanomah}
            alt="قرية حجرية في تنومة عند الغروب، نوافذها مضاءة وخلفها سلاسل الجبال"
          />
          <div className="frame-wash" aria-hidden="true" />

          {/* أقواس الزوايا: علامة مطبوعة لا إطاراً — مفتوحة من جهتين. */}
          <span className="frame-corner is-tr" aria-hidden="true" />
          <span className="frame-corner is-tl" aria-hidden="true" />
          <span className="frame-corner is-br" aria-hidden="true" />
          <span className="frame-corner is-bl" aria-hidden="true" />

          <div className="frame-meta">
            <span className="frame-slug frame-slug-place">
              <b>{FRAME.place}</b>
              <i className="frame-rule" aria-hidden="true" />
              <span>{FRAME.country}</span>
            </span>
            <span className="frame-slug frame-slug-date">
              <time dateTime="2020-07-14">{FRAME.date}</time>
            </span>
            <span className="frame-slug frame-slug-geo">
              <span>{FRAME.lat}</span>
              <span>{FRAME.lng}</span>
            </span>
            <span className="frame-slug frame-slug-en">
              <span>{FRAME.placeEn}</span>
              <span>{FRAME.countryEn}</span>
            </span>
          </div>

          <div className="frame-story">
            <h1 id="story-heading">
              من هناك بدأنا،
              <br />
              ومن هنا نحكي.
            </h1>
            <p className="frame-note">
              تنومة، موطن الـ ٢٢ عاماً.
              <br />
              هنا كبرت أحلامنا، وتشكّلت ملامحنا، وكانت البدايات.
              <br />
              واليوم، نحمل ذلك المكان في كل ما نبنيه.
            </p>

            <p className="frame-brand">
              <span className="sr-only">{BRAND}</span>
              <span aria-hidden="true">
                {LETTERS.slice(0, typed).map((letter, i) => (
                  <span key={i}>{letter}</span>
                ))}
                {caret && <span className="frame-caret" />}
              </span>
            </p>

            <p className={meaningIn ? "frame-meaning is-in" : "frame-meaning"}>
              من الوفاء، ومن التمام.
              <br />
              أن يكون كل شيء كما ينبغي أن يكون.
            </p>
          </div>
        </section>

        <ServicesSection />
      </main>

      <footer className="landing-wrap landing-foot">
        <p>واف — منصّة أدوات مدير المشروع ومالك المنتج</p>
        <Link href={PLATFORM_ROUTE}>ادخل المنصّة</Link>
      </footer>
    </div>
  );
}
