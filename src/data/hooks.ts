// خطّافات القراءة والكتابة فوق طبقة البيانات (React Query).
// الكتابة على المهام متفائلة: تتغيّر الواجهة فوراً وتعود إن فشل الحفظ.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { api } from "./client";
import { ApiError, type Meeting, type MeetingFields, type Task, type TaskInput, type TaskOrigin, type TaskPatch } from "./types";

export const keys = {
  meetings: ["meetings"] as const,
  tasks: (origin: TaskOrigin) => ["tasks", origin] as const,
  focusToday: (origin: TaskOrigin) => ["focus-today", origin] as const,
};

/** نصّ الخطأ بلغة الواجهة */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return t(e.ar, e.en);
  return t("تعذّر تنفيذ العملية. حاول مرة أخرى.", "That didn’t work. Try again.");
}

export function toastError(e: unknown) {
  toast.error(errorText(e));
}

// ───────── الاجتماعات ─────────

export function useMeetings() {
  return useQuery({ queryKey: keys.meetings, queryFn: () => api.meetings.list() });
}

function useMeetingCache() {
  const qc = useQueryClient();
  return {
    put(m: Meeting) {
      qc.setQueryData<Meeting[]>(keys.meetings, (list = []) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [m, ...list]));
    },
    patch(id: string, fn: (m: Meeting) => Meeting) {
      qc.setQueryData<Meeting[]>(keys.meetings, (list = []) => list.map((x) => (x.id === id ? fn(x) : x)));
    },
    drop(id: string) {
      qc.setQueryData<Meeting[]>(keys.meetings, (list = []) => list.filter((x) => x.id !== id));
    },
    refetch: () => qc.invalidateQueries({ queryKey: keys.meetings }),
  };
}

export function useMeetingActions() {
  const cache = useMeetingCache();
  return {
    create: useMutation({
      mutationFn: (fields: Parameters<typeof api.meetings.create>[0]) => api.meetings.create(fields),
      onSuccess: cache.put,
      onError: toastError,
    }),
    /** يحفظ الاجتماع كاملاً: الحقول ثم البنود ثم المتابعات */
    save: useMutation({
      mutationFn: async (m: Meeting) => {
        const fields: MeetingFields = {
          title: m.title,
          day: m.day,
          startTime: m.startTime,
          endTime: m.endTime,
          kind: m.kind,
          status: m.status,
          attendees: m.attendees,
          goal: m.goal,
          note: m.note,
          link: m.link,
          image: m.image,
        };
        const saved = await api.meetings.update(m.id, fields);
        const agenda = await api.meetings.saveAgenda(m.id, m.agenda.map(stripTempId));
        const followups = await api.meetings.saveFollowups(m.id, m.followups.map(stripTempId));
        return { ...saved, agenda, followups };
      },
      onSuccess: cache.put,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<MeetingFields> }) => api.meetings.update(id, patch),
      onMutate: ({ id, patch }) => cache.patch(id, (m) => ({ ...m, ...patch })),
      onSuccess: cache.put,
      onError: (e) => {
        toastError(e);
        cache.refetch();
      },
    }),
    saveAgenda: useMutation({
      mutationFn: ({ id, agenda }: { id: string; agenda: Meeting["agenda"] }) => api.meetings.saveAgenda(id, agenda.map(stripTempId)),
      onMutate: ({ id, agenda }) => cache.patch(id, (m) => ({ ...m, agenda })),
      onSuccess: (agenda, { id }) => cache.patch(id, (m) => ({ ...m, agenda })),
      onError: (e) => {
        toastError(e);
        cache.refetch();
      },
    }),
    saveFollowups: useMutation({
      mutationFn: ({ id, followups }: { id: string; followups: Meeting["followups"] }) => api.meetings.saveFollowups(id, followups.map(stripTempId)),
      onMutate: ({ id, followups }) => cache.patch(id, (m) => ({ ...m, followups })),
      onSuccess: (followups, { id }) => cache.patch(id, (m) => ({ ...m, followups })),
      onError: (e) => {
        toastError(e);
        cache.refetch();
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.meetings.remove(id),
      onSuccess: (_r, id) => cache.drop(id),
      onError: toastError,
    }),
    share: useMutation({
      mutationFn: (id: string) => api.meetings.share(id),
      onSuccess: (token, id) => cache.patch(id, (m) => ({ ...m, shareToken: token })),
      onError: toastError,
    }),
    unshare: useMutation({
      mutationFn: (id: string) => api.meetings.unshare(id),
      onSuccess: (_r, id) => cache.patch(id, (m) => ({ ...m, shareToken: null })),
      onError: toastError,
    }),
  };
}

