// المصدر الحقيقي: Supabase مباشرة من المتصفّح بجلسة المستخدم، و RLS تحرس كل صف.

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextOccurrence } from "@/lib/tasks";
import { dayOf } from "@/lib/time";
import { checkSchedule, checkTitle, touchesSchedule } from "./shared-rules";
import { ApiError, type AgendaItem, type Api, type Followup, type Meeting, type MeetingFields, type SharedMeeting, type Task, type TaskOrigin } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

function toMeeting(r: Row): Meeting {
  return {
    id: r.id,
    title: r.title,
    day: r.day,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    kind: r.kind,
    status: r.status,
    attendees: r.attendees ?? [],
    goal: r.goal,
    note: r.note,
    link: r.link,
    image: r.image,
    shareToken: r.share_token,
    agenda: [...(r.waf2_agenda_items ?? [])].sort((a: Row, b: Row) => a.position - b.position).map(toAgenda),
    followups: [...(r.waf2_followups ?? [])].sort((a: Row, b: Row) => a.position - b.position).map(toFollowup),
    updatedAt: r.updated_at,
  };
}
const toAgenda = (r: Row): AgendaItem => ({ id: r.id, title: r.title, context: r.context, goal: r.goal, decision: r.decision, owner: r.owner, covered: r.covered });
const toFollowup = (r: Row): Followup => ({ id: r.id, text: r.text, done: r.done });

function meetingRow(f: Partial<MeetingFields>): Row {
  const map: Record<string, string> = { startTime: "start_time", endTime: "end_time" };
  const out: Row = {};
  for (const [k, v] of Object.entries(f)) out[map[k] ?? k] = v;
  return out;
}

function toTask(r: Row): Task {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    origin: r.origin,
    quadrant: r.quadrant,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    estimateMinutes: r.estimate_minutes,
    category: r.category,
    priority: r.priority,
    repeatRule: r.repeat_rule,
    repeatDays: r.repeat_days ?? [],
    sourceMeetingId: r.source_meeting_id,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    focusSessions: r.waf2_focus_sessions?.[0]?.count ?? 0,
  };
}

const TASK_COLS: Record<string, string> = {
  title: "title",
  notes: "notes",
  origin: "origin",
  quadrant: "quadrant",
  startsAt: "starts_at",
  endsAt: "ends_at",
  estimateMinutes: "estimate_minutes",
  category: "category",
  priority: "priority",
  repeatRule: "repeat_rule",
  repeatDays: "repeat_days",
  sourceMeetingId: "source_meeting_id",
};
function taskRow(input: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(input)) if (k in TASK_COLS && v !== undefined) out[TASK_COLS[k]] = v;
  if (typeof out.title === "string") out.title = out.title.trim();
  return out;
}

const MEETING_SELECT = "*, waf2_agenda_items(*), waf2_followups(*)";
const TASK_SELECT = "*, waf2_focus_sessions(count)";

function fail(error: { message: string; code?: string } | null): never | void {
  if (!error) return;
  if (error.code === "PGRST301" || /JWT/i.test(error.message)) throw new ApiError("unauthorized", "انتهت الجلسة. سجّل دخولك من جديد.", "Your session ended. Sign in again.");
  if (/fetch|network/i.test(error.message)) throw new ApiError("network", "تعذّر الاتصال. تحقّق من الشبكة ثم أعد المحاولة.", "Couldn’t connect. Check your network and try again.");
  throw new ApiError("invalid", "تعذّر حفظ التغيير. حاول مرة أخرى.", "Couldn’t save the change. Try again.");
}

