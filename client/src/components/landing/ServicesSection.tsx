// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { SERVICES } from "@shared/services";

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

function hrefOf(id: string) {
  const service = SERVICES.find(item => item.id === id);
  if (!service?.href) throw new Error(`الخدمة ${id} بلا وجهة في shared/services.ts`);
  return service.href;
}

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
 * الترتيب ترتيب قراءة: في RTL تُقرأ اليمنى أولاً، فالاجتماعات أولاً على
 * الشاشة وفي التكديس على الجوال. الأرقام تصف الخدمة لا موضعها.
 */
const LANDING_SERVICES: LandingService[] = [
  {
    id: "meetings",
    number: "02",
    category: "MEETINGS",
    title: "خدمة الاجتماعات",
    description:
      "جهّز الاجتماع، شارك جدول الأعمال، أدر الحضور، واحتفظ بكل ما يهم الاجتماع في مكان واحد.",
    href: hrefOf("meetings"),
    icon: "people",
    visual: "meetings",
  },
  {
    id: "time",
    number: "01",
    category: "TIME MANAGEMENT",
    title: "إدارة الوقت",
    description:
      "رتّب مهامك بين المهم والعاجل، وشاهد وقتك بوضوح، لتترك مساحة لما يهم فعلاً.",
    href: hrefOf("time"),
    external: true,
    icon: "calendar",
    visual: "time",
  },
];

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
        <span className="svc-avatar" />
        <span className="svc-avatar" />
        <span className="svc-call" />
        <span className="svc-pills">
          <i /><i />
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
      {/*
        سلسلة الجبال مرسومة لا مصوَّرة: صورة تنومة تخصّ «عن واف» في آخر
        الصفحة، وإقحامها هنا يجعل الحكاية خلفيةً للمنتج.
      */}
      <svg className="svc-ridge" viewBox="0 0 1600 220" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 78 L74 44 L152 104 L238 62 L332 126 L436 90 L548 148 L668 116 L802 162 L952 136 L1104 172 L1298 156 L1452 184 L1600 172 L1600 220 L0 220 Z" />
      </svg>

      <div className="landing-wrap">
        <div className="svc-head">
          <div className="svc-index">
            <span className="svc-index-top">
              <i className="svc-rule" aria-hidden="true" />
              <span className="svc-number">02</span>
              <span className="svc-index-ar">الخدمات</span>
            </span>
            <span className="svc-index-en">OUR SERVICES</span>
          </div>

          <div className="svc-lead">
            <p className="svc-eyebrow">خدمات واف، كما هي اليوم.</p>
            <h2 id="svc-heading">نبدأ بما نحتاجه.</h2>
            <p className="svc-sub">خدمتان، والبداية من هنا.</p>
          </div>

          <p className="svc-note">
            أدوات بسيطة
            <br />
            تركّز على ما يهم فعلاً.
          </p>
        </div>

        <div className="svc-cards">
          {LANDING_SERVICES.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        <footer className="svc-foot">
          <span>أدوات اليوم — لبناء غدٍ أفضل.</span>
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
