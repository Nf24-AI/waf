import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { type Identity } from "./auth";
import {
  type Quadrant,
  type Task,
  nextOccurrence,
  quadrantOf,
  splitQuadrant,
  stateOf,
  type Importance,
  type RepeatRule,
  type Urgency,
} from "@shared/tasks";
import { type FocusSession } from "@shared/statistics";

/**
 * المهام في Supabase، والملكية من جلسة المستخدم.
 *
 * كان الوصول برمز مالك واحد في متغيّر بيئة: يكفي وحده لقراءة كل صفّ في
 * الجدول. كان ذلك مقبولاً ومستخدمُ المنتج واحد، وسقط في اللحظة التي صار فيها
 * للمنتج حسابات — رمزٌ واحد يعني مساحة واحدة يراها الجميع.
 *
 * الآن يُمرَّر رمز جلسة المستخدم إلى PostgREST كما هو، فتتحقّق قاعدة البيانات
 * من توقيعه وتطبّق سياسات RLS على `auth.uid()`. الحدّ في قاعدة البيانات لا
 * في هذا الملف: خطأٌ هنا يعني بياناتٍ ناقصة، لا بياناتِ شخصٍ آخر.
 *
 * ولا مكتبة supabase-js هنا: الطلبات أربعة أفعال على REST، وfetch يكفيها.
 */

const TABLE = "eisenhower_tasks";
const SESSIONS = "waf_focus_sessions";

export function tasksAreConfigured() {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
}

function credentials() {
  const missing = [
    !ENV.supabaseUrl && "SUPABASE_URL",
    !ENV.supabaseAnonKey && "SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (missing.length) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      // الرسالة تسمّي الناقص: خطأ الإعداد يُقرأ مرة واحدة ويُصلَح، ولا يُخمَّن.
      message: `المهام غير مضبوطة. الناقص: ${missing.join("، ")}`,
    });
  }
  return { url: ENV.supabaseUrl.replace(/\/$/, ""), key: ENV.supabaseAnonKey };
}

