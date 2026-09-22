import React, { useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { Link } from "wouter";
import { TIME_METHOD_ROUTES } from "@shared/routes";
import { type Task } from "@shared/tasks";
import { trpc } from "@/lib/trpc";

/**
 * تنبيه حين يحلّ وقت مهمة محجوزة.
 *
 * حجز الوقت بلا تنبيه تقويمٌ لا يُفتح: يكتب المستخدم موعده ثم ينساه، فيصير
 * الحجز طقساً لا أداة. والتنبيه شريط في الزاوية لا نافذة تحجب الشاشة — لأن
 * من يعمل الآن قد يكون في شيء أهمّ من الشيء الذي جدوله قبل أسبوع.
 *
 * ولا إذن إشعارات من المتصفّح: يُطلب مرة ويُرفض مرة، ثم لا يبقى شيء. هذا
 * يعمل ما دام التبويب مفتوحاً، وهو حيث يكون المستخدم أصلاً.
 */

const DISMISSED_KEY = "waf:reminded";

/** المتذكَّر يُفتَّح بالموعد لا بالمهمة: إعادة الجدولة تنبّه من جديد. */
function keyOf(task: Task): string {
  return `${task.id}@${task.scheduledStart}`;
}

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // وضع التصفّح الخاص يرمي عند القراءة. التنبيه يظهر مرة أخرى، وهذا أهون
    // من أن تنكسر الصفحة كلها من أجل شريط.
    return [];
  }
}

function remember(key: string) {
  try {
    // آخر خمسين تكفي: القائمة تُقرأ في كل دقيقة ولا داعي أن تنمو بلا حدّ.
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), key].slice(-50)));
  } catch {
    /* لا شيء يُفعل: التنبيه سيظهر ثانيةً وحسب. */
  }
}

/** المهمة التي حلّ وقتها ولم ينتهِ بعد. */
export function dueNow(tasks: Task[], now: number): Task | null {
  const due = tasks
    .filter(task => {
      if (!task.scheduledStart || !task.scheduledEnd || task.completedAt) return false;
      const start = new Date(task.scheduledStart).getTime();
      const end = new Date(task.scheduledEnd).getTime();
      return start <= now && now < end;
    })
    .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
  return due[0] ?? null;
}

export default function ScheduleReminder() {
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, {
    enabled: status.data?.configured === true,
    refetchInterval: 60_000,
  });

  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  // الساعة تتقدّم وحدها: الموعد قد يحلّ بين استجابتين، فلا ننتظر الشبكة ليُعرف.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const task = dueNow(open.data ?? [], now);
  if (!task || dismissed.includes(keyOf(task))) return null;

  function hide(task: Task) {
    const key = keyOf(task);
    remember(key);
    setDismissed(current => [...current, key]);
  }

  return (
    <div className="rem-banner" dir="rtl" role="status">
      <CalendarClock size={18} aria-hidden="true" className="rem-icon" />
      <p className="rem-text">
        حان وقت <strong>{task.title}</strong>.
      </p>
      <div className="rem-actions">
        <Link
          className="tm-btn tm-btn-primary"
          href={`${TIME_METHOD_ROUTES.focus}?task=${task.id}`}
          onClick={() => hide(task)}
        >
          ابدأ التركيز
        </Link>
        <button type="button" className="rem-close" onClick={() => hide(task)} aria-label="إخفاء التنبيه">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
