import { authedProcedure } from "./auth";
import { workspaceAccess, workspaceProcedure } from "./workspace";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import {
  canShare,
  isShareExpired,
  shareExpiresOn,
  toSharedMeeting,
} from "@shared/meeting-share";
import {
  createNotionMeeting,
  deleteNotionMeeting,
  getNotionDatabaseInfo,
  isNotionConfigured,
  findNotionMeetingByShareToken,
  getNotionMeetingDate,
  listNotionMeetings,
  setNotionMeetingShare,
  updateNotionMeeting,
} from "./notion";
import { ENV } from "./_core/env";
import {
  classifyTask,
  closeFocusSession,
  completeTask,
  createTask,
  listOpenTasks,
  openFocusSession,
  reopenTask,
  setTaskArchived,
  tasksAreConfigured,
  updateTask,
} from "./tasks";
import { DAY_PATTERN, QUADRANTS, REPEAT_RULES, TASK_CATEGORIES, TASK_ORIGINS, TASK_PRIORITIES } from "@shared/tasks";

const quadrantId = z.enum(QUADRANTS.map(q => q.id) as [string, ...string[]]);
const repeatRule = z.enum(REPEAT_RULES);
const repeatDays = z.array(z.number().int().min(0).max(6)).max(7);
const taskCategory = z.enum(TASK_CATEGORIES.map(c => c.id) as [string, ...string[]]);
const taskPriority = z.enum(TASK_PRIORITIES);
const taskOrigin = z.enum(TASK_ORIGINS);
const dayString = z.string().regex(DAY_PATTERN, "تاريخ غير صالح");

const agendaItem = z.object({
  title: z.string(),
  context: z.string(),
  goal: z.string(),
  // Captured during the meeting; older clients may omit them.
  decision: z.string().default(""),
  owner: z.string().default(""),
});

const meetingFields = {
  title: z.string(),
  date: z.string(),
  time: z.string(),
  type: z.string(),
  status: z.enum(["مسودة", "جاهز للعرض", "تم الاجتماع"]),
  attendees: z.array(z.string()),
  summary: z.string(),
  agenda: z.array(agendaItem),
  actions: z.array(z.string()),
  note: z.string(),
  link: z.string(),
  image: z.string().default(""),
};

/** 32 chars of nanoid's 64-symbol alphabet — about 190 bits. */
const SHARE_TOKEN_LENGTH = 32;

const meetingInput = z.object(meetingFields);
const meetingWithId = z.object({ id: z.string(), ...meetingFields });

