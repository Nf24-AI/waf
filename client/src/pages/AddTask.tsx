// مستورَد صراحةً كما في بقية الصفحات: تحويل JSX تحت vitest كلاسيكي،
// فيحتاج React في النطاق وإن كان بناء Vite يستغني عنه.
import React from "react";
import { useLocation } from "wouter";
import { TASKS_ROUTE, TIME_MANAGEMENT_ROUTE } from "@shared/routes";
import AddTaskModal, { type NewTask } from "@/components/time/AddTaskModal";
import TimeManagement from "@/pages/TimeManagement";
import { flowHref, nextStep } from "@/lib/flow";
import { trpc } from "@/lib/trpc";

/**
 * ‎/tasks/new — النافذة فوق إدارة الوقت.
 *
 * مسارٌ لا حالةٌ داخلية: الرابط يُشارَك ويُحدَّث ويُفتح في لسان آخر، والرجوع
 * بزرّ المتصفّح يغلق النافذة كما يتوقّع من فتحها. ولو كانت حالةً في الصفحة
 * لضاعت عند أوّل تحديث.
 *
 * وما خلفها إدارة الوقت نفسها لا نسخةٌ ساكنة: المستخدم يرى مهامه خلف
 * النافذة، فيعرف أين سيقع ما يكتبه.
 */
export default function AddTask() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const create = trpc.tasks.create.useMutation({
    onSuccess: async task => {
      await utils.tasks.listOpen.invalidate();

      // صُنّفت وحُجز وقتها: لا يبقى ما يُسأل عنه، فتُعرض في قائمة المهام.
      // وإلّا تُقاد إلى أوّل خطوة ناقصة — والطريق اختياريّ يُترك بالإغلاق.
      if (task.quadrant && task.scheduledStart) {
        navigate(TASKS_ROUTE);
        return;
      }
      const step = task.quadrant ? nextStep("classify") : nextStep("add");
      navigate(step ? flowHref(step.route, task.id) : TASKS_ROUTE);
    },
  });

  function submit(task: NewTask) {
    create.mutate(task);
  }

  return (
    <>
      <TimeManagement />
      <AddTaskModal
        pending={create.isPending}
        error={create.error ? "تعذّر حفظ المهمة. حاول مرة أخرى." : null}
        onClose={() => navigate(TIME_MANAGEMENT_ROUTE)}
        onSubmit={submit}
      />
    </>
  );
}