export function createSupabaseApi(db: SupabaseClient): Api {
  async function openTasks(origin: TaskOrigin): Promise<Task[]> {
    const { data, error } = await db.from("waf2_tasks").select("*").eq("origin", origin).is("archived_at", null).is("completed_at", null).not("starts_at", "is", null);
    fail(error);
    return (data ?? []).map(toTask);
  }

  async function replaceChildren<T extends { id?: string }>(table: string, meetingId: string, items: T[], toRow: (x: T, i: number) => Row) {
    const keep = items.filter((x) => x.id).map((x) => x.id!);
    let del = db.from(table).delete().eq("meeting_id", meetingId);
    if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
    fail((await del).error);
    if (!items.length) return [];
    const rows = items.map((x, i) => ({ ...(x.id ? { id: x.id } : {}), meeting_id: meetingId, position: i, ...toRow(x, i) }));
    const { data, error } = await db.from(table).upsert(rows).select();
    fail(error);
    return [...(data ?? [])].sort((a, b) => a.position - b.position);
  }

  return {
    meetings: {
      async list() {
        const { data, error } = await db.from("waf2_meetings").select(MEETING_SELECT).is("archived_at", null).order("day", { ascending: true, nullsFirst: false });
        fail(error);
        return (data ?? []).map(toMeeting);
      },
      async create(fields = {}) {
        const { agenda = [], followups = [], ...rest } = fields;
        const { data, error } = await db.from("waf2_meetings").insert(meetingRow(rest)).select("id").single();
        fail(error);
        const mid = data!.id as string;
        if (agenda.length) fail((await db.from("waf2_agenda_items").insert(agenda.map((a, i) => ({ ...a, meeting_id: mid, position: i })))).error);
        if (followups.length) fail((await db.from("waf2_followups").insert(followups.map((f, i) => ({ ...f, meeting_id: mid, position: i })))).error);
        const full = await db.from("waf2_meetings").select(MEETING_SELECT).eq("id", mid).single();
        fail(full.error);
        return toMeeting(full.data!);
      },
      async update(id, patch) {
        const { data, error } = await db.from("waf2_meetings").update(meetingRow(patch)).eq("id", id).select(MEETING_SELECT).single();
        fail(error);
        return toMeeting(data!);
      },
      async saveAgenda(meetingId, items) {
        const rows = await replaceChildren("waf2_agenda_items", meetingId, items, (a) => ({ title: a.title, context: a.context, goal: a.goal, decision: a.decision, owner: a.owner, covered: a.covered }));
        return rows.map(toAgenda);
      },
      async saveFollowups(meetingId, items) {
        const rows = await replaceChildren("waf2_followups", meetingId, items, (f) => ({ text: f.text, done: f.done }));
        return rows.map(toFollowup);
      },
      async remove(id) {
        fail((await db.from("waf2_meetings").update({ archived_at: new Date().toISOString(), share_token: null }).eq("id", id)).error);
      },
      async share(id) {
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const { data, error } = await db.from("waf2_meetings").update({ share_token: token }).eq("id", id).not("day", "is", null).select("id");
        fail(error);
        if (!data?.length) throw new ApiError("invalid", "أضف تاريخ الاجتماع أولاً", "Add the meeting date first");
        return token;
      },
      async unshare(id) {
        fail((await db.from("waf2_meetings").update({ share_token: null }).eq("id", id)).error);
      },
      async shared(token) {
        const { data, error } = await db.rpc("waf2_shared_meeting", { p_token: token });
        fail(error);
        if (data?.error === "expired") throw new ApiError("expired", "انتهت صلاحية هذا الرابط", "This link has expired");
        if (!data?.meeting) throw new ApiError("not_found", "هذا الرابط غير صالح", "This link is not valid");
        const r = data.meeting as Row;
        const m: SharedMeeting = {
          id: r.id,
          title: r.title,
          day: r.day,
          startTime: hhmm(r.start_time),
          endTime: hhmm(r.end_time),
          kind: r.kind,
          status: r.status,
          attendees: r.attendees ?? [],
          goal: r.goal,
          link: r.link,
          image: r.image,
          agenda: (r.agenda ?? []).map(toAgenda),
          followups: (r.followups ?? []).map(toFollowup),
        };
        return m;
      },
    },
    tasks: {
      async list(origin) {
        const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
        const { data, error } = await db
          .from("waf2_tasks")
          .select(TASK_SELECT)
          .eq("origin", origin)
          .is("archived_at", null)
          .eq("waf2_focus_sessions.completed", true)
          .or(`completed_at.is.null,completed_at.gt.${since}`)
          .order("created_at", { ascending: false });
        fail(error);
        return (data ?? []).map(toTask);
      },
      async create(input) {
        checkTitle(input.title);
        if (input.startsAt || input.endsAt) checkSchedule(await openTasks(input.origin), input.origin, input);
        const { data, error } = await db.from("waf2_tasks").insert(taskRow(input)).select("*").single();
        fail(error);
        return toTask(data!);
      },
      async update(id, patch) {
        checkTitle(patch.title);
        if (touchesSchedule(patch) && (patch.startsAt || patch.endsAt)) {
          const { data: cur } = await db.from("waf2_tasks").select("origin").eq("id", id).single();
          const origin = (cur?.origin ?? "blocks") as TaskOrigin;
          checkSchedule(await openTasks(origin), origin, { startsAt: patch.startsAt ?? null, endsAt: patch.endsAt ?? null }, id);
        }
        const { data, error } = await db.from("waf2_tasks").update(taskRow(patch)).eq("id", id).select(TASK_SELECT).eq("waf2_focus_sessions.completed", true).single();
        fail(error);
        return toTask(data!);
      },
      async complete(id) {
        const { data, error } = await db.from("waf2_tasks").update({ completed_at: new Date().toISOString() }).eq("id", id).select("*").single();
        fail(error);
        const task = toTask(data!);
        const slot = nextOccurrence(task);
        let next: Task | null = null;
        if (slot) {
          const { data: n, error: e2 } = await db
            .from("waf2_tasks")
            .insert(taskRow({ ...task, ...slot, sourceMeetingId: task.sourceMeetingId }))
            .select("*")
            .single();
          fail(e2);
          next = toTask(n!);
        }
        return { task, next };
      },
      async reopen(id) {
        const { data, error } = await db.from("waf2_tasks").update({ completed_at: null }).eq("id", id).select("*").single();
        fail(error);
        return toTask(data!);
      },
      async archive(id) {
        fail((await db.from("waf2_tasks").update({ archived_at: new Date().toISOString() }).eq("id", id)).error);
      },
      async restore(id) {
        const { data, error } = await db.from("waf2_tasks").update({ archived_at: null }).eq("id", id).select("*").single();
        fail(error);
        return toTask(data!);
      },
    },
    focus: {
      async start(input) {
        const { data, error } = await db
          .from("waf2_focus_sessions")
          .insert({ task_id: input.taskId, origin: input.origin, mode: input.mode, planned_minutes: input.plannedMinutes })
          .select("id")
          .single();
        fail(error);
        return data!.id as string;
      },
      async end(id, result) {
        fail(
          (
            await db
              .from("waf2_focus_sessions")
              .update({ ended_at: new Date().toISOString(), worked_seconds: Math.max(0, Math.round(result.workedSeconds)), completed: result.completed })
              .eq("id", id)
              .is("ended_at", null)
          ).error,
        );
      },
      async todaySeconds(origin) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const { data, error } = await db.from("waf2_focus_sessions").select("worked_seconds, started_at").eq("origin", origin).gte("started_at", start.toISOString());
        fail(error);
        return (data ?? []).filter((r) => dayOf(new Date(r.started_at)) === dayOf()).reduce((s, r) => s + (r.worked_seconds ?? 0), 0);
      },
    },
  };
}
