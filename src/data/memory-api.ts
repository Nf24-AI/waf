// مصدر بيانات تجريبي في الذاكرة، يُحفظ في المتصفّح. يُستعمل حين لا يكون Supabase
// مضبوطاً أو في وضع التجربة، ويطبّق القواعد نفسها التي يطبّقها المصدر الحقيقي.

import { nextOccurrence } from "@/lib/tasks";
import { shareExpired, toShared } from "@/lib/meetings";
import { dayOf } from "@/lib/time";
import { checkSchedule, checkTitle, touchesSchedule } from "./shared-rules";
import { seed } from "./seed";
import { ApiError, type Api, type Meeting, type Task, type TaskOrigin } from "./types";

interface Store {
  meetings: (Meeting & { archived?: boolean })[];
  tasks: (Task & { archived?: boolean })[];
  sessions: { id: string; origin: TaskOrigin; taskId: string | null; startedAt: string; workedSeconds: number; completed: boolean; ended: boolean }[];
}

const KEY = "waf2:demo";

export function createMemoryApi(opts: { persist?: boolean; initial?: Store } = {}): Api & { reset(): void } {
  const persist = opts.persist ?? true;
  let store: Store = opts.initial ?? load() ?? seed();

  function load(): Store | null {
    if (!persist) return null;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Store) : null;
    } catch {
      return null;
    }
  }
  function save() {
    if (!persist) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* التخزين غير متاح: نكمل في الذاكرة */
    }
  }
  const id = () => crypto.randomUUID();
  const clone = <T,>(v: T): T => structuredClone(v);
  // تأخير بسيط يشبه الشبكة حتى تظهر حالات التحميل في التجربة
  const wait = () => new Promise((r) => setTimeout(r, persist ? 120 : 0));

  function meeting(mid: string) {
    const m = store.meetings.find((x) => x.id === mid && !x.archived);
    if (!m) throw new ApiError("not_found", "الاجتماع غير موجود", "Meeting not found");
    return m;
  }
  function task(tid: string) {
    const t = store.tasks.find((x) => x.id === tid);
    if (!t) throw new ApiError("not_found", "المهمة غير موجودة", "Task not found");
    return t;
  }
  const strip = ({ archived: _a, ...t }: Task & { archived?: boolean }): Task => clone(t);
  const stripM = ({ archived: _a, ...m }: Meeting & { archived?: boolean }): Meeting => clone(m);

  return {
    reset() {
      store = seed();
      save();
    },
    meetings: {
      async list() {
        await wait();
        return store.meetings.filter((m) => !m.archived).map(stripM);
      },
      async create(fields = {}) {
        await wait();
        const { agenda = [], followups = [], ...rest } = fields;
        const m: Meeting = {
          id: id(),
          title: "",
          day: null,
          startTime: null,
          endTime: null,
          kind: "other",
          status: "draft",
          attendees: [],
          goal: "",
          note: "",
          link: "",
          image: "",
          ...rest,
          shareToken: null,
          agenda: agenda.map((a) => ({ ...a, id: id() })),
          followups: followups.map((f) => ({ ...f, id: id() })),
          updatedAt: new Date().toISOString(),
        };
        store.meetings.unshift(m);
        save();
        return clone(m);
      },
      async update(mid, patch) {
        await wait();
        const m = meeting(mid);
        Object.assign(m, patch, { updatedAt: new Date().toISOString() });
        save();
        return stripM(m);
      },
      async saveAgenda(mid, items) {
        await wait();
        const m = meeting(mid);
        m.agenda = items.map((a) => ({ ...a, id: a.id ?? id() }));
        m.updatedAt = new Date().toISOString();
        save();
        return clone(m.agenda);
      },
      async saveFollowups(mid, items) {
        await wait();
        const m = meeting(mid);
        m.followups = items.map((f) => ({ ...f, id: f.id ?? id() }));
        m.updatedAt = new Date().toISOString();
        save();
        return clone(m.followups);
      },
      async remove(mid) {
        await wait();
        meeting(mid).archived = true;
        save();
      },
      async share(mid) {
        await wait();
        const m = meeting(mid);
        if (!m.day) throw new ApiError("invalid", "أضف تاريخ الاجتماع أولاً", "Add the meeting date first");
        m.shareToken = (id() + id()).replace(/-/g, "").slice(0, 32);
        save();
        return m.shareToken;
      },
      async unshare(mid) {
        await wait();
        meeting(mid).shareToken = null;
        save();
      },
      async shared(token) {
        await wait();
        const m = store.meetings.find((x) => x.shareToken === token && !x.archived);
        if (!m) throw new ApiError("not_found", "هذا الرابط غير صالح", "This link is not valid");
        if (shareExpired(m.day)) throw new ApiError("expired", "انتهت صلاحية هذا الرابط", "This link has expired");
        return toShared(stripM(m));
      },
    },
    tasks: {
      async list(origin) {
        await wait();
        const cutoff = Date.now() - 14 * 86_400_000;
        return store.tasks
          .filter((t) => t.origin === origin && !t.archived && (!t.completedAt || Date.parse(t.completedAt) > cutoff))
          .map(strip);
      },
      async create(input) {
        await wait();
        checkTitle(input.title);
        checkSchedule(store.tasks.filter((t) => !t.archived), input.origin, input);
        const t: Task = {
          id: id(),
          title: input.title.trim(),
          notes: input.notes ?? "",
          origin: input.origin,
          quadrant: input.quadrant ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          estimateMinutes: input.estimateMinutes ?? null,
          category: input.category ?? "deep",
          priority: input.priority ?? "medium",
          repeatRule: input.repeatRule ?? null,
          repeatDays: input.repeatDays ?? [],
          sourceMeetingId: input.sourceMeetingId ?? null,
          completedAt: null,
          createdAt: new Date().toISOString(),
          focusSessions: 0,
        };
        store.tasks.unshift(t);
        save();
        return clone(t);
      },
      async update(tid, patch) {
        await wait();
        const t = task(tid);
        checkTitle(patch.title);
        if (touchesSchedule(patch)) {
          const next = { startsAt: patch.startsAt ?? null, endsAt: patch.endsAt ?? null };
          checkSchedule(store.tasks.filter((x) => !x.archived), t.origin, next, t.id);
        }
        Object.assign(t, patch, patch.title ? { title: patch.title.trim() } : {});
        save();
        return strip(t);
      },
      async complete(tid) {
        await wait();
        const t = task(tid);
        t.completedAt = new Date().toISOString();
        let next: Task | null = null;
        const slot = nextOccurrence(t);
        if (slot) {
          next = { ...strip(t), id: id(), ...slot, completedAt: null, createdAt: new Date().toISOString(), focusSessions: 0 };
          store.tasks.unshift(next);
        }
        save();
        return { task: strip(t), next: next && clone(next) };
      },
      async reopen(tid) {
        await wait();
        const t = task(tid);
        t.completedAt = null;
        save();
        return strip(t);
      },
      async archive(tid) {
        await wait();
        task(tid).archived = true;
        save();
      },
      async restore(tid) {
        await wait();
        const t = task(tid);
        t.archived = false;
        save();
        return strip(t);
      },
    },
    focus: {
      async start(input) {
        await wait();
        const sid = id();
        store.sessions.push({ id: sid, origin: input.origin, taskId: input.taskId, startedAt: new Date().toISOString(), workedSeconds: 0, completed: false, ended: false });
        save();
        return sid;
      },
      async end(sid, result) {
        await wait();
        const s = store.sessions.find((x) => x.id === sid);
        if (!s || s.ended) return;
        Object.assign(s, result, { ended: true });
        if (result.completed && s.taskId) {
          const t = store.tasks.find((x) => x.id === s.taskId);
          if (t) t.focusSessions += 1;
        }
        save();
      },
      async todaySeconds(origin) {
        await wait();
        const today = dayOf();
        return store.sessions
          .filter((s) => s.origin === origin && dayOf(new Date(s.startedAt)) === today)
          .reduce((sum, s) => sum + s.workedSeconds, 0);
      },
    },
  };
}
