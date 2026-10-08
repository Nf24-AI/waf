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
import { locale, t } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import LangToggle from "@/components/LangToggle";
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
  labelEn: string;
  icon: typeof Clock;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: TIME_HOME_ROUTE, label: "الرئيسية", labelEn: "Home", icon: Home },
  { href: TASKS_ROUTE, label: "المهام", labelEn: "Tasks", icon: ClipboardList },
  { href: TIME_MANAGEMENT_ROUTE, label: "إدارة الوقت", labelEn: "Time management", icon: Clock },
  { href: MEETING_ROUTES.prepare, label: "الاجتماعات", labelEn: "Meetings", icon: CalendarDays },
];

/**
 * الاجتماعات مساحة واحدة لا بيانات لكل حساب.
 *
 * فمن لا يملكها لا يُعرض له بندها: عرضُ باب لا يُفتح أسوأ من غيابه — يُضغط
 * فيُقرأ عطلاً، ويُترك المنتج بسببه.
 */
export function visibleNav(items: NavItem[], ownsWorkspace: boolean): NavItem[] {
  if (ownsWorkspace) return items;
  return items.filter(item => item.href !== MEETING_ROUTES.prepare);
}

export const RECORD_NAV: NavItem[] = [
  { href: STATISTICS_ROUTE, label: "الإحصائيات", labelEn: "Statistics", icon: BarChart3 },
  { href: ARCHIVE_ROUTE, label: "الأرشيف", labelEn: "Archive", icon: Archive },
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
            {t(item.label, item.labelEn)}
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
  const label = (user?.user_metadata?.name as string | undefined)?.trim() || user?.email || t("حسابي", "My account");
  const initial = label.slice(0, 1).toLocaleUpperCase(locale());

  return (
    <div className="tp-side-foot">
      <Link
        className={current ? "tp-link is-current" : "tp-link"}
        href={SETTINGS_ROUTE}
        aria-current={current ? "page" : undefined}
        onClick={onPick}
      >
        <Settings size={17} aria-hidden="true" />
        {t("الإعدادات", "Settings")}
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
        {t("تسجيل الخروج", "Sign out")}
      </button>

      <LangToggle className="tp-link" />
    </div>
  );
}

export function Sidebar() {
  const access = trpc.meetings.access.useQuery();

  return (
    <nav className="tp-side" aria-label={t("أقسام واف", "Waf sections")}>
      <Link className="tp-brand" href={TIME_HOME_ROUTE}>
        {t("واف", "Waf")}
      </Link>
      <NavList items={visibleNav(PRIMARY_NAV, access.data?.owner === true)} />
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
  const bottomAccess = trpc.meetings.access.useQuery();

  return (
    <nav className="tp-bottom" aria-label={t("أقسام واف", "Waf sections")}>
      {visibleNav(PRIMARY_NAV, bottomAccess.data?.owner === true).map(item => {
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
            <span>{t(item.label, item.labelEn)}</span>
          </Link>
        );
      })}

      <button type="button" className="tp-tab" onClick={onMore}>
        <MoreIcon size={19} aria-hidden="true" />
        <span>{t("المزيد", "More")}</span>
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
  const workspace = trpc.meetings.access.useQuery();

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
      <button type="button" className="tp-scrim" aria-label={t("إغلاق القائمة", "Close menu")} onClick={onClose} />
      <nav className="tp-drawer" aria-label={t("أقسام واف", "Waf sections")}>
        <div className="tp-drawer-head">
          <Link className="tp-brand" href={TIME_HOME_ROUTE} onClick={onClose}>
            {t("واف", "Waf")}
          </Link>
          <button type="button" className="tp-icon-btn" onClick={onClose} aria-label={t("إغلاق", "Close")}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <NavList items={visibleNav(PRIMARY_NAV, workspace.data?.owner === true)} onPick={onClose} />
        <NavList items={RECORD_NAV} onPick={onClose} />
        <NavFoot onPick={onClose} />
      </nav>
    </>
  );
}
