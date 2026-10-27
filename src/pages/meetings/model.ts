// ما تحتاجه صفحات الاجتماعات من نصوص وقواعد عرض: القوالب، أسئلة التحضير، الترتيب، والتنسيق.

import type { AgendaItem, Followup, Meeting, MeetingFields, MeetingKind, MeetingStatus } from "@/data/types";
import { formatClock, formatDay, t } from "@/lib/i18n";
import type { PrepareStepId } from "@/lib/meetings";
import { addDays, dayOf, toMinutes } from "@/lib/time";

// ───────── القوالب ─────────

export type TemplateId = "internal" | "partner" | "leadership" | "general";

type NewMeeting = Partial<MeetingFields> & { agenda?: Omit<AgendaItem, "id">[]; followups?: Omit<Followup, "id">[] };

const item = (title: string, context: string, goal: string): Omit<AgendaItem, "id"> => ({ title, context, goal, decision: "", owner: "", covered: false });
const follow = (text: string): Omit<Followup, "id"> => ({ text, done: false });

export function templates(): { id: TemplateId; name: string; line: string; fields: NewMeeting }[] {
  return [
    {
      id: "internal",
      name: t("اجتماع داخلي", "Internal meeting"),
      line: t("مع فريقك: المستجدات والخطوة التالية.", "With your team: what changed and what’s next."),
      fields: {
        title: t("اجتماع داخلي جديد", "New internal meeting"),
        kind: "internal",
        goal: t("ما النتيجة التي نحتاج إلى الخروج بها؟", "What outcome do we need to leave with?"),
        agenda: [item(t("المستجدات", "Updates"), t("ما الذي تغيّر منذ آخر اجتماع؟", "What has changed since the last meeting?"), t("تحديد الأولوية التالية.", "Agree on the next priority."))],
        followups: [follow(t("تحديد الخطوة التالية", "Set the next step"))],
      },
    },
    {
      id: "partner",
      name: t("مع شريك", "With a partner"),
      line: t("التزام مطلوب من الطرفين، بمالك وموعد.", "A commitment from both sides, with an owner and a date."),
      fields: {
        title: t("مراجعة مع شريك", "Partner review"),
        kind: "partner",
        goal: t("ما القرار أو الالتزام المطلوب من الطرفين؟", "What decision or commitment do both sides need to make?"),
        agenda: [
          item(t("الهدف المشترك", "Shared goal"), t("أين نقف الآن، وما الذي يريده كل طرف؟", "Where we stand, and what each side wants."), t("صورة واحدة يتفق عليها الطرفان.", "One picture both sides agree on.")),
          item(t("الخطوات التالية", "Next steps"), t("ما الذي يجب أن يحدث بعد الاجتماع؟", "What has to happen after this meeting?"), t("خطوة بمالك وموعد.", "A step with an owner and a date.")),
        ],
        followups: [follow(t("تأكيد المالك والموعد", "Confirm the owner and the date"))],
      },
    },
    {
      id: "leadership",
      name: t("قيادة", "Leadership"),
      line: t("قرارات تُحسم اليوم، لا تقارير تُقرأ.", "Decisions to settle today, not reports to read."),
      fields: {
        title: t("مراجعة فريق القيادة", "Leadership review"),
        kind: "leadership",
        goal: t("ما القرارات التي يجب حسمها اليوم؟", "Which decisions must be settled today?"),
        agenda: [
          item(t("صورة سريعة", "Quick picture"), t("حالة المشاريع في دقيقتين.", "Project status in two minutes."), t("قراءة واحدة للوضع.", "One shared reading of where we are.")),
          item(t("قرارات مفتوحة", "Open decisions"), t("ما ينتظر قراراً من القيادة.", "What is waiting on leadership."), t("حسم أو تأجيل بموعد.", "Settle it, or defer it to a date.")),
        ],
        followups: [follow(t("تجهيز ملخص القرار", "Prepare the decision summary"))],
      },
    },
    {
      id: "general",
      name: t("عام", "General"),
      line: t("هيكل بسيط تبني عليه.", "A simple frame to build on."),
      fields: {
        title: t("اجتماع جديد", "New meeting"),
        kind: "other",
        goal: t("ما الغرض الأساسي من هذا الاجتماع؟", "What is this meeting for?"),
        agenda: [item(t("تحديد الهدف", "Set the goal"), "", t("نتفق على ما نريد الخروج به.", "Agree on what we want to leave with."))],
        followups: [follow(t("تأكيد الخطوة التالية", "Confirm the next step"))],
      },
    },
  ];
}

