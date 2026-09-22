// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { rootServices } from "@shared/services";
import Reveal from "./Reveal";

/**
 * قسم الخدمات في الوجه العام.
 *
 * خدمتان، وهذا مقصود لا نقص. البطاقتان كبيرتان والفراغ حولهما متروك على
 * حاله بدل حشوه ببطاقات «قريباً» — الخانة المحجوزة إعلان نيّة يخصّ من دخل
 * المنصّة، لا من يقف على بابها.
 *
 * النصّ هنا نصّ تعريف، وملخّص الكتالوج نصّ استعمال؛ لذلك يختلفان. أمّا
 * الوجهة فتُقرأ من shared/services.ts دائماً، فلا يتباعد رابطان لخدمة واحدة.
 */

interface LandingService {
  id: string;
  number: string;
  category: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  icon: "people" | "calendar";
  visual: "meetings" | "time";
}

/**
 * نصّ الوجه العام لكل خدمة مستقلّة.
 *
 * هو نصّ تعريف لا نصّ استعمال، فيختلف عن ملخّص الكتالوج عمداً: الأول يشرح
 * لمن لا يعرف، والثاني يذكّر من يعرف. أمّا الاسم والوجهة وكون الخدمة خارج
 * الأصل فتُقرأ من الكتالوج، فلا يتباعد طرفان لخدمة واحدة.
 */
const LANDING_COPY: Record<
  string,
  Pick<LandingService, "number" | "title" | "description" | "icon" | "visual">
> = {
  meetings: {
    number: "02",
    title: "خدمة الاجتماعات",
    description:
      "جهّز الاجتماع، شارك جدول الأعمال، أدر الحضور، واحتفظ بكل ما يهم الاجتماع في مكان واحد.",
    icon: "people",
    visual: "meetings",
  },
  time: {
    number: "01",
    title: "إدارة الوقت",
    description:
      "رتّب مهامك بين المهم والعاجل، وشاهد وقتك بوضوح، لتترك مساحة لما يهم فعلاً.",
    icon: "calendar",
    visual: "time",
  },
};

/**
 * البطاقتان مشتقّتان من الكتالوج لا مكتوبتين هنا.
 *
 * «خدمتان» في العنوان ليست ادّعاءً: هي عدد ما يقوم وحده في shared/services.ts.
 * وخدمة مستقلّة تُضاف بلا نصّ تعريف توقف البناء بدل أن تغيب عن الباب بصمت.
 *
 * الترتيب ترتيب الكتالوج، وهو ترتيب القراءة: في RTL تُقرأ اليمنى أولاً،
 * فالاجتماعات أولاً على الشاشة وفي التكديس على الجوال. الأرقام تصف الخدمة
 * لا موضعها.
 */
const LANDING_SERVICES: LandingService[] = rootServices().map(service => {
  const copy = LANDING_COPY[service.id];
  if (!copy) {
    throw new Error(`الخدمة ${service.id} مستقلّة في الكتالوج وبلا نصّ في الوجه العام`);
  }
  if (!service.href) {
    throw new Error(`الخدمة ${service.id} بلا وجهة في shared/services.ts`);
  }
  return {
    id: service.id,
    category: service.eyebrow,
    href: service.href,
    external: service.external,
    ...copy,
  };
});

/**
 * رمزا الخدمتين، مرسومان هنا لا مستورَدان من مجموعة أيقونات.
 *
 * المشروع لا يحمل أي أصل رسوميّ — لا svg ولا png في client كلّه — وبقية
 * الصفحات تأخذ أيقوناتها من lucide. هنا يُرسم الرمزان بالضبط كما في المرجع
 * بدل استعارة أقرب أيقونة جاهزة.
 */
function ServiceGlyph({ kind }: { kind: LandingService["icon"] }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.55,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.6" />
        <path d="M3.4 10.2h17.2" />
        <path d="M8.2 3.2v3.6M15.8 3.2v3.6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="9.6" cy="8.6" r="3.3" />
      <path d="M3.9 19.4c0-3.1 2.5-5 5.7-5s5.7 1.9 5.7 5" />
      <circle cx="17.4" cy="9.9" r="2.3" />
      <path d="M16.6 14.7c2.4.1 4.1 1.9 4.1 4.5" />
    </svg>
  );
}

/* رموز داخل لوح الاجتماع. صغيرة جداً، فالحدّ سميك نسبياً لتبقى مقروءة. */
function PersonGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="8.4" r="3.4" />
      <path d="M5.6 20c0-3.5 2.9-5.6 6.4-5.6s6.4 2.1 6.4 5.6" />
    </svg>
  );
}

function CameraGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
      <rect x="2.6" y="6.6" width="13.2" height="10.8" rx="2.6" />
      <path d="M15.8 12.4 21.4 8.6v6.8l-5.6-2.6z" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <rect x="9" y="2.6" width="6" height="11.4" rx="3" />
      <path d="M5.6 11.6a6.4 6.4 0 0 0 12.8 0M12 18v3.2" />
    </svg>
  );
}

