// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { QUADRANTS, type Quadrant } from "@shared/tasks";
import { TASKS_ROUTE } from "@shared/routes";
import FlowSteps from "@/components/time/FlowSteps";
import TimeLayout from "@/components/time/TimeLayout";
import { flowHref, nextStep } from "@/lib/flow";
import { trpc } from "@/lib/trpc";

/**
 * إضافة مهمة — شاشة لا نافذة.
 *
 * كانت نافذةً تُفتح فوق الصفحة، والمرجع يجعلها محطّةً أولى في الطريق. والفرق
 * ليس شكلياً: النافذة تُغلق فيعود المستخدم من حيث أتى، والشاشة تُكمل به إلى
 * التصنيف ثم الحجز. الطريق نفسه اختياري — من كتب عنواناً وضغط «حفظ فقط»
 * انتهى، ومهمّته سليمة بلا تصنيف ولا وقت.
 *
 * وحقل واحد إلزامي: العنوان. ما عداه يُملأ لاحقاً من الطريقة التي تخصّه.
 */
export default function AddTask() {
  const [, navigate] = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quadrant, setQuadrant] = useState<Quadrant | "">("");
  const titleRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const status = trpc.tasks.status.useQuery();

  useEffect(() => {
    const id = window.setTimeout(() => titleRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, []);

  const create = trpc.tasks.create.useMutation({
    onSuccess: async task => {
      await utils.tasks.listOpen.invalidate();
      // بلا تصنيف: المحطّة التالية هي المصفوفة. وبتصنيف: نتجاوزها إلى الحجز.
      const step = quadrant ? nextStep("classify") : nextStep("add");
      navigate(step ? flowHref(step.route, task.id) : TASKS_ROUTE);
    },
  });

  const configured = status.data?.configured === true;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      quadrant: quadrant || undefined,
    });
  }

  return (
    <TimeLayout>
      <FlowSteps current="add" />

      <header className="tp-head">
        <h1>إضافة مهمة</h1>
        <p>لنبدأ بخطوة بسيطة.</p>
      </header>

      {status.data?.configured === false && (
        <p className="tp-empty" style={{ marginBlockEnd: "var(--space-7)" }}>
          المهام غير موصولة بعد. اضبط <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> و
          <code>TASKS_OWNER_CODE</code> ثم أعد النشر.
        </p>
      )}

      <form className="tp-card" onSubmit={submit}>
        <label className="tm-field">
          <span>عنوان المهمة</span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            maxLength={200}
            required
            placeholder="مثال: إعداد العرض التقديمي"
            onChange={event => setTitle(event.target.value)}
          />
        </label>

        <label className="tm-field" style={{ marginBlockStart: "var(--space-7)" }}>
          <span>الوصف (اختياري)</span>
          <textarea
            rows={3}
            value={description}
            maxLength={2000}
            placeholder="أضف تفاصيل المهمة …"
            onChange={event => setDescription(event.target.value)}
          />
        </label>

        <label className="tm-field" style={{ marginBlockStart: "var(--space-7)" }}>
          <span>التصنيف المبدئي</span>
          {/*
            «بدون تصنيف» هي الافتراض وليست خياراً ناقصاً: الربع حكمٌ يصدره
            صاحب المهمة، وإسناده تلقائياً يملأ المصفوفة بأحكام لم يصدرها أحد.
          */}
          <select value={quadrant} onChange={event => setQuadrant(event.target.value as Quadrant | "")}>
            <option value="">بدون تصنيف</option>
            {QUADRANTS.map(item => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        {create.error && (
          <p className="tm-form-error" role="alert" style={{ marginBlockStart: "var(--space-6)" }}>
            {create.error.message}
          </p>
        )}

        <div className="tp-actions">
          <button
            type="submit"
            className="tp-btn tp-btn-primary tp-btn-wide"
            disabled={create.isPending || !configured || !title.trim()}
          >
            {create.isPending ? <Loader2 size={16} className="tm-spin" aria-hidden="true" /> : null}
            التالي
            <ArrowLeft size={15} aria-hidden="true" />
          </button>
        </div>
      </form>
    </TimeLayout>
  );
}
