// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Link } from "wouter";
import { nextActionOf, type Task } from "@shared/tasks";
import { TIME_METHOD_ROUTES } from "@shared/routes";
import { dir, getLang, locale, t } from "@/lib/i18n";
import { quadrantLabel } from "@/lib/task-labels";

/**
 * صفّ مهمة واحد — يُستعمل في بوّابة إدارة الوقت وفي صفحة المتابعة.
 *
 * يعرض ما يلزم لاتخاذ قرار: الاسم، وأين هي من التصنيف والجدولة، وزرّاً
 * واحداً يقود إلى ما تحتاجه الآن — لا إلى قائمة خيارات تُقرأ قبل أن تُفعل.
 */

function methodHref(task: Task) {
  const { method } = nextActionOf(task);
  const route =
    method === "eisenhower"
      ? TIME_METHOD_ROUTES.eisenhower
      : method === "time-blocking"
        ? TIME_METHOD_ROUTES.timeBlocking
        : TIME_METHOD_ROUTES.focus;
  return `${route}?task=${task.id}`;
}

/**
 * نقطة اللون: الربع يُقرأ قبل الاسم.
 *
 * الشارة النصّية تُقرأ، والنقطة تُرى. في قائمة من عشرين صفّاً الفرق بينهما
 * هو الفرق بين المسح بالعين والقراءة سطراً سطراً.
 */
export function quadrantTone(task: Task): "danger" | "go" | "warn" | "mute" {
  if (task.quadrant === "important_urgent") return "danger";
  if (task.quadrant === "important_not_urgent") return "go";
  if (task.quadrant === "not_important_urgent") return "warn";
  return "mute";
}

export function scheduleLabel(task: Task): string | null {
  if (!task.scheduledStart) return null;
  const start = new Date(task.scheduledStart);
  const sameDay = start.toDateString() === new Date().toDateString();
  const time = start.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = sameDay ? t("اليوم", "Today") : start.toLocaleDateString(locale(), { weekday: "long" });
  return `${day} ${time}`;
}

export default function TaskRow({
  task,
  onComplete,
  completing,
}: {
  task: Task;
  onComplete?: (id: string) => void;
  completing?: boolean;
}) {
  const action = nextActionOf(task, getLang());
  const Arrow = dir() === "rtl" ? ArrowLeft : ArrowRight;
  const when = scheduleLabel(task);

  return (
    <article className="tm-task">
      {onComplete && (
        <button
          type="button"
          className="tm-check"
          onClick={() => onComplete(task.id)}
          disabled={completing}
          aria-label={t(`إنجاز ${task.title}`, `Complete ${task.title}`)}
        >
          <Check size={14} aria-hidden="true" />
        </button>
      )}

      <span className="tp-dot" data-tone={quadrantTone(task)} aria-hidden="true" />

      <div className="tm-task-body">
        <h3>{task.title}</h3>
        <p className="tm-task-meta">
          <span>{task.quadrant ? quadrantLabel(task.quadrant) : t("غير مصنّفة", "Unclassified")}</span>
          <i aria-hidden="true">·</i>
          <span>{when ?? t("غير مجدولة", "Unscheduled")}</span>
        </p>
      </div>

      <Link className="tm-task-action" href={methodHref(task)}>
        {action.label}
        <Arrow size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}