/** معرّف مؤقّت يبدأ بـ "tmp-" لبند لم يُحفظ بعد */
export const tempId = () => `tmp-${crypto.randomUUID()}`;
function stripTempId<T extends { id: string }>(x: T): Omit<T, "id"> & { id?: string } {
  if (x.id.startsWith("tmp-")) {
    const { id: _id, ...rest } = x;
    return rest;
  }
  return x;
}

export function useSharedMeeting(token: string) {
  return useQuery({ queryKey: ["shared", token], queryFn: () => api.meetings.shared(token), retry: false });
}

// ───────── المهام ─────────

export function useTasks(origin: TaskOrigin) {
  return useQuery({ queryKey: keys.tasks(origin), queryFn: () => api.tasks.list(origin) });
}

export function useTaskActions(origin: TaskOrigin) {
  const qc = useQueryClient();
  const key = keys.tasks(origin);
  const set = (fn: (list: Task[]) => Task[]) => qc.setQueryData<Task[]>(key, (list = []) => fn(list));
  const snapshot = () => qc.getQueryData<Task[]>(key);
  const rollback = (prev: Task[] | undefined) => qc.setQueryData(key, prev);

  const optimistic = <V,>(apply: (v: V) => (list: Task[]) => Task[]) => ({
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = snapshot();
      set(apply(v));
      return { prev };
    },
    onError: (e: unknown, _v: V, ctx?: { prev: Task[] | undefined }) => {
      rollback(ctx?.prev);
      toastError(e);
    },
  });

  return {
    create: useMutation({
      mutationFn: (input: Omit<TaskInput, "origin">) => api.tasks.create({ ...input, origin }),
      onSuccess: (task) => set((l) => [task, ...l]),
      onError: toastError,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => api.tasks.update(id, patch),
      ...optimistic(({ id, patch }: { id: string; patch: TaskPatch }) => (l) => l.map((x) => (x.id === id ? { ...x, ...patch, title: patch.title?.trim() || x.title } : x))),
      onSuccess: (task) => set((l) => l.map((x) => (x.id === task.id ? task : x))),
    }),
    complete: useMutation({
      mutationFn: (id: string) => api.tasks.complete(id),
      ...optimistic((id: string) => (l) => l.map((x) => (x.id === id ? { ...x, completedAt: new Date().toISOString() } : x))),
      onSuccess: ({ task, next }) => set((l) => [...(next ? [next] : []), ...l.map((x) => (x.id === task.id ? task : x))]),
    }),
    reopen: useMutation({
      mutationFn: (id: string) => api.tasks.reopen(id),
      ...optimistic((id: string) => (l) => l.map((x) => (x.id === id ? { ...x, completedAt: null } : x))),
      onSuccess: (task) => set((l) => l.map((x) => (x.id === task.id ? task : x))),
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.tasks.archive(id),
      ...optimistic((id: string) => (l) => l.filter((x) => x.id !== id)),
    }),
    restore: useMutation({
      mutationFn: (id: string) => api.tasks.restore(id),
      onSuccess: (task) => set((l) => [task, ...l.filter((x) => x.id !== task.id)]),
      onError: toastError,
    }),
  };
}

export function useFocusToday(origin: TaskOrigin) {
  return useQuery({ queryKey: keys.focusToday(origin), queryFn: () => api.focus.todaySeconds(origin) });
}
