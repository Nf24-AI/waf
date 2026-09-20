import type { MeetingRecord } from "./meeting-store";
import { toIsoDate } from "./meeting-date";

/**
 * سجلّ القرارات.
 *
 * لا قاعدة بيانات جديدة لهذه الخدمة: القرارات تُلتقط أصلاً داخل بنود جدول
 * الأعمال أثناء الاجتماع (`agenda[].decision` ومعه `owner`). السجلّ يقرأها من
 * الاجتماعات الموجودة ويعرضها مرتّبة، فيعمل على بيانات اليوم لا على بيانات
 * تبدأ من الصفر — وأي قرار يُكتب في اجتماع يظهر هنا بلا خطوة إضافية.
 *
 * وهذا أيضاً يعني أن الاجتماع يبقى مصدر الحقيقة الوحيد: لا نسخة ثانية تتباعد
 * عنه، ولا سجلّ يحتاج تحديثاً يدوياً حين يتغيّر القرار.
 */

export interface DecisionEntry {
  /** مستقرّ عبر عمليات الجلب: الاجتماع وموضع البند داخله. */
  id: string;
  /** نصّ القرار كما كُتب. */
  decision: string;
  /** البند الذي اتُّخذ فيه — «ما الذي كنا نقرّر فيه». */
  topic: string;
  /** خلفية البند، إن كُتبت. */
  context: string;
  /** مالك القرار. قد يكون فارغاً: قرار بلا مالك حقيقة تستحق الظهور لا الإخفاء. */
  owner: string;
  meetingId: string;
  meetingTitle: string;
  meetingType: string;
  /** تاريخ الاجتماع كما كُتب، وهو «متى» القرار. */
  date: string;
  /** صيغة ISO للترتيب، أو null إن كان التاريخ غير مقروء. */
  isoDate: string | null;
  /** من كان في الغرفة حين اتُّخذ. */
  attendees: string[];
}

const clean = (value: string | undefined) => (value ?? "").trim();

/**
 * تُستخرج القرارات من الاجتماعات، الأحدث أولاً.
 *
 * بند بلا نصّ قرار ليس قراراً مؤجَّلاً بل بند لم يُقرَّر فيه شيء، فلا يدخل
 * السجلّ. واجتماع بتاريخ غير مقروء يُدفع إلى الآخر بدل أن يُحذف: بياناته
 * موجودة، وإخفاؤها أسوأ من عرضها في غير موضعها.
 */
export function collectDecisions(meetings: readonly MeetingRecord[]): DecisionEntry[] {
  const entries: DecisionEntry[] = [];

  for (const meeting of meetings) {
    meeting.agenda.forEach((item, index) => {
      const decision = clean(item.decision);
      if (!decision) return;

      entries.push({
        id: `${meeting.id}#${index}`,
        decision,
        topic: clean(item.title),
        context: clean(item.context),
        owner: clean(item.owner),
        meetingId: meeting.id,
        meetingTitle: clean(meeting.title),
        meetingType: clean(meeting.type),
        date: clean(meeting.date),
        isoDate: toIsoDate(meeting.date),
        attendees: meeting.attendees.filter((name) => clean(name) !== ""),
      });
    });
  }

  return entries.sort((a, b) => {
    if (a.isoDate && b.isoDate) return b.isoDate.localeCompare(a.isoDate);
    if (a.isoDate) return -1;
    if (b.isoDate) return 1;
    return 0;
  });
}

/** المالكون الظاهرون في السجلّ، مرتّبين، بلا فراغات. للتصفية. */
export function decisionOwners(entries: readonly DecisionEntry[]): string[] {
  // Array.from لا [...set]: هدف TypeScript في هذا المشروع لا يسمح بتكرار Set مباشرة.
  return Array.from(new Set(entries.map((entry) => entry.owner).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}

export interface DecisionFilter {
  /** بحث حرّ في نصّ القرار وبنده واجتماعه ومالكه. */
  query?: string;
  /** مالك بعينه، أو فراغ لكل المالكين. */
  owner?: string;
}

/**
 * البحث يشمل الاجتماع والمالك لا نصّ القرار وحده: من يفتح السجلّ غالباً يتذكّر
 * أين قيل الشيء أو من قاله، لا صيغته الحرفية.
 */
export function filterDecisions(
  entries: readonly DecisionEntry[],
  filter: DecisionFilter = {},
): DecisionEntry[] {
  const needle = clean(filter.query).toLowerCase();
  const owner = clean(filter.owner);

  return entries.filter((entry) => {
    if (owner && entry.owner !== owner) return false;
    if (!needle) return true;
    return [entry.decision, entry.topic, entry.context, entry.meetingTitle, entry.owner]
      .join("\n")
      .toLowerCase()
      .includes(needle);
  });
}

/** كم قراراً بلا مالك — الرقم الذي يستحق أن يراه مدير المشروع. */
export function unownedCount(entries: readonly DecisionEntry[]): number {
  return entries.filter((entry) => !entry.owner).length;
}
