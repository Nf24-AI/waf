// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { ArrowLeft, CalendarClock, LayoutGrid, ListChecks, Plus, Timer } from "lucide-react";
import { Link } from "wouter";
import { nextActionOf, quadrantTitle, type Task } from "@shared/tasks";
import {
  TASKS_ROUTE,
  TIME_MANAGEMENT_ROUTE,
  TIME_METHOD_ROUTES,
} from "@shared/routes";
import { trpc } from "@/lib/trpc";

/**
 * بوّابة إدارة الوقت.
 *
 * المهمة هي الأصل، والطرق الثلاث أدوات للتعامل معها — فلا تُفتح إحداها
 * مباشرة ولا يُساق المستخدم فيها بالترتيب. تبدأ الصفحة بما يستطيع فعله
 * (إضافة، متابعة)، ثم الطرق، ثم مهامه المفتوحة فعلاً.
 *
 * ولا تبدأ فارغة: من يدخل ولديه مهام يراها، ومن لا مهام له يرى دعوة واحدة
 * واضحة لا إطاراً خاوياً.
 */

const METHODS = [
  {
    id: "eisenhower",
    href: TIME_METHOD_ROUTES.eisenhower,
    icon: LayoutGrid,
    title: "مصفوفة أيزنهاور",
    line: "قرّر ما يستحق وقتك.",
  },
  {
    id: "time-blocking",
    href: TIME_METHOD_ROUTES.timeBlocking,
    icon: CalendarClock,
    title: "حجز الوقت",
    line: "ضع لكل مهمة وقتاً واضحاً.",
  },
  {
    id: "focus",
    href: TIME_METHOD_ROUTES.focus,
    icon: Timer,
    title: "جلسة التركيز",
    line: "ركّز على ما بين يديك.",
  },
] as const;

function scheduleLabel(task: Task) {
  if (!task.scheduledStart) return null;
  const start = new Date(task.scheduledStart);
  const today = new Date();
  const sameDay = start.toDateString() === today.toDateString();
  const time = start.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = sameDay ? "اليوم" : start.toLocaleDateString("ar-SA", { weekday: "long" });
  return `${day} ${time}`;
}

function TaskCard({ task }: { task: Task }) {
  const action = nextActionOf(task);
  const when = scheduleLabel(task);

  return (
    <article className="tm-task">
      <div className="tm-task-body">
        <h3>{task.title}</h3>
        <p className="tm-task-meta">
          <span>{task.quadrant ? quadrantTitle(task.quadrant) : "غير مصنّفة"}</span>
          <i aria-hidden="true">·</i>
          <span>{when ?? "غير مجدولة"}</span>
        </p>
      </div>
      <Link className="tm-task-action" href={`${TIME_METHOD_ROUTES[methodRoute(action.method)]}?task=${task.id}`}>
        {action.label}
        <ArrowLeft size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}

function methodRoute(method: ReturnType<typeof nextActionOf>["method"]) {
  if (method === "eisenhower") return "eisenhower" as const;
  if (method === "time-blocking") return "timeBlocking" as const;
  return "focus" as const;
}

export default function TimeManagement() {
  const status = trpc.tasks.status.useQuery();
  const open = trpc.tasks.listOpen.useQuery(undefined, { enabled: status.data?.configured === true });

  const tasks = open.data ?? [];

  return (
    <main className="tm-shell waf-dots" dir="rtl">
      <div className="tm-inner">
        <header className="tm-head">
          <h1>إدارة الوقت</h1>
          <p>نفس مهامك، بثلاث طرق مختلفة.</p>
        </header>

        <div className="tm-primary">
          <Link className="tm-btn tm-btn-primary" href={`${TIME_MANAGEMENT_ROUTE}?add=1`}>
            <Plus size={17} aria-hidden="true" />
            إضافة مهمة
          </Link>
          <Link className="tm-btn tm-btn-ghost" href={TASKS_ROUTE}>
            <ListChecks size={17} aria-hidden="true" />
            متابعة المهام
          </Link>
        </div>

        <section className="tm-section" aria-labelledby="tm-methods">
          <h2 id="tm-methods">اختر طريقتك</h2>
          {/* لا ترقيم ولا أسهم بينها: ثلاث أدوات لا ثلاث خطوات. */}
          <div className="tm-methods">
            {METHODS.map(method => {
              const Icon = method.icon;
              return (
                <Link key={method.id} className="tm-method" href={method.href}>
                  <span className="tm-method-icon" aria-hidden="true">
                    <Icon size={19} />
                  </span>
                  <span className="tm-method-title">{method.title}</span>
                  <span className="tm-method-line">{method.line}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="tm-section" aria-labelledby="tm-open">
          <h2 id="tm-open">مهامك المفتوحة</h2>

          {status.data?.configured === false && (
            <p className="tm-empty">
              المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> و
              <code>TASKS_OWNER_CODE</code> ثم أعد النشر.
            </p>
          )}

          {open.isLoading && <p className="tm-empty">…جارٍ التحميل</p>}

          {open.isError && (
            <p className="tm-empty tm-error" role="alert">
              تعذّر قراءة المهام. {open.error.message}
            </p>
          )}

          {open.isSuccess && tasks.length === 0 && (
            <div className="tm-empty-state">
              <p>لا توجد مهام بعد.</p>
              <p className="tm-empty-hint">ابدأ بمهمة واحدة.</p>
              <Link className="tm-btn tm-btn-primary" href={`${TIME_MANAGEMENT_ROUTE}?add=1`}>
                <Plus size={17} aria-hidden="true" />
                إضافة مهمة
              </Link>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="tm-tasks">
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
