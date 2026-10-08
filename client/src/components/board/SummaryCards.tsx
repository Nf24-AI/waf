import React from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Hourglass, Sun, Target } from "lucide-react";
import { Link } from "wouter";
import { type BoardCounts } from "@shared/board";
import { TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";
import { dir, t } from "@/lib/i18n";

/**
 * البطاقات الأربع — أرقامها محسوبة من المهام، لا مكتوبة.
 *
 * المرجع يسمّي الأولى «أهداف قيد التنفيذ»، ولا أهداف في هذا المنتج. ورقمٌ
 * لكيانٍ غير موجود كذبٌ مرتّب، فصارت «تحتاج قراراً»: ما لم يُصنَّف ولم
 * يُجدوَل — وهو السؤال الذي تجيب عنه المصفوفة فعلاً.
 *
 * وكل بطاقة تقود إلى حيث يُعالَج رقمها، لا إلى نفس المكان أربع مرّات.
 */
export default function SummaryCards({ counts }: { counts: BoardCounts }) {
  const cards = [
    {
      tone: "purple",
      icon: Target,
      value: counts.needsTime,
      title: t("بلا وقت", "Unscheduled"),
      line: t("احجز لها وقتاً", "Block time for them"),
      href: TIME_METHOD_ROUTES.timeBlocking,
    },
    {
      tone: "go",
      icon: CalendarDays,
      value: counts.week,
      title: t("مهام هذا الأسبوع", "This week's tasks"),
      line: t("على المسار الصحيح", "On track"),
      href: TASKS_ROUTE,
    },
    {
      tone: "accent",
      icon: Sun,
      value: counts.today,
      title: t("مهام اليوم", "Today's tasks"),
      line: t("لنستمر بالإنجاز", "Keep the momentum going"),
      href: TASKS_ROUTE,
    },
    {
      tone: "warn",
      icon: Hourglass,
      value: counts.late,
      title: t("مهام متأخّرة", "Overdue tasks"),
      line: t("حان وقت إتمامها", "Time to finish them"),
      href: TASKS_ROUTE,
    },
  ] as const;
  const Go = dir() === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="bd-cards">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <Link className="bd-card" data-tone={card.tone} href={card.href} key={card.title}>
            <span className="bd-card-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="bd-card-value">{card.value}</span>
            <span className="bd-card-title">{card.title}</span>
            <span className="bd-card-line">{card.line}</span>
            <span className="bd-card-go" aria-hidden="true">
              <Go size={16} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
