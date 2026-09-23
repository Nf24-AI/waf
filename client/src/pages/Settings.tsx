// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React, { useState } from "react";
import { Check } from "lucide-react";
import {
  readFocusMinutes,
  readName,
  writeFocusMinutes,
  writeName,
} from "@/lib/preferences";
import TimeLayout from "@/components/time/TimeLayout";
import { trpc } from "@/lib/trpc";

/**
 * الإعدادات — ما يملكه المستخدم فعلاً.
 *
 * صفحة إعدادات تعرض مفاتيح لا تفعل شيئاً أسوأ من غيابها. فهنا شيئان يُغيَّران
 * ويُرى أثرهما في الحال، وسطرٌ يقول أين تسكن البيانات. أمّا ما يُضبط
 * بمتغيّرات البيئة فيُعرض ولا يُحرَّر: تغييره من المتصفّح يعني كتابة أسرار
 * في حزمةٍ عامة.
 */

export default function Settings() {
  const [name, setName] = useState(() => readName());
  const [minutes, setMinutes] = useState(() => readFocusMinutes());
  const [saved, setSaved] = useState(false);

  const status = trpc.tasks.status.useQuery();

  function save(event: React.FormEvent) {
    event.preventDefault();
    writeName(name);
    writeFocusMinutes(minutes);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  return (
    <TimeLayout>
      <header className="tm-head">
        <h1>الإعدادات</h1>
        <p>ما يخصّك في هذا الجهاز.</p>
      </header>

      <form className="tp-card" style={{ marginBlockStart: "var(--space-8)" }} onSubmit={save}>
        <div className="tm-field">
          <span>اسمك</span>
          <input
            type="text"
            value={name}
            maxLength={40}
            placeholder="يظهر في تحيّة الصفحة الرئيسية"
            onChange={event => setName(event.target.value)}
          />
        </div>

        <div className="tm-field" style={{ marginBlockStart: "var(--space-7)" }}>
          <span>المدّة الافتراضية لجلسة التركيز</span>
          <div className="tb-durations">
            {[25, 50, 90].map(option => (
              <button
                key={option}
                type="button"
                className={minutes === option ? "tb-duration is-current" : "tb-duration"}
                onClick={() => setMinutes(option)}
                aria-pressed={minutes === option}
              >
                {option} دقيقة
              </button>
            ))}
          </div>
        </div>

        <div className="tp-actions">
          <button type="submit" className="tp-btn tp-btn-primary">
            <Check size={16} aria-hidden="true" />
            حفظ
          </button>
          {saved && (
            <span className="tp-badge" data-tone="go" role="status">
              حُفظ في هذا المتصفّح
            </span>
          )}
        </div>
      </form>

      <section className="tp-card" style={{ marginBlockStart: "var(--space-6)" }} aria-labelledby="set-data">
        <h2 className="tp-card-title" id="set-data">
          أين تسكن بياناتك
        </h2>
        <p className="tp-empty">
          المهام وجلسات التركيز في Supabase، والاجتماعات في Notion. الاسم والمدّة أعلاه في هذا المتصفّح
          وحده ولا يغادرانه.
        </p>
        <p className="tp-empty" style={{ marginBlockStart: "var(--space-5)" }}>
          حالة اتصال المهام:{" "}
          <span className="tp-badge" data-tone={status.data?.configured ? "go" : "warn"}>
            {status.data?.configured ? "موصولة" : "غير مضبوطة"}
          </span>
        </p>
      </section>
    </TimeLayout>
  );
}
