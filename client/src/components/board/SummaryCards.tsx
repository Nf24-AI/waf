import React from "react";
import { ArrowLeft, CalendarDays, Hourglass, Sun, Target } from "lucide-react";
import { Link } from "wouter";
import { type BoardCounts } from "@shared/board";
import { TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";

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
      value: counts.undecided,
      title: "تحتاج قراراً",
      line: "صنّفها لتعرف أولويتها",
      href: TIME_METHOD_ROUTES.eisenhower,
    },
    {
      tone: "go",
      icon: CalendarDays,
      value: counts.week,
      title: "مهام هذا الأسبوع",
      line: "على المسار الصحيح",
      href: TASKS_ROUTE,
    },
    {
      tone: "accent",
      icon: Sun,
      value: counts.today,
      title: "مهام اليوم",
      line: "لنستمر بالإنجاز",
      href: TASKS_ROUTE,
    },
    {
      tone: "warn",
      icon: Hourglass,
      value: counts.late,
      title: "مهام متأخّرة",
      line: "حان وقت إتمامها",
      href: TIME_METHOD_ROUTES.timeBlocking,
    },
  ] as const;

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
              <ArrowLeft size={16} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
