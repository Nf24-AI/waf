import React from "react";
import {
  Archive,
  ArrowRight,
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Timer,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  ARCHIVE_ROUTE,
  PLATFORM_ROUTE,
  STATISTICS_ROUTE,
  TASKS_ROUTE,
  TIME_MANAGEMENT_ROUTE,
  TIME_METHOD_ROUTES,
} from "@shared/routes";

/**
 * تنقّل إدارة الوقت — داخل إدارة الوقت وحدها.
 *
 * بقية المنصّة (الاجتماعات، القرارات، التقرير) تبقى كما هي: شريط جانبي عام
 * كان سيغيّر تخطيط صفحات مُعتمَدة من أجل قسم واحد.
 *
 * الطرق الثلاث في مجموعة واحدة بلا ترقيم: أدوات لا خطوات، ومن يراها مرقّمة
 * يظنّ أن عليه المرور بها بالترتيب. والسجلّ (الإحصاء، الأرشيف) في مجموعة
 * أخرى لأنه يُقرأ ولا يُعمل فيه.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Timer;
  /** يظهر في شريط الجوّال السفلي — خمسة على الأكثر، فالسادس يصير غير قابل للّمس. */
  onPhone?: boolean;
}

export const NAV_GROUPS: { id: string; label?: string; items: NavItem[] }[] = [
  {
    id: "work",
    items: [
      { href: TIME_MANAGEMENT_ROUTE, label: "إدارة الوقت", icon: LayoutDashboard, onPhone: true },
      { href: TASKS_ROUTE, label: "مهامي", icon: ListChecks, onPhone: true },
    ],
  },
  {
    id: "methods",
    label: "الطرق",
    items: [
      { href: TIME_METHOD_ROUTES.eisenhower, label: "المصفوفة", icon: LayoutGrid, onPhone: true },
      { href: TIME_METHOD_ROUTES.timeBlocking, label: "حجز الوقت", icon: CalendarClock, onPhone: true },
      { href: TIME_METHOD_ROUTES.focus, label: "التركيز", icon: Timer, onPhone: true },
    ],
  },
  {
    id: "record",
    label: "السجلّ",
    items: [
      { href: STATISTICS_ROUTE, label: "الإحصاء", icon: BarChart3 },
      { href: ARCHIVE_ROUTE, label: "الأرشيف", icon: Archive },
    ],
  },
];

export const PHONE_ITEMS = NAV_GROUPS.flatMap(group => group.items).filter(item => item.onPhone);

/**
 * المطابقة تامّة لا ببادئة.
 *
 * «‎/time-management» بادئةٌ لكل طريق تحته، فالمطابقة بالبادئة تُضيء البوّابة
 * وأنت في المصفوفة — بندان مُضاءان وواحد صحيح.
 */
export function isCurrent(location: string, href: string): boolean {
  return location === href;
}

export function Sidebar() {
  const [location] = useLocation();

  return (
    <nav className="tn-side" aria-label="أقسام إدارة الوقت">
      {NAV_GROUPS.map(group => (
        <div className="tn-group" key={group.id}>
          {group.label && <p className="tn-group-label">{group.label}</p>}
          <ul className="tn-list">
            {group.items.map(item => {
              const Icon = item.icon;
              const current = isCurrent(location, item.href);
              return (
                <li key={item.href}>
                  <Link
                    className={current ? "tn-link is-current" : "tn-link"}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* المخرج: بدونه تصير إدارة الوقت غرفةً لا باب لها. */}
      <Link className="tn-out" href={PLATFORM_ROUTE}>
        <ArrowRight size={15} aria-hidden="true" />
        المنصّة
      </Link>
    </nav>
  );
}

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="tn-bottom" aria-label="أقسام إدارة الوقت">
      {PHONE_ITEMS.map(item => {
        const Icon = item.icon;
        const current = isCurrent(location, item.href);
        return (
          <Link
            key={item.href}
            className={current ? "tn-tab is-current" : "tn-tab"}
            href={item.href}
            aria-current={current ? "page" : undefined}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
