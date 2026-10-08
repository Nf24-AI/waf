// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Link, useLocation } from "wouter";
import Atmosphere from "@/components/landing/Atmosphere";
import Reveal from "@/components/landing/Reveal";
import ServicesSection from "@/components/landing/ServicesSection";
import LangToggle from "@/components/LangToggle";
import { createAsciiStage, type AsciiStage, type RenderMode } from "@/lib/ascii-stage";
import { dir, pair, pick, t } from "@/lib/i18n";
import { prefersReducedMotion } from "@/lib/motion";
import { useSmoothScroll } from "@/lib/smooth-scroll";
import tanomah from "@/assets/village-at-dusk.jpg";
import { useAuthSession } from "@/contexts/AuthContext";
import { LOGIN_ROUTE, SIGNUP_ROUTE } from "@/lib/auth-routes";
import { ABOUT_ROUTE, SERVICES_ROUTE } from "@/lib/auth-routes";

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
    { id: "characters", label: t("حروف", "Characters") },
    { id: "dots", label: t("نقاط", "Dots") },
    { id: "mosaic", label: t("فسيفساء", "Mosaic") },
    { id: "halfblocks", label: t("أنصاف", "Half blocks") },
  ];

  return (
    <>
      <div className="landing-stage">
        <canvas
          ref={canvasRef}
          className="landing-canvas"
          aria-label={t(
            "قرية حجرية عند المغرب، مرسومة بحروف على شبكة عشرة بكسل",
            "A stone village at dusk, drawn in characters on a ten-pixel grid",
          )}
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
            {t("من وَفَى .. أتمَّ وأكمل.", "From the Arabic wafa: to fulfil and complete.")}
          </p>
        </div>
      </div>

      <div className="landing-wrap landing-band">
        <p className="landing-eyebrow">
          {t("منصّة أدوات مدير المشروع ومالك المنتج", "A toolkit for project managers and product owners")}
        </p>
        <p className="landing-lede">
          {t(
            "واف ليس أداة واحدة. هو باب تدخل منه فتجد الخدمة التي تحتاجها الآن — تُجهّز اجتماعاً، أو ترتّب مهامك، أو تقرأ ما تقرّر الأسبوع الماضي — وتخرج.",
            "Waf is not a single tool. It is a door: you walk in, find the service you need right now — prepare a meeting, sort your tasks, or read what was decided last week — and leave.",
          )}
        </p>
        <div className="landing-acts">
          <a className="landing-btn landing-btn-primary" href="#services">
            {t("اطّلع على الخدمات", "See the services")}
          </a>
        </div>
      </div>

      <div className="landing-wrap landing-meta">
        <span>ascii · cell 10px · original colors · hover to reveal</span>
        <span className="landing-modes" role="group" aria-label={t("نمط الرسم", "Rendering style")}>
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
  place: pair("تنومة", "Tanomah"),
  country: pair("المملكة العربية السعودية", "Saudi Arabia"),
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
        alt={t(
          "قرية حجرية في تنومة عند الغروب، نوافذها مضاءة وخلفها سلاسل الجبال",
          "A stone village in Tanomah at sunset, its windows lit, with mountain ranges behind it",
        )}
      />
      <div className="frame-wash" aria-hidden="true" />

      {/* أقواس الزوايا: علامة مطبوعة لا إطاراً — مفتوحة من جهتين. */}
      <span className="frame-corner is-tr" aria-hidden="true" />
      <span className="frame-corner is-tl" aria-hidden="true" />
      <span className="frame-corner is-br" aria-hidden="true" />
      <span className="frame-corner is-bl" aria-hidden="true" />

      <div className="frame-meta">
        <span className="frame-slug frame-slug-place">
          <b>{pick(FRAME.place)}</b>
          <i className="frame-rule" aria-hidden="true" />
          <span>{pick(FRAME.country)}</span>
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

      <Reveal className="frame-story">
        <p className="frame-label">{t("عن واف", "About Waf")}</p>
        <h2 id="about-heading">
          {t("من هناك بدأنا،", "That is where we began,")}
          <br />
          {t("ومن هنا نحكي.", "and this is where we tell it.")}
        </h2>
        <p className="frame-note">
          {t("تنومة، موطن الـ ٢٢ عاماً.", "Tanomah, home for 22 years.")}
          <br />
          {t(
            "هنا كبرت أحلامنا، وتشكّلت ملامحنا، وكانت البدايات.",
            "Our dreams grew here, we took shape here, and it all began here.",
          )}
          <br />
          {t("واليوم، نحمل ذلك المكان في كل ما نبنيه.", "Today, we carry that place into everything we build.")}
        </p>

        <p className="frame-brand">
          <span className="sr-only">{BRAND_WORD}</span>
          <span aria-hidden="true">
            {LETTERS.slice(0, typed).map((letter, i) => (
              <span key={i}>{letter}</span>
            ))}
            {caret && <span className="frame-caret" />}
          </span>
        </p>

        <p className={meaningIn ? "frame-meaning is-in" : "frame-meaning"}>
          {t("من الوفاء، ومن التمام.", "From keeping your word, and seeing things through.")}
        </p>
      </Reveal>
    </section>
  );
}

