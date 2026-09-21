// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Link } from "wouter";
import { PLATFORM_ROUTE } from "@shared/routes";
import ServicesSection from "@/components/landing/ServicesSection";
import { createAsciiStage, type AsciiStage, type RenderMode } from "@/lib/ascii-stage";
import { prefersReducedMotion } from "@/lib/motion";
import tanomah from "@/assets/village-at-dusk.jpg";

/**
 * الوجه العام لواف — المسار الوحيد الذي يُقرأ قبل كلمة المرور.
 *
 * الترتيب: شريط، ثم اللوحة، ثم الخدمات، ثم «عن واف» آخر قسم قبل التذييل.
 * صورة تنومة تظهر مرّتين بمعنيين مختلفين: في الأعلى مقروءة حروفاً على شبكة
 * — لوحة لا صورة — وفي «عن واف» صورة فوتوغرافية كما التُقطت، ببياناتها.
 */

const BRAND_WORD = "وَاف";

/**
 * الحركة تلتصق بحرفها، فالخطوة الأولى «وَ» لا «و».
 *
 * تغليف حروف عربية في span يكسر الوصل عادةً. هنا لا يكسره لأن «و» و«ا» لا
 * يتّصلان بما بعدهما أصلاً، فـ«واف» ثلاثة أشكال منفصلة في كل الأحوال. اسم
 * آخر فيه حرف واصل يحتاج حيلة أخرى.
 */
function clusters(word: string) {
  const combining = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;
  const out: string[] = [];
  for (const ch of word) {
    if (out.length && combining.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

const LETTERS = clusters(BRAND_WORD);

/** الكتابة حرفاً حرفاً، ثم سكتة، ثم يظهر المعنى، ثم يُرفع المؤشر. */
function useTypedBrand(reduced: boolean) {
  const [typed, setTyped] = useState(reduced ? LETTERS.length : 0);
  const [meaningIn, setMeaningIn] = useState(reduced);
  const [caret, setCaret] = useState(!reduced);
  const [done, setDone] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    LETTERS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setTyped(i + 1), 380 + i * 285));
    });
    const end = 380 + LETTERS.length * 285;
    timers.push(window.setTimeout(() => setMeaningIn(true), end + 520));
    timers.push(
      window.setTimeout(() => {
        setCaret(false);
        setDone(true);
      }, end + 1300),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  return { typed, meaningIn, caret, done };
}

/**
 * اللوحة: الصورة نفسها مقروءة خليةً خلية وأعيد رسمها بالحروف.
 *
 * الاسم لا يُوضع بإحداثيات مكتوبة — المحرّك يقيس الصورة ويعطي أخفض منطقة
 * حافّةً وضوءاً، فلا يقع على بيت ولا نافذة، ويعيد الحساب عند كل تغيّر مقاس.
 */
function AsciiHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<AsciiStage | null>(null);

  const [mode, setMode] = useState<RenderMode>("characters");
  const [place, setPlace] = useState({ x: 50, y: 42 });

  const reduced = prefersReducedMotion();
  const { typed, meaningIn, caret, done } = useTypedBrand(reduced);

  const getBrandBox = useCallback(() => {
    const brand = brandRef.current;
    const ghost = ghostRef.current;
    if (!brand) return null;
    // العرض من النسخة الشبح: أثناء الكتابة يكون الاسم المرئي أضيق من نهايته.
    const width = ghost ? ghost.getBoundingClientRect().width : brand.getBoundingClientRect().width;
    return { width: Math.max(width, brand.getBoundingClientRect().width), height: brand.offsetHeight };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = createAsciiStage(canvas, tanomah, {
      getBrandBox,
      onPlace: (x, y) => setPlace({ x, y }),
    });
    stageRef.current = stage;
    return () => {
      stage.destroy();
      stageRef.current = null;
    };
  }, [getBrandBox]);

  useEffect(() => {
    stageRef.current?.setMode(mode);
  }, [mode]);

  // بعد انتهاء الكتابة يعود الاسم إلى عرضه الكامل، فيُعاد حساب موضعه.
  useEffect(() => {
    if (done) stageRef.current?.reposition();
  }, [done]);

  // عرض الاسم يتغيّر حين تحلّ خطوط ثمانية محلّ الاحتياطي، فيُعاد الحساب.
  useEffect(() => {
    if (!document.fonts?.ready) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) stageRef.current?.reposition();
    });
    return () => {
      alive = false;
    };
  }, []);

  const MODES: { id: RenderMode; label: string }[] = [
    { id: "characters", label: "حروف" },
    { id: "dots", label: "نقاط" },
    { id: "mosaic", label: "فسيفساء" },
    { id: "halfblocks", label: "أنصاف" },
  ];

  return (
    <>
      <div className="landing-stage">
        <canvas
          ref={canvasRef}
          className="landing-canvas"
          aria-label="قرية حجرية عند المغرب، مرسومة بحروف على شبكة عشرة بكسل"
        />
        <div className="landing-brand" ref={brandRef} style={{ left: `${place.x}%`, top: `${place.y}%` }}>
          <h1 className="landing-brand-word">
            <span className="landing-brand-ghost" ref={ghostRef} aria-hidden="true">
              {BRAND_WORD}
            </span>
            <span className="sr-only">{BRAND_WORD}</span>
            <span aria-hidden="true">
              {LETTERS.slice(0, typed).map((letter, i) => (
                <span key={i}>{letter}</span>
              ))}
              {caret && <span className="landing-caret" />}
            </span>
          </h1>
          <p className={meaningIn ? "landing-brand-meaning is-in" : "landing-brand-meaning"}>
            من وَفَى — أتمَّ وأكمل.
          </p>
        </div>
      </div>

      <div className="landing-wrap landing-band">
        <p className="landing-eyebrow">منصّة أدوات مدير المشروع ومالك المنتج</p>
        <p className="landing-lede">
          واف ليس أداة واحدة. هو باب تدخل منه فتجد الخدمة التي تحتاجها الآن — تُجهّز اجتماعاً، أو
          ترتّب مهامك، أو تقرأ ما تقرّر الأسبوع الماضي — وتخرج.
        </p>
        <div className="landing-acts">
          <Link className="landing-btn landing-btn-primary" href={PLATFORM_ROUTE}>
            ادخل المنصّة
          </Link>
          <a className="landing-btn landing-btn-ghost" href="#services">
            اطّلع على الخدمات
          </a>
        </div>
      </div>

      <div className="landing-wrap landing-meta">
        <span>ascii · cell 10px · original colors · hover to reveal</span>
        <span className="landing-modes" role="group" aria-label="نمط الرسم">
          {MODES.map(item => (
            <button
              key={item.id}
              type="button"
              className="landing-chip"
              title={item.label}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.id}
            </button>
          ))}
        </span>
      </div>
    </>
  );
}

/** بيانات اللقطة كما سجّلها صاحبها. تُعرض كما تُعرض على ظهر مطبوعة. */
const FRAME = {
  place: "تنومة",
  country: "المملكة العربية السعودية",
  date: "2020 . 07 . 14",
  lat: "18.9881° N",
  lng: "42.0669° E",
  placeEn: "TANOMAH",
  countryEn: "SAUDI ARABIA",
};

/**
 * «عن واف»: آخر قسم قبل التذييل، ومقصده تعريف لا افتتاح.
 *
 * هنا تُعرض الصورة كما التُقطت — img لا canvas، ولا يُرسم فوقها شيء. كل
 * المعالجة عناصر فوقها: أقواس الزوايا، والمكان والتاريخ والإحداثيات.
 */
function AboutWaf() {
  const reduced = prefersReducedMotion();
  const { typed, meaningIn, caret } = useTypedBrand(reduced);

  return (
    <section className="frame" id="about-waf" aria-labelledby="about-heading">
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
        <p className="frame-label">عن واف</p>
        <h2 id="about-heading">
          من هناك بدأنا،
          <br />
          ومن هنا نحكي.
        </h2>

        <p className="frame-brand">
          <span className="sr-only">{BRAND_WORD}</span>
          <span aria-hidden="true">
            {LETTERS.slice(0, typed).map((letter, i) => (
              <span key={i}>{letter}</span>
            ))}
            {caret && <span className="frame-caret" />}
          </span>
        </p>

        <p className={meaningIn ? "frame-meaning is-in" : "frame-meaning"}>من الوفاء، ومن التمام.</p>
      </div>
    </section>
  );
}

export default function Landing() {
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
            {/* مرساة في الصفحة نفسها لا مسار: القسم أسفل هذه الصفحة. */}
            <a href="#about-waf">عن واف</a>
            <Link className="landing-go-btn" href={PLATFORM_ROUTE}>
              ادخل المنصّة
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <AsciiHero />
        <ServicesSection />
        <AboutWaf />
      </main>

      <footer className="landing-wrap landing-foot">
        <p>واف — منصّة أدوات مدير المشروع ومالك المنتج</p>
        <Link href={PLATFORM_ROUTE}>ادخل المنصّة</Link>
      </footer>
    </div>
  );
}
