import React, { useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { NavDrawer, Sidebar } from "./TimeNav";

/**
 * إطار منتج إدارة الوقت: شريط جانبي على المكتب، ودرج على الجوّال، وشريط
 * علويّ فيهما معاً.
 *
 * `data-waf-theme="navy"` هنا لا على الجذر: بقيّة المنصّة تحتفظ بسمتها،
 * وهذا القسم يُقرأ على الكحليّ كما في المرجع.
 *
 * و`quiet` يُسقط التنقّل كلّه — جلسة التركيز تبدأ فيُزاح كل ما يُقرأ. أداة
 * تعد بالتركيز ثم تترك خريطةً كاملة تحت عينك لا تفي بوعدها.
 */
export default function TimeLayout({
  children,
  quiet = false,
}: {
  children: React.ReactNode;
  quiet?: boolean;
}) {
  const [drawer, setDrawer] = useState(false);

  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (quiet) {
    return (
      <div className="tp-frame" data-waf-theme="navy" dir="rtl">
        <div className="tp-body">{children}</div>
      </div>
    );
  }

  return (
    <div className="tp-frame" data-waf-theme="navy" dir="rtl">
      <Sidebar />
      <NavDrawer open={drawer} onClose={() => setDrawer(false)} />

      <div className="tp-body">
        <header className="tp-top">
          <button
            type="button"
            className="tp-burger"
            onClick={() => setDrawer(true)}
            aria-label="فتح القائمة"
            aria-expanded={drawer}
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          {/*
            البحث معروض ولا يعمل بعد. عرضُه معطّلاً أصدق من إخفائه: المرجع
            يضعه، ومن يضغطه يعرف في الحال أنه لم يُبنَ بدل أن يظنّه معطوباً.
          */}
          <div className="tp-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              disabled
              placeholder="ابحث عن مهمة، اجتماع، أو أي شيء … (قريباً)"
              aria-label="بحث — غير متاح بعد"
            />
            <span className="tp-kbd" aria-hidden="true">
              ⌘K
            </span>
          </div>

          <div className="tp-top-end">
            <time className="tp-date">{today}</time>
            <span className="tp-icon-btn" aria-hidden="true">
              <Bell size={17} />
            </span>
          </div>
        </header>

        <main className="tp-main">{children}</main>
      </div>
    </div>
  );
}
