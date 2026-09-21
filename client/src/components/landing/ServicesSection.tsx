// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, CalendarDays, ExternalLink, Users } from "lucide-react";
import { Link } from "wouter";
import { SERVICES } from "@shared/services";
import tanomah from "@/assets/village-at-dusk.jpg";

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
  icon: typeof Users;
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
    icon: Users,
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
    icon: CalendarDays,
    visual: "time",
  },
];

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
  const Icon = service.icon;
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
              <Icon size={18} />
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
      // طيف الجبال خلف القسم هو الصورة نفسها، ومسارها يأتي من البناء لا من
      // الأنماط — فيُمرَّر متغيّراً بدل تكرار الأصل في CSS.
      style={{ "--svc-ridge": `url(${tanomah})` } as React.CSSProperties}
    >
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
            {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </section>
  );
}
