// مستورَد صراحةً كما في بقية الملفات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { QUADRANTS, type Quadrant } from "@shared/tasks";

/**
 * إضافة مهمة — يجب أن تكون سريعة جداً.
 *
 * حقل واحد إلزامي: العنوان. وكل ما عداه اختياري ويمكن تركه ليُملأ لاحقاً من
 * الطريقة المناسبة له — فمن أراد أن يكتب ويمضي يكتب ويمضي، ومن أراد أن
 * يصنّف ويقدّر من هنا فعل.
 */
export default function AddTaskDialog({
  open,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { title: string; description?: string; quadrant?: Quadrant; estimatedMinutes?: number }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quadrant, setQuadrant] = useState<Quadrant | "">("");
  const [minutes, setMinutes] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // الحقول تُفرَّغ عند كل فتح: نافذة تحتفظ بمسودّة قديمة تُربك أكثر ممّا تُعين.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setQuadrant("");
    setMinutes("");
    const id = window.setTimeout(() => titleRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = title.trim();

  return (
    <div className="tm-scrim" role="presentation" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="tm-dialog" role="dialog" aria-modal="true" aria-labelledby="add-task-title" dir="rtl">
        <header className="tm-dialog-head">
          <h2 id="add-task-title">إضافة مهمة</h2>
          <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <form
          className="tm-form"
          onSubmit={event => {
            event.preventDefault();
            if (!trimmed) return;
            onSubmit({
              title: trimmed,
              description: description.trim() || undefined,
              quadrant: quadrant || undefined,
              estimatedMinutes: minutes ? Number(minutes) : undefined,
            });
          }}
        >
          <label className="tm-field">
            <span>عنوان المهمة</span>
            <input
              ref={titleRef}
              id="task-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="مثال: إعداد العرض التقديمي"
              required
              maxLength={200}
            />
          </label>

          <label className="tm-field">
            <span>الوصف — اختياري</span>
            <textarea
              id="task-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              rows={3}
              placeholder="تفاصيل تنفعك حين تعود إليها"
            />
          </label>

          <div className="tm-field-row">
            <label className="tm-field">
              <span>التصنيف — اختياري</span>
              <select id="task-quadrant" value={quadrant} onChange={event => setQuadrant(event.target.value as Quadrant)}>
                <option value="">بدون تصنيف</option>
                {QUADRANTS.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="tm-field">
              <span>مدة متوقّعة — دقائق</span>
              <input
                id="task-minutes"
                type="number"
                min={1}
                max={600}
                value={minutes}
                onChange={event => setMinutes(event.target.value)}
                placeholder="٢٥"
              />
            </label>
          </div>

          {error && (
            <p className="tm-form-error" role="alert">
              {error}
            </p>
          )}

          <div className="tm-form-actions">
            <button type="submit" className="tm-btn tm-btn-primary" disabled={!trimmed || pending}>
              {pending && <Loader2 size={15} className="tm-spin" aria-hidden="true" />}
              إضافة المهمة
            </button>
            <button type="button" className="tm-btn tm-btn-ghost" onClick={onClose} disabled={pending}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
