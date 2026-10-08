// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  FolderPlus,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { QUADRANTS, type Quadrant, type RepeatRule } from "@shared/tasks";
import { type Project } from "@shared/projects";
import { dir, pair, pick, t } from "@/lib/i18n";
import { quadrantLabel, quadrantVerbLabel } from "@/lib/task-labels";
import mountains from "@/assets/night-mountains.jpg";

/**
 * إضافة مهمة — نافذة فوق مكانك، لا صفحة تنقلك عنه.
 *
 * العنوان وحده إلزاميّ. وكل ما تحته اختياريّ ويمكن تعديله لاحقاً من الطريقة
 * التي تخصّه — والسطر الذي يقول ذلك في القدم ليس تزييناً: بدونه يظنّ من
 * يملأها أنّه يُقرّر الآن ما لا رجعة فيه، فيتردّد عند كل خانة.
 *
 * و«بدون تصنيف» هي الافتراض: الرُّبع حكمٌ يصدره صاحب المهمة، وإسناده
 * تلقائياً يملأ المصفوفة بأحكام لم يصدرها أحد.
 */

const DESCRIPTION_LIMIT = 500;

/** رمز كل ربع ولونه — نفس ترتيب المصفوفة. */
const QUADRANT_ICON: Record<Quadrant, typeof Target> = {
  important_urgent: AlertTriangle,
  important_not_urgent: CalendarDays,
  not_important_urgent: Users,
  not_important_not_urgent: Trash2,
};

/**
 * أوقات مقترحة بدل منتقي وقت كامل.
 *
 * من يضيف مهمة يريد أن يفرغ رأسه لا أن يفتح تقويماً. والحجز الدقيق مكانه
 * «حجز الوقت»، وهي خطوة قائمة بذاتها.
 */
const WHEN_OPTIONS = [
  { id: "", label: pair("اختر وقتاً", "Choose a time") },
  { id: "today-09", label: pair("اليوم ٩:٠٠", "Today 9:00"), day: 0, hour: 9 },
  { id: "today-14", label: pair("اليوم ٢:٠٠ ظهراً", "Today 2:00 pm"), day: 0, hour: 14 },
  { id: "tomorrow-09", label: pair("غداً ٩:٠٠", "Tomorrow 9:00"), day: 1, hour: 9 },
] as const;

const REMINDER_OPTIONS = [
  { value: "", label: pair("بدون تذكير", "No reminder") },
  { value: "0", label: pair("عند الموعد", "At the scheduled time") },
  { value: "10", label: pair("قبل ١٠ دقائق", "10 minutes before") },
  { value: "60", label: pair("قبل ساعة", "1 hour before") },
] as const;

const DURATION_OPTIONS = [25, 45, 60, 90] as const;

export interface NewTask {
  title: string;
  projectId?: string;
  description?: string;
  quadrant?: Quadrant;
  estimatedMinutes?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  reminderMinutes?: number;
  repeatRule?: RepeatRule;
}

