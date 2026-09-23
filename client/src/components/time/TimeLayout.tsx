import React, { useState } from "react";
import { BottomNav, NavDrawer, Sidebar } from "./TimeNav";
import TopBar from "./TopBar";

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
        <TopBar onOpenNav={() => setDrawer(true)} />

        <main className="tp-main">{children}</main>
      </div>

      <BottomNav onMore={() => setDrawer(true)} />
    </div>
  );
}