async function rest<T>(who: Identity, path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      // رمز المستخدم لا المفتاح المجهول: هو ما يجعل auth.uid() له.
      Authorization: `Bearer ${who.token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TRPCError({
      code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
      message: `Supabase ${response.status}: ${body.slice(0, 200)}`,
    });
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** الصفّ كما يخزّنه Supabase. الأعمدة بأسماء التطبيق السابق، فلا تُكسر بياناته. */
interface Row {
  id: string;
  name: string;
  description: string | null;
  importance: Importance | null;
  urgency: Urgency | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_minutes: number | null;
  classified_at: string | null;
  completed_at: string | null;
  repeat_rule: RepeatRule | null;
  reminder_minutes: number | null;
  is_done: boolean;
  created_at: string;
}

/**
 * الرُّبع مشتقّ من العمودين لا مخزّن ثالثاً.
 *
 * التطبيق السابق يكتب importance و urgency، وهذا يقرأ quadrant. تخزينه
 * عموداً ثالثاً يعني ثلاث قيم لحقيقة واحدة تتباعد أول ما ينساها أحد.
 */
function toTask(row: Row, sessions = 0): Task {
  // الأعمدة إلزامية فلكل صفّ قيمة فيها؛ classified_at وحده يقول إن كان
  // صاحبها اختارها. بدونه لا توجد «مهمة غير مصنّفة» في النظام إطلاقاً.
  const quadrant: Quadrant | undefined =
    row.classified_at && row.importance && row.urgency
      ? quadrantOf(row.importance, row.urgency)
      : undefined;

  const completedAt = row.completed_at ?? (row.is_done ? row.created_at : undefined);

  const core = {
    id: row.id,
    title: row.name,
    description: row.description ?? undefined,
    quadrant,
    scheduledStart: row.scheduled_start ?? undefined,
    scheduledEnd: row.scheduled_end ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    repeatRule: row.repeat_rule ?? undefined,
    reminderMinutes: row.reminder_minutes ?? undefined,
    completedSessions: sessions,
    createdAt: row.created_at,
    completedAt: completedAt ?? undefined,
  };

  return { ...core, state: stateOf(core) };
}

/** الأعمدة التي قد لا تكون رُحِّلت بعد. تُحذف من الطلب حين يقول الخادم إنها غائبة. */
const OPTIONAL_COLUMNS = ["repeat_rule", "reminder_minutes"] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

const BASE_COLUMNS =
  "id,name,description,importance,urgency,classified_at,scheduled_start,scheduled_end,estimated_minutes,completed_at,is_done,created_at";

/**
 * الجدول يُرحَّل بيدٍ في لوحة Supabase، والنشر لا ينتظر الترحيل.
 *
 * فإن سبق الكودُ عموداً لم يسقط كل شيء: يردّ PostgREST بـ42703 ويسمّي
 * العمود، فنسقطه من الطلب ونعيد مرّة. تتعطّل الخانة وحدها بدل أن تتعطّل
 * قراءة المهام كلّها — والفرق أن الأولى تُفقد خياراً، والثانية تجعل المنتج
 * يقول «لا مهام لديك» لمن عنده مهامه كلّها.
 *
 * والمجموعة تُفرَّغ عند كل إقلاع، فيعود العمود من تلقائه بعد الترحيل.
 */
const missing = new Set<OptionalColumn>();

function columns(): string {
  const extra = OPTIONAL_COLUMNS.filter(column => !missing.has(column));
  return extra.length ? `${BASE_COLUMNS},${extra.join(",")}` : BASE_COLUMNS;
}

/** العمود الذي اشتكى منه الخادم، إن كان أحد أعمدتنا الاختيارية. */
function absentColumn(error: unknown): OptionalColumn | null {
  const message = String((error as Error)?.message ?? "");
  if (!/42703|does not exist/.test(message)) return null;
  return OPTIONAL_COLUMNS.find(column => message.includes(column)) ?? null;
}

/** ما يُكتب من الخيارات، منزوعاً منه ما لا وجود له في الجدول. */
function optional(values: Partial<Record<OptionalColumn, unknown>>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(values)) {
    if (!missing.has(column as OptionalColumn)) body[column] = value;
  }
  return body;
}

/**
 * ينفّذ الطلب، وكلّما كان سببُ فشله عموداً غائباً أسقطه وأعاد.
 *
 * المحاولات محدودة بعدد الأعمدة الاختيارية: كل إعادة تُسقط عموداً جديداً،
 * فلا تدور الحلقة على خطأٍ سببه شيء آخر.
 */
async function withSchemaFallback<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= OPTIONAL_COLUMNS.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const column = absentColumn(error);
      if (!column || missing.has(column)) throw error;
      missing.add(column);
    }
  }
  return run();
}
/**
 * جلسات التركيز المكتملة لكل مهمة، في طلب واحد لا طلب لكل صفّ.
 *
 * تُعدّ المكتملة وحدها: جلسة قُطعت في دقيقتها الثالثة ليست جلسة تركيز، وعدّها
 * يجعل الرقم يكافئ البدء لا الاستمرار.
 */
async function sessionCounts(who: Identity, taskIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!taskIds.length) return counts;

  const list = taskIds.map(id => `"${id}"`).join(",");
  const rows = await rest<{ task_id: string }[]>(who, `${SESSIONS}?select=task_id&completed=is.true&task_id=in.(${list})`,
  );
  for (const row of rows) counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1);
  return counts;
}

/**
 * الصفّ الواحد العائد من كتابة، بعدده الصحيح من الجلسات.
 *
 * طلب إضافي، لكن البديل أن تعود المهمة من كلّ كتابة وعدّادها صفر بينما تعرض
 * القائمة رقمه الحقيقي — فيختلف الرقم باختلاف الشاشة التي جئت منها.
 */
async function withSessions(who: Identity, row: Row): Promise<Task> {
  const counts = await sessionCounts(who, [row.id]);
  return toTask(row, counts.get(row.id) ?? 0);
}

/** المهام المفتوحة: ما لم يُنجَز ولم يُؤرشَف. هي ما تعرضه الواجهات كلها. */
export async function listOpenTasks(who: Identity): Promise<Task[]> {
  const rows = await withSchemaFallback(() =>
    rest<Row[]>(
      who,
      `${TABLE}?select=${columns()}&completed_at=is.null&is_done=eq.false&is_archived=eq.false&order=created_at.desc`,
    ),
  );
  const counts = await sessionCounts(who, rows.map(row => row.id));
  return rows.map(row => toTask(row, counts.get(row.id) ?? 0));
}

export async function listCompletedTasks(who: Identity, sinceIso?: string): Promise<Task[]> {
  const since = sinceIso ? `&completed_at=gte.${encodeURIComponent(sinceIso)}` : "";
  const rows = await withSchemaFallback(() => rest<Row[]>(who, `${TABLE}?select=${columns()}&completed_at=not.is.null${since}&order=completed_at.desc`),
  );
  const counts = await sessionCounts(who, rows.map(row => row.id));
  return rows.map(row => toTask(row, counts.get(row.id) ?? 0));
}

export async function createTask(who: Identity, input: {
  title: string;
  description?: string;
  quadrant?: Quadrant;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedMinutes?: number;
  repeatRule?: RepeatRule;
  reminderMinutes?: number;
}): Promise<Task> {
  const split = input.quadrant ? splitQuadrant(input.quadrant) : null;

  const [row] = await withSchemaFallback(() => rest<Row[]>(who, `${TABLE}?select=${columns()}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: who.userId,
        name: input.title.trim(),
        description: input.description?.trim() || null,
        // الجدول القديم يشترط العمودين. مهمة بلا تصنيف تبدأ في «غير مهم وغير
        // عاجل» لو تُركت للقيد، وهذا حكم لم يصدره أحد — فالافتراض «مهم وعاجل»
        // خطأ مثله. نكتب ما اختاره المستخدم، وإن لم يختر فأقلّها ادّعاءً.
        importance: split?.importance ?? "not-important",
        urgency: split?.urgency ?? "not-urgent",
        classified_at: split ? new Date().toISOString() : null,
        scheduled_start: input.scheduledStart ?? null,
        scheduled_end: input.scheduledEnd ?? null,
        estimated_minutes: input.estimatedMinutes ?? null,
        ...optional({ repeat_rule: input.repeatRule ?? null, reminder_minutes: input.reminderMinutes ?? null }),
      }),
    }),
  );

  return withSessions(who, row);
}

