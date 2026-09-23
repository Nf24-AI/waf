import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
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
 * المهام في Supabase، والوصول من هنا لا من المتصفح.
 *
 * الريبو عام، وأي مفتاح يدخل حزمة العميل يصير مقروءاً للجميع — ومع نموذج
 * `x-owner-code` يكفي الرمز وحده لقراءة المهام والكتابة فيها. فيبقى المفتاح
 * والرمز في الخادم، والعميل ينادي tRPC خلف بوّابة كلمة المرور القائمة.
 *
 * ولا مكتبة supabase-js: الطلبات أربعة أفعال على REST، وfetch يكفيها.
 */

const TABLE = "eisenhower_tasks";
const SESSIONS = "waf_focus_sessions";

export function tasksAreConfigured() {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey && ENV.tasksOwnerCode);
}

function credentials() {
  const missing = [
    !ENV.supabaseUrl && "SUPABASE_URL",
    !ENV.supabaseAnonKey && "SUPABASE_ANON_KEY",
    !ENV.tasksOwnerCode && "TASKS_OWNER_CODE",
  ].filter(Boolean);

  if (missing.length) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      // الرسالة تسمّي الناقص: خطأ الإعداد يُقرأ مرة واحدة ويُصلَح، ولا يُخمَّن.
      message: `المهام غير مضبوطة. الناقص: ${missing.join("، ")}`,
    });
  }
  return { url: ENV.supabaseUrl.replace(/\/$/, ""), key: ENV.supabaseAnonKey, owner: ENV.tasksOwnerCode };
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key, owner } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "x-owner-code": owner,
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
    completedSessions: sessions,
    createdAt: row.created_at,
    completedAt: completedAt ?? undefined,
  };

  return { ...core, state: stateOf(core) };
}

const COLUMNS =
  "id,name,description,importance,urgency,classified_at,scheduled_start,scheduled_end,estimated_minutes,repeat_rule,completed_at,is_done,created_at";

/**
 * جلسات التركيز المكتملة لكل مهمة، في طلب واحد لا طلب لكل صفّ.
 *
 * تُعدّ المكتملة وحدها: جلسة قُطعت في دقيقتها الثالثة ليست جلسة تركيز، وعدّها
 * يجعل الرقم يكافئ البدء لا الاستمرار.
 */
async function sessionCounts(taskIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!taskIds.length) return counts;

  const list = taskIds.map(id => `"${id}"`).join(",");
  const rows = await rest<{ task_id: string }[]>(
    `${SESSIONS}?select=task_id&completed=is.true&task_id=in.(${list})`,
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
async function withSessions(row: Row): Promise<Task> {
  const counts = await sessionCounts([row.id]);
  return toTask(row, counts.get(row.id) ?? 0);
}

/** المهام المفتوحة: ما لم يُنجَز ولم يُؤرشَف. هي ما تعرضه الواجهات كلها. */
export async function listOpenTasks(): Promise<Task[]> {
  const rows = await rest<Row[]>(
    `${TABLE}?select=${COLUMNS}&completed_at=is.null&is_done=eq.false&is_archived=eq.false&order=created_at.desc`,
  );
  const counts = await sessionCounts(rows.map(row => row.id));
  return rows.map(row => toTask(row, counts.get(row.id) ?? 0));
}

export async function listCompletedTasks(sinceIso?: string): Promise<Task[]> {
  const since = sinceIso ? `&completed_at=gte.${encodeURIComponent(sinceIso)}` : "";
  const rows = await rest<Row[]>(
    `${TABLE}?select=${COLUMNS}&completed_at=not.is.null${since}&order=completed_at.desc`,
  );
  const counts = await sessionCounts(rows.map(row => row.id));
  return rows.map(row => toTask(row, counts.get(row.id) ?? 0));
}

export async function createTask(input: {
  title: string;
  description?: string;
  quadrant?: Quadrant;
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedMinutes?: number;
  repeatRule?: RepeatRule;
}): Promise<Task> {
  const { owner } = credentials();
  const split = input.quadrant ? splitQuadrant(input.quadrant) : null;

  const [row] = await rest<Row[]>(`${TABLE}?select=${COLUMNS}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      owner_code: owner,
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
      repeat_rule: input.repeatRule ?? null,
    }),
  });

  return withSessions(row);
}

export async function classifyTask(id: string, quadrant: Quadrant): Promise<Task> {
  const { importance, urgency } = splitQuadrant(quadrant);
  const [row] = await rest<Row[]>(`${TABLE}?id=eq.${id}&select=${COLUMNS}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ importance, urgency, classified_at: new Date().toISOString() }),
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لا مهمة بهذا المعرّف" });
  return withSessions(row);
}

