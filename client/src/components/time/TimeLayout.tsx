import React, { useState } from "react";
import { BottomNav, NavDrawer, Sidebar } from "./TimeNav";
import TopBar from "./TopBar";
import { dir } from "@/lib/i18n";

/**
 * إطار منتج إدارة الوقت: شريط جانبي على المكتب، ودرج على الجوّال، وشريط
 * علويّ فيهما معاً.
 *
 * `data-waf-theme="navy"` هنا لا على الجذر: بقيّة المنصّة تحتفظ بسمتها،
 * وهذا القسم يُقرأ على الكحليّ كما في المرجع.
 *
 * و`quiet` يُسقط التنقّل كلّه — جلسة التركيز تبدأ فيُزاح كل ما يُقرأ. أداة
 * تعد بالتركيز ثم تترك خريطةً كاملة تحت عينك لا تفي بوعدها.
 *
 * و`top` يُبدّل الشريط العلويّ وحده: صفحة حجز الوقت لها شريطها (تنقّل
 * الأيام وصيغة الوقت)، والشريط الجانبيّ يبقى فلا تنقطع عن بقيّة المنتج.
 */
export default function TimeLayout({
  children,
  quiet = false,
  top,
}: {
  children: React.ReactNode;
  quiet?: boolean;
  top?: (onOpenNav: () => void) => React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);


  if (quiet) {
    return (
      <div className="tp-frame" data-waf-theme="navy" dir={dir()}>
        <div className="tp-body">{children}</div>
      </div>
    );
  }

  return (
    <div className="tp-frame" data-waf-theme="navy" dir={dir()}>
      <Sidebar />
      <NavDrawer open={drawer} onClose={() => setDrawer(false)} />

      <div className="tp-body">
        {top ? top(() => setDrawer(true)) : <TopBar onOpenNav={() => setDrawer(true)} />}

        <main className={top ? "tp-main tp-main-wide" : "tp-main"}>{children}</main>
      </div>

      <BottomNav onMore={() => setDrawer(true)} />
    </div>
  );
}
