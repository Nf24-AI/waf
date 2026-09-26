import { authedProcedure } from "./auth";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createNotionMeeting,
  deleteNotionMeeting,
  getNotionDatabaseInfo,
  isNotionConfigured,
  listNotionMeetings,
  updateNotionMeeting,
} from "./notion";
import { ENV } from "./_core/env";
import {
  classifyTask,
  closeFocusSession,
  completeTask,
  createTask,
  listCompletedTasks,
  listFocusSessions,
  listOpenTasks,
  openFocusSession,
  scheduleTask,
  tasksAreConfigured,
} from "./tasks";
import { QUADRANTS } from "@shared/tasks";

const quadrantId = z.enum(QUADRANTS.map(q => q.id) as [string, ...string[]]);

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
    /** Lets the workspace explain *why* Notion is unavailable instead of failing blankly. */
    status: authedProcedure.query(async () => {
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

    list: authedProcedure.query(async () => ({
      source: "notion" as const,
      meetings: await listNotionMeetings(),
    })),

    create: authedProcedure.input(meetingInput).mutation(({ input }) => createNotionMeeting(input)),

    update: authedProcedure.input(meetingWithId).mutation(async ({ input }) => {
      await updateNotionMeeting(input);
      return { success: true as const };
    }),

    remove: authedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await deleteNotionMeeting(input.id);
      return { success: true as const };
    }),
  }),

  /**
   * المهام — مصدر واحد تقرأ منه الطرق الثلاث وتكتب فيه.
   *
   * كلها authedProcedure: المهام خلف بوّابة كلمة المرور مثل الاجتماعات، ومفتاح
   * Supabase ورمز المالك لا يغادران الخادم.
   */
  tasks: router({
    /**
     * `status` وحده عامّ: الصفحات تسأله قبل أن تعرف إن كان هناك مستخدم،
     * وجوابه إعداد الخادم لا بيانات أحد.
     */
    status: publicProcedure.query(() => ({ configured: tasksAreConfigured() })),

    listOpen: authedProcedure.query(({ ctx }) => listOpenTasks(ctx.identity)),

    sessions: authedProcedure
      .input(z.object({ since: z.string().optional() }).optional())
      .query(({ ctx, input }) => listFocusSessions(ctx.identity, input?.since)),

    listCompleted: authedProcedure
      .input(z.object({ since: z.string().optional() }).optional())
      .query(({ ctx, input }) => listCompletedTasks(ctx.identity, input?.since)),

    create: authedProcedure
      .input(
        z.object({
          title: z.string().trim().min(1, "المهمة تحتاج عنواناً"),
          description: z.string().trim().optional(),
          quadrant: quadrantId.optional(),
          scheduledStart: z.string().datetime().optional(),
          scheduledEnd: z.string().datetime().optional(),
          estimatedMinutes: z.number().int().positive().optional(),
          repeatRule: z.enum(["daily", "weekly"]).optional(),
          reminderMinutes: z.number().int().min(0).max(1440).optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        createTask(ctx.identity, input as Parameters<typeof createTask>[1]),
      ),

    classify: authedProcedure
      .input(z.object({ id: z.string().uuid(), quadrant: quadrantId }))
      .mutation(({ ctx, input }) =>
        classifyTask(ctx.identity, input.id, input.quadrant as Parameters<typeof classifyTask>[2]),
      ),

    schedule: authedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          start: z.string().datetime(),
          end: z.string().datetime(),
          repeatRule: z.enum(["daily", "weekly"]).nullable().optional(),
        }),
      )
      .mutation(({ ctx, input }) =>
        scheduleTask(ctx.identity, input.id, input.start, input.end, input.repeatRule),
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
