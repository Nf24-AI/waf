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
import LangToggle from "@/components/LangToggle";
import TimeLayout from "@/components/time/TimeLayout";
import { t } from "@/lib/i18n";
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
        <h1>{t("الإعدادات", "Settings")}</h1>
        <p>{t("ما يخصّك في هذا الجهاز.", "Your preferences on this device.")}</p>
      </header>

      <form className="tp-card" style={{ marginBlockStart: "var(--space-8)" }} onSubmit={save}>
        <div className="tm-field">
          <span>{t("اسمك", "Your name")}</span>
          <input
            type="text"
            value={name}
            maxLength={40}
            placeholder={t("يظهر في تحيّة الصفحة الرئيسية", "Shown in the home page greeting")}
            onChange={event => setName(event.target.value)}
          />
        </div>

        <div className="tm-field" style={{ marginBlockStart: "var(--space-7)" }}>
          <span>{t("المدّة الافتراضية لجلسة التركيز", "Default focus session length")}</span>
          <div className="tb-durations">
            {[25, 50, 90].map(option => (
              <button
                key={option}
                type="button"
                className={minutes === option ? "tb-duration is-current" : "tb-duration"}
                onClick={() => setMinutes(option)}
                aria-pressed={minutes === option}
              >
                {t(`${option} دقيقة`, `${option} min`)}
              </button>
            ))}
          </div>
        </div>

        <div className="tm-field" style={{ marginBlockStart: "var(--space-7)" }}>
          <span>{t("اللغة", "Language")}</span>
          <div className="tb-durations">
            <LangToggle className="tb-duration" />
          </div>
        </div>

        <div className="tp-actions">
          <button type="submit" className="tp-btn tp-btn-primary">
            <Check size={16} aria-hidden="true" />
            {t("حفظ", "Save")}
          </button>
          {saved && (
            <span className="tp-badge" data-tone="go" role="status">
              {t("حُفظ في هذا المتصفّح", "Saved in this browser")}
            </span>
          )}
        </div>
      </form>

      <section className="tp-card" style={{ marginBlockStart: "var(--space-6)" }} aria-labelledby="set-data">
        <h2 className="tp-card-title" id="set-data">
          {t("أين تسكن بياناتك", "Where your data lives")}
        </h2>
        <p className="tp-empty">
          {t(
            "المهام وجلسات التركيز في Supabase، والاجتماعات في Notion. الاسم والمدّة أعلاه في هذا المتصفّح وحده ولا يغادرانه.",
            "Tasks and focus sessions are stored in Supabase, and meetings in Notion. The name and length above stay in this browser only.",
          )}
        </p>
        <p className="tp-empty" style={{ marginBlockStart: "var(--space-5)" }}>
          {t("حالة اتصال المهام:", "Tasks connection:")}{" "}
          <span className="tp-badge" data-tone={status.data?.configured ? "go" : "warn"}>
            {status.data?.configured ? t("موصولة", "Connected") : t("غير مضبوطة", "Not configured")}
          </span>
        </p>
      </section>
    </TimeLayout>
  );
}
