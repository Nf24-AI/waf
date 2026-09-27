import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "wouter";
import { whenLabel } from "@shared/board";
import { nextActionOf, quadrantTitle, type Task } from "@shared/tasks";
import { TASKS_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";

/**
 * قائمة المهام القادمة.
 *
 * كل صفّ يقول حالته ويقود إلى خطوته التالية — لا قائمة خيارات تُقرأ قبل أن
 * تُفعل. ونقطة اللون تُرى قبل أن يُقرأ الاسم، فتُمسح القائمة بالعين لا سطراً
 * سطراً.
 */

function toneOf(task: Task): "danger" | "go" | "warn" | "mute" {
  if (task.quadrant === "important_urgent") return "danger";
  if (task.quadrant === "important_not_urgent") return "go";
  if (task.quadrant === "not_important_urgent") return "warn";
  return "mute";
}

function hrefOf(task: Task): string {
  const { method } = nextActionOf(task);
  const route =
    method === "eisenhower"
      ? TIME_METHOD_ROUTES.eisenhower
      : method === "time-blocking"
        ? TIME_METHOD_ROUTES.timeBlocking
        : TIME_METHOD_ROUTES.focus;
  return `${route}?task=${task.id}`;
}

export function TaskItem({
  task,
  now,
  onComplete,
  busy,
}: {
  task: Task;
  now: Date;
  onComplete: (id: string) => void;
  busy: boolean;
}) {
  const action = nextActionOf(task);

  return (
    <li className="bd-row">
      <button
        type="button"
        className="bd-check"
        onClick={() => onComplete(task.id)}
        disabled={busy}
        aria-label={`إنجاز ${task.title}`}
      >
        <Check size={13} aria-hidden="true" />
      </button>

      <span className="bd-dot" data-tone={toneOf(task)} aria-hidden="true" />

      <span className="bd-row-body">
        <span className="bd-row-title">{task.title}</span>
        <span className="bd-row-meta">{task.quadrant ? quadrantTitle(task.quadrant) : "بدون تصنيف"}</span>
      </span>

      <time className="bd-row-when">{whenLabel(task, now)}</time>

      <Link className="bd-row-go" href={hrefOf(task)} aria-label={`${action.label}: ${task.title}`}>
        {action.label}
        <ArrowLeft size={14} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function TaskList({
  tasks,
  now,
  onComplete,
  busy,
  emptyHint,
}: {
  tasks: Task[];
  now: Date;
  onComplete: (id: string) => void;
  busy: boolean;
  emptyHint: string;
}) {
  return (
    <section className="bd-panel" aria-labelledby="bd-tasks-title">
      <header className="bd-panel-head">
        <h2 id="bd-tasks-title">المهام القادمة</h2>
        <Link className="bd-panel-more" href={TASKS_ROUTE}>
          عرض الكل
        </Link>
      </header>

      {tasks.length === 0 ? (
        <p className="bd-empty">{emptyHint}</p>
      ) : (
        <ul className="bd-rows">
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} now={now} onComplete={onComplete} busy={busy} />
          ))}
        </ul>
      )}
    </section>
  );
}
