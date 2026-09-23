import React from "react";
import { MobileBottomNav, Sidebar } from "./TimeNav";

/**
 * الإطار المشترك لصفحات إدارة الوقت.
 *
 * شريط جانبي على المكتب وشريط سفلي على الجوّال — الاثنان يعرضان الأقسام
 * نفسها، فلا يتعلّم المستخدم خريطتين لنفس المكان.
 *
 * و`quiet` تخفيهما: جلسة التركيز تبدأ فيُزاح كل ما يُقرأ. الأداة التي تعد
 * بالتركيز ثم تترك خمسة روابط تحت إبهامك تنقض وعدها.
 */
export default function TimeLayout({
  children,
  quiet = false,
  dots = true,
  shell = "tm-shell",
}: {
  children: React.ReactNode;
  quiet?: boolean;
  dots?: boolean;
  shell?: string;
}) {
  return (
    <div className={quiet ? "tl-frame is-quiet" : "tl-frame"} dir="rtl">
      {!quiet && <Sidebar />}

      <main className={dots ? `${shell} waf-dots` : shell}>{children}</main>

      {!quiet && <MobileBottomNav />}
    </div>
  );
}