export async function classifyTask(who: Identity, id: string, quadrant: Quadrant): Promise<Task> {
  const { importance, urgency } = splitQuadrant(quadrant);
  const [row] = await withSchemaFallback(() => rest<Row[]>(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ importance, urgency, classified_at: new Date().toISOString() }),
    }),
  );
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لا مهمة بهذا المعرّف" });
  return withSessions(who, row);
}

/**
 * الجدولة، مع منع التعارض عند المصدر.
 *
 * الفحص هنا لا في الواجهة وحدها: واجهتان مفتوحتان في لسانين تريان القائمة
 * نفسها وقد تحجزان الوقت ذاته، ولا يمنع ذلك إلا من يكتب. القيد في الجدول
 * يحرس شكل الموعد؛ هذا يحرس ألّا يتداخل موعدان.
 */
export async function scheduleTask(
  who: Identity,
  id: string,
  startIso: string,
  endIso: string,
  repeatRule?: RepeatRule | null,
): Promise<Task> {
  if (new Date(endIso) <= new Date(startIso)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "وقت الانتهاء يجب أن يلي وقت البداية" });
  }

  // موعدان يتداخلان إن بدأ كلٌّ قبل نهاية الآخر. تُستثنى المهمة نفسها كي
  // تُعاد جدولتها على وقتها دون أن تصطدم بنفسها.
  const window =
    `scheduled_start=lt.${encodeURIComponent(endIso)}` +
    `&scheduled_end=gt.${encodeURIComponent(startIso)}`;
  const clashes = await rest<{ id: string; name: string }[]>(who, `${TABLE}?select=id,name&completed_at=is.null&is_archived=eq.false&${window}&id=neq.${id}`,
  );
  if (clashes.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `يوجد تعارض في هذا الوقت مع «${clashes[0].name}»`,
    });
  }

  const [row] = await withSchemaFallback(() => rest<Row[]>(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        scheduled_start: startIso,
        scheduled_end: endIso,
        // undefined يعني «لا تمسّ»، و null يعني «ألغِ التكرار».
        ...(repeatRule === undefined ? {} : optional({ repeat_rule: repeatRule })),
      }),
    }),
  );
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لا مهمة بهذا المعرّف" });
  return withSessions(who, row);
}

