// بيانات العرض التجريبي: أسبوع عمل مدير مشروع، محسوب من تاريخ اليوم.

import { addDays, at, dayOf } from "@/lib/time";
import type { Meeting, Task, TaskOrigin } from "./types";

let n = 0;
const uid = () => `demo-${++n}-${Math.random().toString(36).slice(2, 8)}`;

export function seed() {
  n = 0;
  const today = dayOf();
  const d = (offset: number) => addDays(today, offset);
  const now = new Date().toISOString();

  const meeting = (m: Partial<Meeting> & Pick<Meeting, "title">): Meeting => ({
    id: uid(),
    day: null,
    startTime: null,
    endTime: null,
    kind: "internal",
    status: "draft",
    attendees: [],
    goal: "",
    note: "",
    link: "",
    image: "",
    shareToken: null,
    agenda: [],
    followups: [],
    updatedAt: now,
    ...m,
  });
  const item = (title: string, context: string, goal: string, decision = "", owner = "", covered = false) => ({
    id: uid(),
    title,
    context,
    goal,
    decision,
    owner,
    covered,
  });
  const follow = (text: string, done = false) => ({ id: uid(), text, done });

  const meetings: Meeting[] = [
    meeting({
      title: "مراجعة شراكة الربع الثالث",
      day: d(0),
      startTime: "10:00",
      endTime: "11:00",
      kind: "partner",
      status: "ready",
      attendees: ["سارة العتيبي", "خالد المطيري", "ريم القحطاني"],
      goal: "نتفق على نطاق المرحلة الثانية وموعد التسليم قبل نهاية الشهر.",
      note: "الشريك متحفّظ على الموعد، ابدأ بالأرقام قبل الطلب.",
      agenda: [
        item("نتائج المرحلة الأولى", "سلّمنا ٨ من ١٠ مخرجات، واثنان تأخّرا بسبب الاعتماد.", "صورة مشتركة لما تمّ"),
        item("نطاق المرحلة الثانية", "الشريك يطلب إضافة بوابة الدفع ضمن النطاق.", "قرار: داخل النطاق أم مرحلة مستقلة"),
        item("موعد التسليم", "الموعد المقترح ٣٠ من الشهر.", "تاريخ يلتزم به الطرفان"),
      ],
      followups: [follow("إرسال محضر الاجتماع للشريك"), follow("تحديث خطة المشروع بالموعد الجديد")],
    }),
    meeting({
      title: "اجتماع الفريق الأسبوعي",
      day: d(0),
      startTime: "13:30",
      endTime: "14:00",
      kind: "internal",
      status: "draft",
      attendees: ["فريق المنتج"],
      goal: "",
      agenda: [item("المستجدات", "ما الذي تغيّر منذ آخر اجتماع؟", "تحديد الأولوية التالية")],
    }),
    meeting({
      title: "مراجعة فريق القيادة",
      day: d(2),
      startTime: "09:00",
      endTime: "10:00",
      kind: "leadership",
      status: "draft",
      attendees: ["المدير التنفيذي", "مدير العمليات"],
      goal: "ما القرارات التي يجب حسمها هذا الأسبوع؟",
      agenda: [item("صورة سريعة", "حالة المشاريع الثلاثة", "قراءة واحدة للوضع"), item("قرارات مفتوحة", "الميزانية الإضافية للربع", "حسم أو تأجيل بموعد")],
    }),
    meeting({
      title: "تخطيط السبرنت ١٤",
      day: d(-2),
      startTime: "11:00",
      endTime: "12:00",
      kind: "internal",
      status: "done",
      attendees: ["نورة السبيعي", "فهد الدوسري", "سارة العتيبي"],
      goal: "نخرج بقائمة السبرنت مرتّبة ومقدّرة.",
      agenda: [
        item("الديون التقنية", "بطء صفحة التقارير", "نقرّر نصيب الديون من السبرنت", "٢٠٪ من السبرنت للديون التقنية", "فهد الدوسري", true),
        item("ميزة التصدير", "طلب متكرّر من العملاء", "نقرّر الأولوية", "تُؤجَّل للسبرنت القادم", "", true),
      ],
      followups: [follow("تحديث لوحة السبرنت", true), follow("إبلاغ العملاء بموعد التصدير")],
    }),
    meeting({
      title: "مراجعة عقد المورّد",
      day: d(-4),
      startTime: "14:00",
      endTime: "15:00",
      kind: "partner",
      status: "done",
      attendees: ["الإدارة القانونية", "خالد المطيري"],
      goal: "قرار التجديد أو البحث عن بديل.",
      agenda: [item("شروط التجديد", "رفع السعر ١٢٪", "قرار", "التجديد لسنة واحدة مع بند مراجعة", "خالد المطيري", true)],
      followups: [follow("صياغة ملحق العقد")],
    }),
    meeting({
      title: "عرض النموذج الأولي",
      day: d(-9),
      startTime: "10:00",
      kind: "internal",
      status: "draft",
      attendees: ["فريق التصميم"],
      goal: "",
    }),
  ];

  const task = (origin: TaskOrigin, t: Partial<Task> & Pick<Task, "title">): Task => ({
    id: uid(),
    notes: "",
    origin,
    quadrant: null,
    startsAt: null,
    endsAt: null,
    estimateMinutes: null,
    category: "deep",
    priority: "medium",
    repeatRule: null,
    repeatDays: [],
    sourceMeetingId: null,
    completedAt: null,
    createdAt: now,
    focusSessions: 0,
    ...t,
  });

  const tasks: Task[] = [
    // المصفوفة
    task("matrix", { title: "الرد على ملاحظات الشريك قبل الظهر", quadrant: "do" }),
    task("matrix", { title: "إعداد خطة الربع القادم", quadrant: "plan" }),
    task("matrix", { title: "حجز قاعة ورشة العمل", quadrant: "delegate" }),
    task("matrix", { title: "ترتيب مجلد الملفات القديمة", quadrant: "drop" }),
    task("matrix", { title: "مراجعة تقرير المخاطر" }),
    task("matrix", { title: "تحديث سجلّ أصحاب المصلحة" }),
    // حجز الوقت
    task("blocks", { title: "كتابة متطلبات بوابة الدفع", category: "deep", priority: "high", startsAt: at(today, "08:30"), endsAt: at(today, "10:00") }),
    task("blocks", { title: "مراجعة شراكة الربع الثالث", category: "meeting", startsAt: at(today, "10:00"), endsAt: at(today, "11:00") }),
    task("blocks", { title: "غداء", category: "personal", startsAt: at(today, "12:30"), endsAt: at(today, "13:15"), repeatRule: "weekdays" }),
    task("blocks", { title: "تحديث خطة المشروع", category: "project", startsAt: at(today, "15:00"), endsAt: at(today, "16:30") }),
    task("blocks", { title: "قراءة تقرير السوق", category: "deep", estimateMinutes: 45 }),
    task("blocks", { title: "الرد على البريد", category: "other", estimateMinutes: 30, priority: "low" }),
    // التركيز
    task("focus", { title: "كتابة ملخص المرحلة الأولى", focusSessions: 2 }),
    task("focus", { title: "مراجعة تصميم لوحة التقارير" }),
    // نظام واف
    task("waf", { title: "إرسال محضر الاجتماع للشريك", sourceMeetingId: meetings[0].id }),
    task("waf", { title: "تجهيز عرض مجلس الإدارة", quadrant: "do", estimateMinutes: 90, startsAt: at(today, "16:30"), endsAt: at(today, "18:00") }),
    task("waf", { title: "مقابلة مرشّح مدير المنتج", quadrant: "plan" }),
  ];

  return { meetings, tasks, sessions: [] };
}