/**
 * الجدولة، مع منع التعارض عند المصدر.
 *
 * الفحص هنا لا في الواجهة وحدها: واجهتان مفتوحتان في لسانين تريان القائمة
 * نفسها وقد تحجزان الوقت ذاته، ولا يمنع ذلك إلا من يكتب. القيد في الجدول
 * يحرس شكل الموعد؛ هذا يحرس ألّا يتداخل موعدان.
 */
export async function scheduleTask(
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
  const clashes = await rest<{ id: string; name: string }[]>(
    `${TABLE}?select=id,name&completed_at=is.null&is_archived=eq.false&${window}&id=neq.${id}`,
  );
  if (clashes.length) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `يوجد تعارض في هذا الوقت مع «${clashes[0].name}»`,
    });
  }

  const [row] = await rest<Row[]>(`${TABLE}?id=eq.${id}&select=${COLUMNS}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      scheduled_start: startIso,
      scheduled_end: endIso,
      // undefined يعني «لا تمسّ»، و null يعني «ألغِ التكرار».
      ...(repeatRule === undefined ? {} : { repeat_rule: repeatRule }),
    }),
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لا مهمة بهذا المعرّف" });
  return withSessions(row);
}

/**
 * الإنجاز — ومعه نسخة الغد إن كانت المهمة متكرّرة.
 *
 * المنجَز يبقى منجَزاً في الأرشيف، والقادم صفٌّ جديد بمعرّفه. والبديل — أن
 * يُعاد فتح الصفّ نفسه — يمحو تاريخه كلّما تكرّر، فتصير مهمةٌ أُنجزت ثلاثين
 * مرّة مهمةً واحدة لم تُنجَز بعد.
 */
export async function completeTask(id: string): Promise<Task> {
  const [row] = await rest<Row[]>(`${TABLE}?id=eq.${id}&select=${COLUMNS}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ completed_at: new Date().toISOString(), is_done: true }),
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "لا مهمة بهذا المعرّف" });

  // بلا موعد لا تكرار: «كل يوم» تحتاج ساعةً تقع فيها.
  if (row.repeat_rule && row.scheduled_start && row.scheduled_end) {
    const when = nextOccurrence(row.scheduled_start, row.scheduled_end, row.repeat_rule);
    await createTask({
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

  return withSessions(row);
}

/** جلسة تركيز تُفتح عند البدء وتُغلق عند الانتهاء — ولو لم تُنجَز المهمة. */
export async function openFocusSession(taskId: string, plannedMinutes: number): Promise<string> {
  const { owner } = credentials();
  const id = crypto.randomUUID();
  await rest<void>(SESSIONS, {
    method: "POST",
    body: JSON.stringify({
      id,
      owner_code: owner,
      task_id: taskId,
      planned_minutes: plannedMinutes,
      started_at: new Date().toISOString(),
    }),
  });
  return id;
}

export async function closeFocusSession(id: string, completed: boolean): Promise<void> {
  await rest<void>(`${SESSIONS}?id=eq.${id}`, {
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
export async function listFocusSessions(sinceIso?: string): Promise<FocusSession[]> {
  const since = sinceIso ? `&started_at=gte.${encodeURIComponent(sinceIso)}` : "";
  const rows = await rest<
    { started_at: string; ended_at: string | null; planned_minutes: number; completed: boolean }[]
  >(`${SESSIONS}?select=started_at,ended_at,planned_minutes,completed${since}&order=started_at.desc`);

  return rows.map(row => ({
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    plannedMinutes: row.planned_minutes,
    completed: row.completed,
  }));
}
