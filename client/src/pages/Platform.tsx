// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, ArrowUpLeft, CalendarClock, LayoutGrid, Lock } from "lucide-react";
import { Link } from "wouter";
import { SERVICES, derivedServices, type Service } from "@shared/services";
import mountains from "@/assets/night-mountains.jpg";

/**
 * باب واف. من يدخل يرى الخدمات المتاحة ويختار واحدة — لا يهبط داخل
 * أداة الاجتماعات كأنها كل المنتج.
 *
 * الخدمات القادمة معروضة لا مخفيّة، وبلا تاريخ: الخانة محجوزة والاسم ثابت،
 * فيعرف مدير المشروع ما الذي سيأتي من واف وما الذي عليه أن يحلّه بنفسه اليوم.
 */

const COUNT_AR = ["صفر", "واحدة", "خدمتان", "ثلاث خدمات", "أربع خدمات", "خمس خدمات", "ست خدمات", "سبع خدمات", "ثماني خدمات"];

function serviceCount(n: number) {
  return COUNT_AR[n] ?? `${n} خدمة`;
}

function ServiceCard({ service }: { service: Service }) {
  const body = (
    <>
      <div className="service-card-head">
        <p className="service-eyebrow">{service.eyebrow}</p>
        {service.status === "soon" ? (
          <span className="service-flag service-flag-soon">
            <Lock size={11} aria-hidden="true" />
            قريباً
          </span>
        ) : (
          <span className="service-flag service-flag-live">متاحة</span>
        )}
      </div>
      <h3 className="service-name">{service.name}</h3>
      <p className="service-summary">{service.summary}</p>
      {service.status === "live" && (
        <span className="service-go">
          {service.external ? <ArrowUpLeft size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}
          {service.external ? "انتقل إلى الخدمة" : "ادخل الخدمة"}
        </span>
      )}
    </>
  );

  if (service.status === "soon") {
    // لا رابط ولا زر: بطاقة تُقرأ ولا تُضغط، فلا يطارد أحد شيئاً غير موجود.
    return (
      <article className="service-card service-card-soon" aria-disabled="true">
        {body}
      </article>
    );
  }

  if (service.external) {
    // تنقل في اللسان نفسه، فلا opener يُسرَّب؛ ويبقى noreferrer لأن الأصل الآخر لا يحتاج مرجعنا.
    return (
      <a className="service-card" href={service.href} rel="noreferrer">
        {body}
      </a>
    );
  }

  return (
    <Link className="service-card" href={service.href!}>
      {body}
    </Link>
  );
}

/**
 * بطاقة الخدمة ومعها ما تُنتجه من صفحات.
 *
 * سجلّ القرارات وتقرير الحالة ليسا خدمتين: يُقرآن من الاجتماعات. فلا يأخذان
 * بطاقة ولا يُحسبان في العدد، لكنهما يبقيان على بُعد ضغطة تحت خدمتهما — فلا
 * طريق آخر إليهما من داخل واف.
 */
function ServiceSlot({ service }: { service: Service }) {
  const parts = derivedServices(service.id);
  if (parts.length === 0) return <ServiceCard service={service} />;

  return (
    <div className="service-slot has-parts">
      <ServiceCard service={service} />
      <nav className="service-parts" aria-label={`ما يتبع ${service.name}`}>
        <span className="service-parts-label">يشمل</span>
        {parts.map((part) => (
          <Link key={part.id} className="service-part" href={part.href!}>
            {part.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function Platform() {
  // العدد عدد ما يقوم وحده: ما يُشتقّ من خدمة يُعرض تحتها لا بجانبها.
  const live = SERVICES.filter((service) => service.status === "live" && !service.partOf);
  const soon = SERVICES.filter((service) => service.status === "soon");

  return (
    // سماء المنتج نفسها التي خلف لوحة الوقت وصفحات الدخول: هذه الصفحة هي
    // أول ما يُرى بعد الدخول، فلا يصحّ أن تبدو من نسخة أقدم من المنتج.
    <main className="platform-shell" data-waf-theme="navy" dir="rtl">
      <img className="platform-sky" src={mountains} alt="" aria-hidden="true" />
      <div className="platform-inner">
        <header className="platform-head">
          <div className="brand-lockup platform-lockup">
            <span className="brand-mark" aria-hidden="true">
              <LayoutGrid size={17} />
            </span>
            <div>
              <h1 className="brand-title">واف</h1>
              <p className="brand-subtitle">منصّة أدوات مدير المشروع ومالك المنتج</p>
            </div>
          </div>
          <p className="platform-lede">
            اختر الخدمة التي تحتاجها الآن. واف يبني كل خدمة على حدة، وتعمل وحدها دون أن تنتظر البقية.
          </p>
        </header>

        <section className="platform-section" aria-labelledby="live-heading">
          <div className="platform-section-head">
            <h2 id="live-heading" className="platform-section-title">
              الخدمات المتاحة
            </h2>
            <span className="platform-count">{serviceCount(live.length)}</span>
          </div>
          <div className="service-grid">
            {live.map((service) => (
              <ServiceSlot key={service.id} service={service} />
            ))}
          </div>
        </section>

        <section className="platform-section" aria-labelledby="soon-heading">
          <div className="platform-section-head">
            <h2 id="soon-heading" className="platform-section-title">
              قريباً
            </h2>
            <span className="platform-count">{serviceCount(soon.length)}</span>
          </div>
          <p className="platform-section-note">
            محجوزة بأسمائها حتى لا يُبنى الشيء نفسه مرّتين. لا تواريخ بعد.
          </p>
          <div className="service-grid">
            {soon.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        <footer className="platform-foot">
          <CalendarClock size={13} aria-hidden="true" />
          <span>واف — أدوات داخلية. كل خدمة تحفظ بياناتها في مكانها، ولا تتسرّب إلى غيرها.</span>
        </footer>
      </div>
    </main>
  );
}
