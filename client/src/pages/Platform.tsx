import { ArrowLeft, ArrowUpLeft, CalendarClock, LayoutGrid, Lock } from "lucide-react";
import { Link } from "wouter";
import { SERVICES, type Service } from "@shared/services";

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
          {service.external ? "افتح في لسان جديد" : "ادخل الخدمة"}
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
    // noreferrer مع الهدف الجديد: الخدمة تعيش على أصل آخر ولا تحتاج مرجعنا.
    return (
      <a className="service-card" href={service.href} target="_blank" rel="noopener noreferrer">
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

export default function Platform() {
  const live = SERVICES.filter((service) => service.status === "live");
  const soon = SERVICES.filter((service) => service.status === "soon");

  return (
    <main className="platform-shell waf-dots" dir="rtl">
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
              <ServiceCard key={service.id} service={service} />
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
