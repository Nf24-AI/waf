import React from "react";
import { FLOW_STEPS, type FlowStepId, stepIndex, useInFlow } from "@/lib/flow";
import { t } from "@/lib/i18n";

/**
 * نقاط التقدّم — تظهر في الرحلة وحدها.
 *
 * صفحةٌ تعرض «٢ من ٤» دائماً تقول إن الطرق خطوات، وهي ليست كذلك: من يفتح
 * المصفوفة ليعيد ترتيب مهامه لا يمرّ بخطوة من شيء. فإن لم تكن في الرحلة لم
 * يكن هناك ما يُعرض أصلاً.
 */
export default function FlowSteps({ current }: { current: FlowStepId }) {
  const inFlow = useInFlow();
  if (!inFlow) return null;

  const index = stepIndex(current);

  return (
    <div className="tp-steps">
      <ol className="tp-steps-dots">
        {FLOW_STEPS.map((step, position) => (
          <li
            key={step.id}
            className={
              position === index ? "tp-step is-current" : position < index ? "tp-step is-done" : "tp-step"
            }
          >
            {/* الاسم للقارئ الآلي: النقطة وحدها لا تقول شيئاً بصوت. */}
            <span className="sr-only">{t(step.label, step.labelEn)}</span>
          </li>
        ))}
      </ol>
      <p className="tp-steps-label">
        {t(FLOW_STEPS[index].label, FLOW_STEPS[index].labelEn)} — {index + 1} {t("من", "of")} {FLOW_STEPS.length}
      </p>
    </div>
  );
}