/**
 * الإنجاز — ومعه نسخة الغد إن كانت المهمة متكرّرة.
 *
 * المنجَز يبقى منجَزاً في الأرشيف، والقادم صفٌّ جديد بمعرّفه. والبديل — أن
 * يُعاد فتح الصفّ نفسه — يمحو تاريخه كلّما تكرّر، فتصير مهمةٌ أُنجزت ثلاثين
 * مرّة مهمةً واحدة لم تُنجَز بعد.
 */
export async function completeTask(who: Identity, id: string): Promise<Task> {
  const [row] = await withSchemaFallback(() => rest<Row[]>(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ completed_at: new Date().toISOString(), is_done: true }),
    }),
  );
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لا مهمة بهذا المعرّف" });

  // بلا موعد لا تكرار: «كل يوم» تحتاج ساعةً تقع فيها.
  if (row.repeat_rule && row.scheduled_start && row.scheduled_end) {
    const when = nextOccurrence(row.scheduled_start, row.scheduled_end, row.repeat_rule);
    await createTask(who, {
      title: row.name,
      description: row.description ?? undefined,
      quadrant:
        row.classified_at && row.importance && row.urgency
          ? quadrantOf(row.importance, row.urgency)
          : undefined,
      scheduledStart: when.start,
      scheduledEnd: when.end,
      estimatedMinutes: row.estimated_minutes ?? undefined,
      repeatRule: row.repeat_rule,
    });
  }

  return withSessions(who, row);
}

/** جلسة تركيز تُفتح عند البدء وتُغلق عند الانتهاء — ولو لم تُنجَز المهمة. */
export async function openFocusSession(who: Identity, taskId: string, plannedMinutes: number): Promise<string> {
  const id = crypto.randomUUID();
  await rest<void>(who, SESSIONS, {
    method: "POST",
    body: JSON.stringify({
      id,
      user_id: who.userId,
      task_id: taskId,
      planned_minutes: plannedMinutes,
      started_at: new Date().toISOString(),
    }),
  });
  return id;
}

export async function closeFocusSession(who: Identity, id: string, completed: boolean): Promise<void> {
  await rest<void>(who, `${SESSIONS}?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ended_at: new Date().toISOString(), completed }),
  });
}

/**
 * جلسات التركيز في مدة — للإحصاء وحده.
 *
 * تُقرأ بالبداية لا بالنهاية: الجلسة التي بدأت أمس وانتهت اليوم تنتمي إلى
 * أمس، وهو اليوم الذي قُضيت فيه.
 */
export async function listFocusSessions(who: Identity, sinceIso?: string): Promise<FocusSession[]> {
  const since = sinceIso ? `&started_at=gte.${encodeURIComponent(sinceIso)}` : "";
  const rows = await rest<
    { started_at: string; ended_at: string | null; planned_minutes: number; completed: boolean }[]
  >(who, `${SESSIONS}?select=started_at,ended_at,planned_minutes,completed${since}&order=started_at.desc`);

  return rows.map(row => ({
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    plannedMinutes: row.planned_minutes,
    completed: row.completed,
  }));
}