// ───────── خطوات التحضير ─────────

export function stepCopy(id: PrepareStepId): { name: string; question: string; example: string } {
  switch (id) {
    case "basics":
      return {
        name: t("الأساسيات", "Basics"),
        question: t("ما اسم الاجتماع، ومتى؟", "What is the meeting called, and when is it?"),
        example: t("مثال: «مراجعة شراكة الربع الثالث»، الخميس ٢٧ أغسطس، ١٠:٠٠ إلى ١١:٠٠", "Example: “Q3 partnership review”, Thursday 27 August, 10:00 to 11:00"),
      };
    case "goal":
      return {
        name: t("الهدف", "Goal"),
        question: t("ما النتيجة التي يجب الخروج بها؟ اكتبها في جملة واحدة.", "What outcome must you leave with? Write it in one sentence."),
        example: t("مثال: نتفق على نطاق المرحلة الثانية وموعد التسليم قبل نهاية الشهر.", "Example: We agree on the phase-two scope and a delivery date before month end."),
      };
    case "agenda":
      return {
        name: t("المحاور", "Topics"),
        question: t("ما المحاور؟ لكل محور: عمّ نتحدث، ولماذا، وما الذي نريد الخروج به.", "What are the topics? For each: what we discuss, why, and what we want from it."),
        example: t("مثال: «نطاق المرحلة الثانية»، الشريك يطلب بوابة الدفع، ونريد قراراً: داخل النطاق أم مرحلة مستقلة.", "Example: “Phase-two scope”: the partner wants the payment gateway; we need a decision: in scope or a separate phase."),
      };
    case "people":
      return {
        name: t("الحضور", "People"),
        question: t("من يحضر؟ ضع من يملك القرار في المحاور أعلاه.", "Who attends? Make sure whoever owns the decision is in the room."),
        example: t("مثال: سارة العتيبي، خالد المطيري", "Example: Sara Alotaibi, Khalid Almutairi"),
      };
    case "followups":
      return {
        name: t("المتابعة", "Follow-up"),
        question: t("ما الذي يجب أن تخرج به مكتوباً؟", "What must you leave with in writing?"),
        example: t("مثال: إرسال محضر الاجتماع للشريك.", "Example: Send the minutes to the partner."),
      };
  }
}

// ───────── التسميات ─────────

export function statusLabel(s: MeetingStatus): string {
  return s === "draft" ? t("مسودة", "Draft") : s === "ready" ? t("جاهز للعرض", "Ready") : t("تم الاجتماع", "Held");
}

/** لون الحالة كما في DESIGN.md: مسودة رمادي، جاهز غسقي، تم نخيلي */
export const STATUS_TONE: Record<MeetingStatus, { dot: string; pill: string }> = {
  draft: { dot: "bg-slate", pill: "bg-slate-wash text-slate" },
  ready: { dot: "bg-dusk", pill: "bg-dusk-wash text-dusk" },
  done: { dot: "bg-palm", pill: "bg-palm-wash text-palm" },
};

export const KINDS: MeetingKind[] = ["internal", "partner", "leadership", "other"];

export function titleOf(m: { title: string }): string {
  return m.title.trim() || t("اجتماع بلا عنوان", "Untitled meeting");
}