/** يبني الموعد من خيار مقترح ومدّة، أو لا شيء إن لم يُختر وقت. */
export function scheduleFrom(
  option: string,
  minutes: number,
  now: Date = new Date(),
): { start: string; end: string } | null {
  const picked = WHEN_OPTIONS.find(item => item.id === option);
  if (!picked || !("hour" in picked)) return null;

  const start = new Date(now);
  start.setDate(start.getDate() + picked.day);
  start.setHours(picked.hour, 0, 0, 0);
  const end = new Date(start.getTime() + minutes * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function AddTaskModal({
  pending,
  error,
  projects,
  onClose,
  onSubmit,
  onCreateProject,
}: {
  pending: boolean;
  error: string | null;
  projects: Project[];
  onClose: () => void;
  onSubmit: (task: NewTask) => void;
  onCreateProject: (name: string) => Promise<Project | null>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quadrant, setQuadrant] = useState<Quadrant | "">("");
  const [minutes, setMinutes] = useState(60);
  const [when, setWhen] = useState("");
  const [reminder, setReminder] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newProject, setNewProject] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // onClose يصل دالّةً جديدة مع كل رسم للأب، فلو كان التأثير يعتمد عليه
  // لأُعيد التركيز على العنوان كلما تحدّث ما خلف النافذة — فيُنتزع المؤشر
  // من أيّ خانة يكتب فيها المستخدم. التركيز مرّة عند الفتح، والإغلاق يُقرأ
  // من مرجع يبقى على آخر نسخة.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = window.setTimeout(() => titleRef.current?.focus(), 40);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;

    const slot = scheduleFrom(when, minutes);
    onSubmit({
      title: clean,
      description: description.trim() || undefined,
      quadrant: quadrant || undefined,
      estimatedMinutes: minutes,
      scheduledStart: slot?.start,
      scheduledEnd: slot?.end,
      projectId: projectId || undefined,
      // التذكير بلا موعد لا معنى له: لا شيء يُنبَّه عنده.
      reminderMinutes: slot && reminder !== "" ? Number(reminder) : undefined,
    });
  }

  return (
    <div
      className="ntk-scrim"
      data-waf-theme="navy"
      role="presentation"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="ntk" role="dialog" aria-modal="true" aria-labelledby="ntk-title" dir={dir()}>
        <header className="ntk-head">
          <img src={mountains} alt="" aria-hidden="true" />
          <button type="button" className="ntk-close" onClick={onClose} aria-label={t("إغلاق", "Close")}>
            <X size={18} aria-hidden="true" />
          </button>

          <div className="ntk-head-text">
            <h2 id="ntk-title">{t("إضافة مهمة", "Add a task")}</h2>
            <p>{t("خطوة صغيرة اليوم تصنع فرقاً أكبر غداً.", "A small step today makes a bigger difference tomorrow.")}</p>
          </div>

          <p className="ntk-head-aside">
            <b>{t("الأفكار العظيمة", "Great ideas")}</b>
            {t("تبدأ من مهمة واحدة.", "start with a single task.")}
          </p>
        </header>

        <form className="ntk-body" onSubmit={submit}>
          <label className="ntk-field">
            <span className="ntk-label">
              {t("ماذا تريد إنجازه؟", "What do you want to get done?")} <i aria-hidden="true">*</i>
            </span>
            <span className="ntk-input">
              <Target size={17} aria-hidden="true" />
              <input
                ref={titleRef}
                type="text"
                value={title}
                required
                maxLength={200}
                placeholder={t("مثال: إعداد العرض التقديمي", "Example: Prepare the presentation")}
                onChange={e => setTitle(e.target.value)}
              />
            </span>
          </label>

          <label className="ntk-field">
            <span className="ntk-label">{t("الوصف (اختياري)", "Description (optional)")}</span>
            <span className="ntk-input ntk-input-area">
              <FileText size={17} aria-hidden="true" />
              <textarea
                rows={3}
                value={description}
                maxLength={DESCRIPTION_LIMIT}
                placeholder={t("أضف تفاصيل تساعدك عند العودة للمهمة …", "Add details that will help when you come back to this task …")}
                onChange={e => setDescription(e.target.value)}
              />
              <i className="ntk-count" aria-hidden="true">
                {description.length}/{DESCRIPTION_LIMIT}
              </i>
            </span>
          </label>

          <fieldset className="ntk-field ntk-quads">
            <legend className="ntk-label">{t("التصنيف (اختياري)", "Classification (optional)")}</legend>

            <div className="ntk-grid">
              {QUADRANTS.map(item => {
                const Icon = QUADRANT_ICON[item.id];
                const picked = quadrant === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={picked ? "ntk-quad is-picked" : "ntk-quad"}
                    data-q={item.id}
                    aria-pressed={picked}
                    // ضغطة ثانية تلغي الاختيار: «بدون تصنيف» يجب أن يبقى ممكناً
                    // بعد أن يُجرَّب أحدها، وإلا صار أوّل ضغط قراراً لا رجعة فيه.
                    onClick={() => setQuadrant(picked ? "" : item.id)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span className="ntk-quad-text">
                      <b>{quadrantLabel(item.id)}</b>
                      <i>{quadrantVerbLabel(item.id)}</i>
                    </span>
                    <span className="ntk-radio" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/*
            المشروع اختياري، وإنشاؤه من هنا لا من صفحة أخرى: من يكتب مهمةً
            لمشروع جديد يريد المشروع الآن، ونقلُه إلى مكان آخر يقطع ما يفعله.
          */}
          <div className="ntk-field">
            <span className="ntk-label">{t("المشروع (اختياري)", "Project (optional)")}</span>
            {addingProject ? (
              <span className="ntk-input">
                <FolderPlus size={17} aria-hidden="true" />
                <input
                  type="text"
                  value={newProject}
                  maxLength={80}
                  autoFocus
                  placeholder={t("اسم المشروع الجديد", "New project name")}
                  onChange={e => setNewProject(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key !== "Enter") return;
                    // داخل نموذج: الضغط هنا لا يُرسل المهمة قبل أوانها.
                    e.preventDefault();
                    const name = newProject.trim();
                    if (!name) return;
                    const made = await onCreateProject(name);
                    if (made) setProjectId(made.id);
                    setNewProject("");
                    setAddingProject(false);
                  }}
                />
              </span>
            ) : (
              <select
                value={projectId}
                onChange={e => {
                  if (e.target.value === "__new") {
                    setAddingProject(true);
                    return;
                  }
                  setProjectId(e.target.value);
                }}
              >
                <option value="">{t("بدون مشروع", "No project")}</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
                <option value="__new">{t("+ مشروع جديد…", "+ New project…")}</option>
              </select>
            )}
          </div>

          <div className="ntk-row">
            <label className="ntk-field">
              <span className="ntk-label">
                <Clock size={14} aria-hidden="true" />
                {t("المدة (اختياري)", "Duration (optional)")}
              </span>
              <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
                {DURATION_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {t(`${option} دقيقة`, `${option} min`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="ntk-field">
              <span className="ntk-label">
                <CalendarDays size={14} aria-hidden="true" />
                {t("الوقت (اختياري)", "Time (optional)")}
              </span>
              <select value={when} onChange={e => setWhen(e.target.value)}>
                {WHEN_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {pick(option.label)}
                  </option>
                ))}
              </select>
            </label>

            <label className="ntk-field">
              <span className="ntk-label">
                <Bell size={14} aria-hidden="true" />
                {t("التذكير (اختياري)", "Reminder (optional)")}
              </span>
              {/* بلا وقت لا تذكير: الخانة تُعطَّل بدل أن تَعِد بما لا يقع. */}
              <select value={reminder} disabled={!when} onChange={e => setReminder(e.target.value)}>
                {REMINDER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {pick(option.label)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p className="au-error" role="alert">
              {error}
            </p>
          )}

          <footer className="ntk-foot">
            <div className="ntk-acts">
              <button type="submit" className="tp-btn tp-btn-primary" disabled={pending || !title.trim()}>
                {pending ? <Loader2 size={16} className="tm-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                {t("إضافة المهمة", "Add task")}
              </button>
              <button type="button" className="tp-btn" onClick={onClose}>
                {t("إلغاء", "Cancel")}
              </button>
            </div>

            <p className="ntk-hint">
              <Sparkles size={15} aria-hidden="true" />
              {t("يمكنك تعديل كل هذه الخيارات لاحقاً.", "You can change all of these options later.")}
            </p>
          </footer>
        </form>
      </div>
    </div>
  );
}