/** رسم داخل البطاقة، لا أيقونة: يلمّح إلى شكل الخدمة ولا يشرحها. */
function ServiceVisual({ kind }: { kind: LandingService["visual"] }) {
  if (kind === "time") {
    return (
      <div className="svc-visual svc-visual-time" aria-hidden="true">
        <span className="svc-chip svc-chip-today">اليوم</span>
        <div className="svc-sheet">
          <span className="svc-task">
            <i className="svc-dot" />
            <i className="svc-line" />
          </span>
          <span className="svc-task is-done">
            <i className="svc-dot" />
            <i className="svc-line" />
          </span>
          <span className="svc-task">
            <i className="svc-dot" />
            <i className="svc-line" />
          </span>
        </div>
        <span className="svc-chip svc-chip-bars">
          <i /><i /><i />
        </span>
      </div>
    );
  }

  return (
    <div className="svc-visual svc-visual-meet" aria-hidden="true">
      <div className="svc-sheet svc-stage">
        <span className="svc-avatar">
          <PersonGlyph />
        </span>
        <span className="svc-avatar">
          <PersonGlyph />
        </span>
        <span className="svc-call">
          <CameraGlyph size={22} />
        </span>
        <span className="svc-pills">
          <i>
            <MicGlyph />
          </i>
          <i>
            <CameraGlyph size={13} />
          </i>
        </span>
      </div>
      <div className="svc-sheet svc-agenda">
        <span className="svc-agenda-row is-now">
          <i className="svc-dot" />
          <i className="svc-line" />
        </span>
        <span className="svc-agenda-row">
          <i className="svc-dot" />
          <i className="svc-line" />
        </span>
        <span className="svc-agenda-row">
          <i className="svc-dot" />
          <i className="svc-line" />
        </span>
        <span className="svc-agenda-row">
          <i className="svc-dot" />
          <i className="svc-line" />
        </span>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: LandingService }) {
  const enterLabel = `ادخل ${service.title}`;

  return (
    <article className="svc-card">
      <header className="svc-meta">
        <span className="svc-number">{service.number}</span>
        <i className="svc-rule" aria-hidden="true" />
        <span className="svc-category">{service.category}</span>
      </header>

      <div className="svc-body">
        <ServiceVisual kind={service.visual} />

        <div className="svc-content">
          <div className="svc-title">
            <h3>{service.title}</h3>
            <span className="svc-icon" aria-hidden="true">
              <ServiceGlyph kind={service.icon} />
            </span>
          </div>
          <p>{service.description}</p>
        </div>
      </div>

      <footer className="svc-cta">
        {service.external ? (
          // خدمة على أصل آخر: الرابط الوحيد يفتح لساناً جديداً، ولا يحتاج مرجعنا.
          <a className="svc-enter" href={service.href} target="_blank" rel="noopener noreferrer" aria-label={enterLabel}>
            ادخل الخدمة
            <span className="svc-arrow" aria-hidden="true">
              <ArrowLeft size={17} />
            </span>
          </a>
        ) : (
          <Link className="svc-enter" href={service.href} aria-label={enterLabel}>
            ادخل الخدمة
            <span className="svc-arrow" aria-hidden="true">
              <ArrowLeft size={17} />
            </span>
          </Link>
        )}

        {service.external && (
          <a
            className="svc-aside"
            href={service.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`افتح ${service.title} في لسان جديد`}
          >
            <ExternalLink size={13} aria-hidden="true" />
            افتح في لسان جديد
          </a>
        )}
      </footer>
    </article>
  );
}

export default function ServicesSection() {
  return (
    <section
      id="services"
      className="svc-section"
      aria-labelledby="svc-heading"
    >
      <div className="landing-wrap">
        <Reveal className="svc-head">
          {/*
            المؤشّر والملاحظة عمود واحد يجاور العنوان، لا صفّان يتعاقبان
            تحته: في المرجع تقع الملاحظة بمحاذاة أسفل العنوان، فارتفاع
            الترويسة هو ارتفاع أطول عموديها لا مجموعهما.
          */}
          <div className="svc-index-col">
            <div className="svc-index">
              <span className="svc-index-top">
                <i className="svc-rule" aria-hidden="true" />
                <span className="svc-number">02</span>
                <span className="svc-index-ar">الخدمات</span>
              </span>
              <span className="svc-index-en">OUR SERVICES</span>
            </div>

            <p className="svc-note">
              أدوات بسيطة
              <br />
              تركّز على ما يهم فعلاً.
            </p>
          </div>

          <div className="svc-lead">
            <p className="svc-eyebrow">خدمات واف، كما هي اليوم.</p>
            <h2 id="svc-heading">نبدأ بما نحتاجه.</h2>
            <p className="svc-sub">خدمتان، والبداية من هنا.</p>
          </div>
        </Reveal>

        {/* البطاقتان بعد الترويسة بقليل: العنوان يُقرأ أولاً ثم يُكشف ما تحته. */}
        <Reveal className="svc-cards" delay={0.12}>
          {LANDING_SERVICES.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </Reveal>

        <footer className="svc-foot">
          <span>أدوات اليوم .. لبناء غدٍ أفضل.</span>
          <span className="svc-foot-mark">
            WAF
            <i className="svc-rule" aria-hidden="true" />
            {/* السنة كما في المرجع، لا سنة التشغيل: هي سنة الإصدار لا ساعة الزائر. */}
            2025
          </span>
        </footer>
      </div>
    </section>
  );
}
