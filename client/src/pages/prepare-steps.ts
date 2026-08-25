import type { MeetingRecord } from "@shared/meeting-store";
import { toIsoDate } from "@shared/meeting-date";
import { parseTimeRange } from "@shared/meeting-time";

/**
 * Preparation as a sequence rather than a form.
 *
 * Every step asks a question and shows a worked example, because a blank field
 * labelled "الملخص التنفيذي" tells you the shape of the answer but not what a
 * good one looks like. `done` drives the progress indicator, so the person can
 * see they are building something rather than filling boxes.
 */
export type StepId = "basics" | "purpose" | "agenda" | "people" | "followups";

export type PrepareStep = {
  id: StepId;
  /** Lucide icon name, resolved by the component. */
  icon: "calendar-clock" | "target" | "list" | "users" | "check";
  title: { ar: string; en: string };
  question: { ar: string; en: string };
  example: { ar: string; en: string };
  done: (meeting: MeetingRecord) => boolean;
};

export const PREPARE_STEPS: PrepareStep[] = [
  {
    id: "basics",
    icon: "calendar-clock",
    title: { ar: "الأساسيات", en: "Basics" },
    question: {
      ar: "ما اسم الاجتماع، ومتى؟",
      en: "What is the meeting called, and when is it?",
    },
    example: {
      ar: "مثال: «مراجعة شراكة الربع الثالث» — الخميس ٢٧ أغسطس، ١٠:٠٠ – ١١:٠٠",
      en: "Example: “Q3 partnership review” — Thursday 27 August, 10:00–11:00",
    },
    done: (m) => m.title.trim() !== "" && toIsoDate(m.date) !== null && parseTimeRange(m.time).start !== "",
  },
  {
    id: "purpose",
    icon: "target",
    title: { ar: "الهدف", en: "Purpose" },
    question: {
      ar: "ما النتيجة التي يجب الخروج بها؟ اكتبها في جملة واحدة.",
      en: "What outcome must this meeting produce? One sentence.",
    },
    example: {
      ar: "مثال: «الاتفاق على مسار الإطلاق وموعده ومالكه، وإزالة العائق التنظيمي.»",
      en: "Example: “Agree the launch path, its date and owner, and clear the regulatory blocker.”",
    },
    done: (m) => m.summary.trim().length >= 15,
  },
  {
    id: "agenda",
    icon: "list",
    title: { ar: "المحاور", en: "Topics" },
    question: {
      ar: "ما المحاور؟ لكل محور: عمّ نتحدث، ولماذا، وما الذي نريد الخروج به.",
      en: "What are the topics? For each: what, why, and what you want to leave with.",
    },
    example: {
      ar: "مثال: «أداء الربع الثالث» — السياق: أهم المؤشرات وما تغيّر — نريد: تحديد ما يحتاج تدخلًا",
      en: "Example: “Q3 performance” — context: key signals and what changed — leave with: what needs intervention",
    },
    done: (m) => m.agenda.length > 0 && m.agenda.every((item) => item.title.trim() !== ""),
  },
  {
    id: "people",
    icon: "users",
    title: { ar: "الحضور", en: "Attendees" },
    question: {
      ar: "من يحضر؟ ضع من يملك القرار في المحاور أعلاه.",
      en: "Who attends? Include whoever can decide the topics above.",
    },
    example: {
      ar: "مثال: سارة العتيبي، خالد منصور، فريق الشراكات",
      en: "Example: Sarah Otaibi, Khalid Mansour, Partnerships team",
    },
    done: (m) => m.attendees.length > 0,
  },
  {
    id: "followups",
    icon: "check",
    title: { ar: "المتابعة", en: "Follow-ups" },
    question: {
      ar: "ما الذي يجب أن تخرج به مكتوبًا؟",
      en: "What must you leave with, written down?",
    },
    example: {
      ar: "مثال: «إحضار ملخص المؤشرات» · «تأكيد مالك خطة الإطلاق»",
      en: "Example: “Bring the metrics summary” · “Confirm the launch owner”",
    },
    done: (m) => m.actions.some((action) => action.trim() !== ""),
  },
];

/** How many steps are complete — drives the progress rail. */
export function completedSteps(meeting: MeetingRecord): number {
  return PREPARE_STEPS.filter((step) => step.done(meeting)).length;
}

/** The first unfinished step, so the workspace can point at what is next. */
export function nextStep(meeting: MeetingRecord): PrepareStep | undefined {
  return PREPARE_STEPS.find((step) => !step.done(meeting));
}
