// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpLeft, LayoutGrid } from "lucide-react";
import { Link } from "wouter";
import { SERVICES, type Service } from "@shared/services";
import { PLATFORM_ROUTE } from "@shared/routes";
import { createAsciiStage, type AsciiStage, type RenderMode } from "@/lib/ascii-stage";
import { prefersReducedMotion } from "@/lib/motion";
import villageAtDusk from "@/assets/village-at-dusk.jpg";

/**
 * الوجه العام لواف — المسار الوحيد الذي يُقرأ قبل كلمة المرور.
 *
 * البطل صورة قرية حجرية عند المغرب، تُعاد رسماً بالحروف على شبكة عشرة بكسل
 * (انظر lib/ascii-stage.ts). سماؤها كحلية ونوافذها ذهبية، وهي ألوان ثيم navy
 * نفسها — لذلك تُثبَّت الصفحة على navy مهما كان ثيم مساحة العمل: الصورة تفقد
 * معناها فوق القماش شبه الأسود.
 *
 * الاسم لا يُوضع بإحداثيات مكتوبة. المحرّك يقيس الصورة ويعطي أخفض منطقة
 * حافّةً وضوءاً، فلا يقع «وَاف» على بيت ولا سطح ولا نافذة، ويعيد الحساب عند
 * كل تغيّر مقاس — فالجوال يتموضع وحده.
 */

const BRAND_WORD = "وَاف";
const BRAND_MEANING = "من وَفَى — أتمَّ وأكمل.";

const MODES: { id: RenderMode; label: string }[] = [
  { id: "characters", label: "حروف" },
  { id: "dots", label: "نقاط" },
  { id: "mosaic", label: "فسيفساء" },
  { id: "halfblocks", label: "أنصاف" },
];

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

function ServiceCard({ service }: { service: Service }) {
  const body = (
    <>
      <div className="landing-card-head">
        <p className="landing-eyebrow">{service.eyebrow}</p>
        <span className={service.status === "live" ? "landing-flag landing-flag-live" : "landing-flag"}>
          {service.status === "live" ? "متاحة" : "قريباً"}
        </span>
      </div>
      <h3>{service.name}</h3>
      <p>{service.summary}</p>
      {service.status === "live" && (
        <span className="landing-go">
          {service.external ? <ArrowUpLeft size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}
          {service.external ? "افتح في لسان جديد" : "ادخل الخدمة"}
        </span>
      )}
    </>
  );

  if (service.status === "soon") {
    // بطاقة تُقرأ ولا تُضغط، فلا يطارد أحد شيئاً غير موجود.
    return (
      <article className="landing-card landing-card-soon" aria-disabled="true">
        {body}
      </article>
    );
  }

  if (service.external) {
    return (
      <a className="landing-card" href={service.href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }

  // رابط داخلي: يقود إلى البوّابة، وهذا هو المقصود — الهبوط يُقرأ بلا كلمة
  // مرور، والدخول يطلبها.
  return (
    <Link className="landing-card" href={service.href!}>
      {body}
    </Link>
  );
}

export default function Landing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<AsciiStage | null>(null);

  const [mode, setMode] = useState<RenderMode>("characters");
  const [place, setPlace] = useState({ x: 50, y: 42 });

  const reduced = prefersReducedMotion();

  // مع تقليل الحركة: الاسم كامل من أول لحظة بلا مؤشر. النص لا يُترك مخفيّاً
  // ينتظر مؤقّتاً في أي حال — الحركة تُضاف فوق حالة مقروءة.
  const [typed, setTyped] = useState(reduced ? LETTERS.length : 0);
  const [meaningIn, setMeaningIn] = useState(reduced);
  const [caret, setCaret] = useState(!reduced);

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
    const stage = createAsciiStage(canvas, villageAtDusk, {
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

  // الكتابة: حرف كل ٢٨٥ مللي، ثم سكتة، ثم يظهر المعنى، ثم يُرفع المؤشر.
  // المجموع نحو ٢٫٦ ثانية.
  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    LETTERS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setTyped(i + 1), 380 + i * 285));
    });
    const done = 380 + LETTERS.length * 285;
    timers.push(window.setTimeout(() => setMeaningIn(true), done + 520));
    timers.push(
      window.setTimeout(() => {
        setCaret(false);
        stageRef.current?.reposition();
      }, done + 1300),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

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

  const live = SERVICES.filter(service => service.status === "live");
  const soon = SERVICES.filter(service => service.status === "soon");

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
            <a href="#craft">الواجهة</a>
            <Link className="landing-go-btn" href={PLATFORM_ROUTE}>
              ادخل المنصّة
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <div className="landing-stage">
          <canvas
            ref={canvasRef}
            className="landing-canvas"
            aria-label="قرية حجرية عند المغرب، مرسومة بحروف على شبكة عشرة بكسل"
          />
          <div
            className="landing-brand"
            ref={brandRef}
            style={{ left: `${place.x}%`, top: `${place.y}%` }}
          >
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
              {BRAND_MEANING}
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

        <section id="services" className="landing-wrap landing-section">
          <div className="landing-sec-head">
            <p className="landing-eyebrow">Available now</p>
            <h2>الخدمات المتاحة</h2>
            <p>{`${live.length === 4 ? "أربع خدمات" : `${live.length} خدمة`} تعمل اليوم. كل واحدة تُفتح وحدها وتُستعمل وحدها.`}</p>
          </div>
          <div className="landing-grid">
            {live.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        <section className="landing-wrap landing-section landing-section-tight">
          <div className="landing-sec-head">
            <p className="landing-eyebrow">Reserved</p>
            <h2>الخانة محجوزة</h2>
            <p>
              هذه ليست وعداً بتاريخ. هي إعلان نيّة: الاسم ثابت والخانة محجوزة، حتى لا يبني أحد نفس
              الشيء في مكان آخر.
            </p>
          </div>
          <div className="landing-grid">
            {soon.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        <section id="craft" className="landing-craft waf-dots">
          <div className="landing-wrap">
            <div className="landing-sec-head">
              <p className="landing-eyebrow">Canvas2D · characters mode</p>
              <h2>اللوحة في الأعلى ليست صورة</h2>
              <p>
                هي صورة قرية حجرية عند المغرب، تُقرأ خليةً خلية: كل مربّع عشرة بكسل يُقاس متوسط لونه
                وضوئه، ثم يُستبدل بحرف واحد بحجم ذلك الضوء ولونه الأصلي. سماء كحلية ونوافذ ذهبية —
                وهي نفسها ألوان واف.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-wrap landing-foot">
        <p>واف — منصّة أدوات مدير المشروع ومالك المنتج</p>
        <p>
          الوصفة:{" "}
          <a href="https://21st.dev/community/ascii" target="_blank" rel="noopener noreferrer">
            21st.dev · ascii
          </a>
        </p>
      </footer>
    </div>
  );
}
