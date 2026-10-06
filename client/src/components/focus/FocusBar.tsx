import React from "react";
import { Archive, BarChart3, CalendarDays, ClipboardList, Clock, Home, Settings, Timer } from "lucide-react";
import { Link } from "wouter";
import { useAuthSession } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import {
  ARCHIVE_ROUTE,
  MEETING_ROUTES,
  PLATFORM_ROUTE,
  SETTINGS_ROUTE,
  STATISTICS_ROUTE,
  TASKS_ROUTE,
  TIME_HOME_ROUTE,
  TIME_MANAGEMENT_ROUTE,
} from "@shared/routes";

/**
 * شريط صفحة التركيز — علويّ لا جانبيّ، وبالإنجليزية كصفحته.
 *
 * الوجهات هي وجهات واف نفسها (الرئيسية، المهام، إدارة الوقت…): الشريط يغيّر
 * شكل التنقّل هنا لا خريطته. ومؤقّتٌ يعمل يظهر فيه أخضرَ، فيُرى وأنت تقرأ
 * غيره.
 */

const LINKS = [
  { href: TIME_HOME_ROUTE, label: "Home", icon: Home },
  { href: TASKS_ROUTE, label: "Tasks", icon: ClipboardList },
  { href: TIME_MANAGEMENT_ROUTE, label: "Time Management", icon: Clock },
  { href: MEETING_ROUTES.prepare, label: "Meetings", icon: CalendarDays },
  { href: STATISTICS_ROUTE, label: "Statistics", icon: BarChart3 },
  { href: ARCHIVE_ROUTE, label: "Archive", icon: Archive },
  { href: SETTINGS_ROUTE, label: "Settings", icon: Settings },
];

export default function FocusBar({ liveTime }: { liveTime: string | null }) {
  const { user, signOut } = useAuthSession();
  // الاجتماعات مساحة واحدة: من لا يملكها لا يُعرض له بابها.
  const workspace = trpc.meetings.access.useQuery();
  const links = LINKS.filter(link => link.href !== MEETING_ROUTES.prepare || workspace.data?.owner === true);
  const name = (user?.user_metadata?.name as string | undefined)?.trim() || user?.email || "Account";

  return (
    <header className="ft-nav">
      <div className="ft-nav-in">
        <Link className="ft-brand" href={PLATFORM_ROUTE} lang="ar">
          واف
        </Link>

        <nav aria-label="Main">
          <span className="ft-nav-timer" data-live={liveTime !== null}>
            <Timer size={14} aria-hidden="true" />
            {liveTime ?? "00:00"}
            <i aria-hidden="true" />
          </span>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} className="ft-nav-link" href={href}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ft-nav-end">
          <Link className="ft-nav-user" href={SETTINGS_ROUTE} dir="auto">
            {name}
          </Link>
          <button type="button" className="ft-nav-cta" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