/** ارتفاع الشريط اللاصق، ليقف القفز إلى المرساة تحته لا خلفه. */
const HEADER_OFFSET = 68;

export default function Landing() {
  const { user } = useAuthSession();
  const [location] = useLocation();

  /**
   * ‎/services و‎/about يهبطان على قسمَيهما.
   *
   * القسمان في هذه الصفحة، والمساران موجودان لأن الروابط تُشارَك وتُكتب في
   * البريد. فيُنقل القارئ إلى موضعه بدل أن يُلقى في أعلى الصفحة ويبحث.
   */
  useEffect(() => {
    const anchor =
      location === SERVICES_ROUTE ? "services" : location === ABOUT_ROUTE ? "about-waf" : null;
    if (!anchor) return;
    const id = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(id);
  }, [location]);

  useSmoothScroll(true, HEADER_OFFSET);

  return (
    <div className="landing" data-waf-theme="navy" dir={dir()}>
      <Atmosphere />
      <header className="landing-topbar">
        <div className="landing-wrap landing-topbar-in">
          <div className="landing-lockup">
            <span className="landing-mark" aria-hidden="true">
              <LayoutGrid size={16} />
            </span>
            <b>{t("واف", "Waf")}</b>
          </div>
          {/*
            لا «ادخل المنصّة» هنا: الزائر يرى الخدمات أمامه، والباب إلى كل
            خدمة هو بطاقتها. دعوةٌ عامّة إلى «المنصّة» تَعِد بمكان آخر لا
            وجود له — وليس فيها اليوم إلا هذه الخدمات.
          */}
          <nav>
            <a href="#services">{t("الخدمات", "Services")}</a>
            {/* مرساة في الصفحة نفسها لا مسار: القسم أسفل هذه الصفحة. */}
            <a href="#about-waf">{t("عن واف", "About Waf")}</a>
          </nav>

          {/*
            الدعوتان تعرفان من يقرؤهما: من سجّل دخوله يرى «الرئيسية» لا
            «ابدأ الآن» — إرساله إلى التسجيل يقول له إن المنتج لا يعرفه،
            وهو يعرفه.
          */}
          <div className="landing-acts landing-topbar-acts">
            <LangToggle className="landing-btn" />
            {user ? (
              <Link className="landing-btn landing-btn-primary" href={SERVICES_ROUTE}>
                {t("الرئيسية", "Home")}
              </Link>
            ) : (
              <>
                <Link className="landing-btn" href={LOGIN_ROUTE}>
                  {t("تسجيل الدخول", "Sign in")}
                </Link>
                <Link className="landing-btn landing-btn-primary" href={SIGNUP_ROUTE}>
                  {t("ابدأ الآن", "Get started")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* اللوحة والنصّ وشريط الأنماط قسم واحد، فتستقرّ التمريرة على أوّله. */}
        <section className="landing-hero" aria-label={t("واف", "Waf")}>
          <AsciiHero />
        </section>

        <ServicesSection />
        <AboutWaf />
      </main>

      <footer className="landing-wrap landing-foot">
        <p>{t("واف — منصّة أدوات مدير المشروع ومالك المنتج", "Waf — a toolkit for project managers and product owners")}</p>
      </footer>
    </div>
  );
}