/** عدد معدود بالعربية الصحيحة: محور واحد، محوران، ٣–١٠ محاور، ١١+ محوراً */
function arCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : many}`;
}

export function topicsCount(n: number): string {
  return t(arCount(n, "محور واحد", "محوران", "محاور", "محوراً"), `${n} ${n === 1 ? "topic" : "topics"}`);
}

export function followupsCount(n: number): string {
  return t(arCount(n, "نقطة واحدة", "نقطتان", "نقاط", "نقطة"), `${n} ${n === 1 ? "follow-up" : "follow-ups"}`);
}

export function meetingsCount(n: number): string {
  return t(arCount(n, "اجتماع واحد", "اجتماعان", "اجتماعات", "اجتماعاً"), `${n} ${n === 1 ? "meeting" : "meetings"}`);
}

// ───────── الوقت ─────────

export function today(): string {
  return dayOf();
}

/** «اليوم» و«غداً» و«أمس»، وما عداها تاريخ كامل */
export function dayLabel(day: string, opts?: Intl.DateTimeFormatOptions): string {
  const now = today();
  if (day === now) return t("اليوم", "Today");
  if (day === addDays(now, 1)) return t("غداً", "Tomorrow");
  if (day === addDays(now, -1)) return t("أمس", "Yesterday");
  return formatDay(day, opts);
}

export function longDate(day: string): string {
  return formatDay(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function timeRange(m: { startTime: string | null; endTime: string | null }): string | null {
  if (!m.startTime) return null;
  return m.endTime ? `${formatClock(m.startTime)} – ${formatClock(m.endTime)}` : formatClock(m.startTime);
}

/** الاجتماع قائم الآن؟ (اليوم، وبين البداية والنهاية أو ساعة بعد البداية إن لم تُحدَّد النهاية) */
export function isLive(m: Pick<Meeting, "day" | "startTime" | "endTime">, now: Date): boolean {
  if (!m.day || !m.startTime || m.day !== dayOf(now)) return false;
  const min = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(m.startTime);
  const end = m.endTime ? toMinutes(m.endTime) : start + 60;
  return min >= start && min < end;
}

// ───────── القائمة ─────────

export type Scope = "upcoming" | "past" | "all";

const byStart = (a: Meeting, b: Meeting) => (a.startTime ?? "99") < (b.startTime ?? "99") ? -1 : (a.startTime ?? "99") > (b.startTime ?? "99") ? 1 : 0;

/** القادمة: الأقرب أولاً وما بلا تاريخ في آخرها. السابقة: الأحدث أولاً. */
export function inScope(list: Meeting[], scope: Scope): Meeting[] {
  const now = today();
  const upcoming = list
    .filter((m) => m.day === null || m.day >= now)
    .sort((a, b) => {
      if (a.day === b.day) return byStart(a, b);
      if (a.day === null) return 1;
      if (b.day === null) return -1;
      return a.day < b.day ? -1 : 1;
    });
  const past = list
    .filter((m) => m.day !== null && m.day < now)
    .sort((a, b) => (a.day === b.day ? -byStart(a, b) : a.day! < b.day! ? 1 : -1));
  return scope === "upcoming" ? upcoming : scope === "past" ? past : [...upcoming, ...past];
}

/** الاجتماع الذي يُفتح افتراضياً على الحاسب: أقرب قادم لم ينتهِ بعد */
export function nextMeeting(list: Meeting[], now: Date): Meeting | undefined {
  const upcoming = inScope(list, "upcoming");
  const min = now.getHours() * 60 + now.getMinutes();
  const d = dayOf(now);
  return (
    upcoming.find((m) => m.day !== null && !(m.day === d && m.startTime && toMinutes(m.endTime ?? m.startTime) + (m.endTime ? 0 : 60) <= min)) ??
    upcoming[0] ??
    inScope(list, "past")[0]
  );
}

/** يجمع الصفوف تحت عنوان يومها */
export function groupByDay(list: Meeting[]): { day: string | null; items: Meeting[] }[] {
  const out: { day: string | null; items: Meeting[] }[] = [];
  for (const m of list) {
    const last = out[out.length - 1];
    if (last && last.day === m.day) last.items.push(m);
    else out.push({ day: m.day, items: [m] });
  }
  return out;
}

export function matches(m: Meeting, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [m.title, m.goal, ...m.attendees].some((x) => x.toLowerCase().includes(s));
}

// ───────── PDF ─────────

/** عنوان المستند أثناء الطباعة: يصير اسم ملف PDF */
export function printTitle(m: { title: string; day: string | null }): string {
  const parts = [t("واف", "Waf"), titleOf(m), m.day ? longDate(m.day) : ""].filter(Boolean);
  return parts
    .join(" — ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .slice(0, 120);
}
