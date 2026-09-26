import React from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  Home,
  MoreHorizontal,
  LogOut,
  MoreHorizontal as MoreIcon,
  Settings,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuthSession } from "@/contexts/AuthContext";
import {
  ARCHIVE_ROUTE,
  MEETING_ROUTES,
  SETTINGS_ROUTE,
  STATISTICS_ROUTE,
  TASKS_ROUTE,
  TIME_HOME_ROUTE,
  TIME_MANAGEMENT_ROUTE,
} from "@shared/routes";

/**
 * تنقّل منتج إدارة الوقت.
 *
 * مجموعتان: ما يُعمل فيه (الرئيسية، المهام، إدارة الوقت، الاجتماعات) وما
 * يُقرأ (الإحصائيات، الأرشيف). الفاصل بينهما سطرٌ لا عنوان — المرجع لا
 * يسمّي المجموعتين، وتسميتهما كلامٌ لا يحتاجه من يعرف مكانه.
 *
 * والاجتماعات رابط إلى الأداة القائمة لا قسم جديد: تبقى على تخطيطها المعتمَد.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Clock;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: TIME_HOME_ROUTE, label: "الرئيسية", icon: Home },
  { href: TASKS_ROUTE, label: "المهام", icon: ClipboardList },
  { href: TIME_MANAGEMENT_ROUTE, label: "إدارة الوقت", icon: Clock },
  { href: MEETING_ROUTES.prepare, label: "الاجتماعات", icon: CalendarDays },
];

export const RECORD_NAV: NavItem[] = [
  { href: STATISTICS_ROUTE, label: "الإحصائيات", icon: BarChart3 },
  { href: ARCHIVE_ROUTE, label: "الأرشيف", icon: Archive },
];

export const NAV_ITEMS = [...PRIMARY_NAV, ...RECORD_NAV];

/**
 * المطابقة تامّة لا ببادئة.
 *
 * «‎/time-management» بادئةٌ لكل طريق تحته، فالمطابقة بالبادئة تُضيء البند
 * وأنت في المصفوفة — بندان مُضاءان وواحد صحيح.
 */
export function isCurrent(location: string, href: string): boolean {
  return location === href;
}

function NavList({ items, onPick }: { items: NavItem[]; onPick?: () => void }) {
  const [location] = useLocation();

  return (
    <div className="tp-nav">
      {items.map(item => {
        const Icon = item.icon;
        const current = isCurrent(location, item.href);
        return (
          <Link
            key={item.href}
            className={current ? "tp-link is-current" : "tp-link"}
            href={item.href}
            aria-current={current ? "page" : undefined}
            onClick={onPick}
          >
            <Icon size={17} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function NavFoot({ onPick }: { onPick?: () => void }) {
  const [location] = useLocation();
  const { user, signOut } = useAuthSession();
  const current = isCurrent(location, SETTINGS_ROUTE);

  // الحرف الأوّل من الاسم إن وُجد، وإلا من البريد. ولا يُخترع اسم.
  const label = (user?.user_metadata?.name as string | undefined)?.trim() || user?.email || "حسابي";
  const initial = label.slice(0, 1).toLocaleUpperCase("ar");

  return (
    <div className="tp-side-foot">
      <Link
        className={current ? "tp-link is-current" : "tp-link"}
        href={SETTINGS_ROUTE}
        aria-current={current ? "page" : undefined}
        onClick={onPick}
      >
        <Settings size={17} aria-hidden="true" />
        الإعدادات
      </Link>

      {/* الحساب واحد في هذه الأداة، فالبطاقة تعريف لا مبدِّل حسابات. */}
      <Link className="tp-user" href={SETTINGS_ROUTE} onClick={onPick}>
        <span className="tp-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="tp-user-name">{label}</span>
        <MoreHorizontal size={16} aria-hidden="true" className="tp-user-more" />
      </Link>

      <button type="button" className="tp-link" onClick={() => void signOut()}>
        <LogOut size={17} aria-hidden="true" />
        تسجيل الخروج
      </button>
    </div>
  );
}

export function Sidebar() {
  return (
    <nav className="tp-side" aria-label="أقسام واف">
      <Link className="tp-brand" href={TIME_HOME_ROUTE}>
        واف
      </Link>
      <NavList items={PRIMARY_NAV} />
      <NavList items={RECORD_NAV} />
      <NavFoot />
    </nav>
  );
}

/**
 * الشريط السفلي — أربعة أقسام والمزيد.
 *
 * الأقسام سبعة ولا تسعها أربع خانات، والخامسة تفتح الدرج الذي يحمل البقيّة:
 * فلا يُخفى شيء ولا يضيق البند عن الإبهام. وهذا ما يجعل الشريط والدرج
 * خريطةً واحدة لا خريطتين — الدرج تتمّةُ الشريط لا بديلُه.
 */
export function BottomNav({ onMore }: { onMore: () => void }) {
  const [location] = useLocation();

  return (
    <nav className="tp-bottom" aria-label="أقسام واف">
      {PRIMARY_NAV.map(item => {
        const Icon = item.icon;
        const current = isCurrent(location, item.href);
        return (
          <Link
            key={item.href}
            className={current ? "tp-tab is-current" : "tp-tab"}
            href={item.href}
            aria-current={current ? "page" : undefined}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button type="button" className="tp-tab" onClick={onMore}>
        <MoreIcon size={19} aria-hidden="true" />
        <span>المزيد</span>
      </button>
    </nav>
  );
}

/**
 * الدرج — بقيّة الأقسام والحساب.
 *
 * يُغلق بالخلفية وبمفتاح الهروب وبأي بند يُختار، فلا يُحبس أحد فيه.
 */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="tp-scrim" aria-label="إغلاق القائمة" onClick={onClose} />
      <nav className="tp-drawer" aria-label="أقسام واف">
        <div className="tp-drawer-head">
          <Link className="tp-brand" href={TIME_HOME_ROUTE} onClick={onClose}>
            واف
          </Link>
          <button type="button" className="tp-icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <NavList items={PRIMARY_NAV} onPick={onClose} />
        <NavList items={RECORD_NAV} onPick={onClose} />
        <NavFoot onPick={onClose} />
      </nav>
    </>
  );
}