export const appRouter = router({
  system: systemRouter,

  /**
   * بقايا البوّابة القديمة ذهبت مع البوّابة.
   *
   * `unlock` كان يصدر كعكة جلسة لمن يعرف كلمة المرور المشتركة. تركُه بعد
   * حلول المصادقة الحقيقية يعني باباً ثانياً إلى نفس التطبيق، يُصدر هويّة
   * لا تخصّ أحداً بعينه — ولا يُغلق بتسجيل الخروج من Supabase لأنه لا
   * يعرف به. وباب لا أحد يتذكّره هو الباب الذي يبقى مفتوحاً.
   *
   * والخروج الآن عند Supabase: `signOut` في المتصفّح يُنهي الجلسة في كل
   * الألسنة، ولا كعكة من عندنا تُمحى.
   */
  meetings: router({
    /**
     * هل يملك هذا الحساب مساحة الاجتماعات؟
     *
     * سؤالٌ يُطرح قبل العرض: الشريط يُخفي البند لمن لا يملكها، والصفحة تشرح
     * بدل أن تسقط بخطأ. ولا يكشف شيئاً — جوابه نعم أو لا عن السائل نفسه.
     */
    access: workspaceAccess,

    /** Lets the workspace explain *why* Notion is unavailable instead of failing blankly. */
    status: workspaceProcedure.query(async () => {
      if (!isNotionConfigured()) {
        const missing = [
          !ENV.notionApiToken && "NOTION_API_TOKEN",
          !ENV.notionDatabaseId && "NOTION_DATABASE_ID",
        ].filter(Boolean);
        return { configured: false as const, reachable: false as const, error: `Not configured. Missing: ${missing.join(", ")}.` };
      }
      try {
        const info = await getNotionDatabaseInfo();
        const missing = (["title", "date", "type", "attendees", "status", "summary", "link"] as const)
          .filter((field) => !info.schema[field]);
        return { configured: true as const, reachable: true as const, title: info.title, missing };
      } catch (error) {
        return { configured: true as const, reachable: false as const, error: error instanceof Error ? error.message : String(error) };
      }
    }),

    list: workspaceProcedure.query(async () => ({
      source: "notion" as const,
      meetings: await listNotionMeetings(),
    })),

    create: workspaceProcedure.input(meetingInput).mutation(({ input }) => createNotionMeeting(input)),

    update: workspaceProcedure.input(meetingWithId).mutation(async ({ input }) => {
      await updateNotionMeeting(input);
      return { success: true as const };
    }),

    remove: workspaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await deleteNotionMeeting(input.id);
      return { success: true as const };
    }),

    /**
     * Issue a read-only link for one meeting, or replace the one it has.
     *
     * The token is the whole secret, so it is generated here and never
     * derived from anything guessable about the meeting. Re-sharing mints a
     * fresh one, which is also how a leaked link is retired: the old address
     * stops resolving the moment the new one exists.
     */
    share: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        // Only the date is needed, and only to derive the expiry — so this
        // reads the one page rather than walking the whole database.
        const date = await getNotionMeetingDate(input.id);

        // A meeting without a date has no window to offer. Refused here
        // rather than issued dead.
        if (!date || !canShare({ date })) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "أضف تاريخ الاجتماع أولًا — صلاحية الرابط تُحسب منه.",
          });
        }

        const token = nanoid(SHARE_TOKEN_LENGTH);
        await setNotionMeetingShare(input.id, token);
        return { token, expiresOn: shareExpiresOn(date) };
      }),

    /** Retire the link. The address stops resolving immediately. */
    unshare: workspaceProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await setNotionMeetingShare(input.id, "");
        return { success: true as const };
      }),

    /**
     * Read one shared meeting. The only procedure outside the password gate.
     *
     * publicProcedure by design: the token is the credential, and it names
     * exactly one meeting — there is no list here and no id to substitute, so
     * holding one link is not a way to reach a second meeting.
     *
     * What comes back is rebuilt by toSharedMeeting, which drops the private
     * preparation notes and the token itself.
     */
    shared: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const meeting = await findNotionMeetingByShareToken(input.token);
        if (!meeting) {
          throw new TRPCError({ code: "NOT_FOUND", message: "هذا الرابط غير صالح." });
        }

        // Separated from NOT_FOUND so the page can say which it is. With a
        // 190-bit token, confirming one existed tells an attacker nothing.
        if (isShareExpired(meeting.date)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "انتهت صلاحية هذا الرابط.",
          });
        }

        return { meeting: toSharedMeeting(meeting) };
      }),
  }),

  tasks: router({
    /**
     * `status` وحده عامّ: الصفحات تسأله قبل أن تعرف إن كان هناك مستخدم،
     * وجوابه إعداد الخادم لا بيانات أحد.
     */
    status: publicProcedure.query(() => ({ configured: tasksAreConfigured() })),

    // كل إطار يسأل عن مهامه وحدها؛ انظر TASK_ORIGINS.
    listOpen: authedProcedure
      .input(z.object({ origin: taskOrigin }))
      .query(({ ctx, input }) => listOpenTasks(ctx.identity, input.origin)),

    create: authedProcedure
      .input(
        z.object({
          title: z.string().trim().min(1, "المهمة تحتاج عنواناً"),
          description: z.string().trim().optional(),
          quadrant: quadrantId.optional(),
          scheduledStart: z.string().datetime().optional(),
          scheduledEnd: z.string().datetime().optional(),
          estimatedMinutes: z.number().int().positive().optional(),
          repeatRule: repeatRule.optional(),
          repeatDays: repeatDays.optional(),
          reminderMinutes: z.number().int().min(0).max(1440).optional(),
          projectId: z.string().uuid().optional(),
          category: taskCategory.optional(),
          priority: taskPriority.optional(),
          dueDate: dayString.optional(),
          origin: taskOrigin,
        }),
      )
      .mutation(({ ctx, input }) =>
        createTask(ctx.identity, input as Parameters<typeof createTask>[1], true),
      ),

    update: authedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          title: z.string().trim().min(1, "المهمة تحتاج عنواناً").optional(),
          description: z.string().trim().nullable().optional(),
          estimatedMinutes: z.number().int().positive().nullable().optional(),
          category: taskCategory.nullable().optional(),
          priority: taskPriority.nullable().optional(),
          dueDate: dayString.nullable().optional(),
          repeatRule: repeatRule.nullable().optional(),
          repeatDays: repeatDays.nullable().optional(),
          schedule: z
            .object({ start: z.string().datetime(), end: z.string().datetime() })
            .nullable()
            .optional(),
        }),
      )
      .mutation(({ ctx, input: { id, ...patch } }) =>
        updateTask(ctx.identity, id, patch as Parameters<typeof updateTask>[2]),
      ),

    archive: authedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => setTaskArchived(ctx.identity, input.id, true)),

    restore: authedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => setTaskArchived(ctx.identity, input.id, false)),

    reopen: authedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => reopenTask(ctx.identity, input.id)),

    classify: authedProcedure
      .input(z.object({ id: z.string().uuid(), quadrant: quadrantId }))
      .mutation(({ ctx, input }) =>
        classifyTask(ctx.identity, input.id, input.quadrant as Parameters<typeof classifyTask>[2]),
      ),

    complete: authedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => completeTask(ctx.identity, input.id)),

    startFocus: authedProcedure
      .input(z.object({ taskId: z.string().uuid(), minutes: z.number().int().positive().max(240) }))
      .mutation(async ({ ctx, input }) => ({
        sessionId: await openFocusSession(ctx.identity, input.taskId, input.minutes),
      })),

    endFocus: authedProcedure
      .input(z.object({ sessionId: z.string().uuid(), completed: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await closeFocusSession(ctx.identity, input.sessionId, input.completed);
        return { success: true as const };
      }),
  }),});

export type AppRouter = typeof appRouter;
