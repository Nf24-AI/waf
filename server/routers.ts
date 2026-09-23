import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  ACCESS_COOKIE,
  accessIsOpen,
  appProcedure,
  createSessionToken,
  hasValidSession,
  passwordMatches,
  sessionCookieOptions,
} from "./access";
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

  auth: router({
    /** Reports lock state rather than a Manus identity. */
    me: publicProcedure.query(async ({ ctx }) => ({
      locked: !accessIsOpen(),
      unlocked: await hasValidSession(ctx.req.headers.cookie),
    })),

    unlock: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!passwordMatches(input.password)) {
          return { success: false as const };
        }
        const token = await createSessionToken();
        ctx.res.cookie(ACCESS_COOKIE, token, sessionCookieOptions(ENV.isProduction));
        return { success: true as const };
      }),

    /**
     * Slide the idle window forward without asking for anything.
     *
     * The server counts a session idle when no request arrives; the browser
     * counts it idle when nobody touches the page. Those disagree while
     * someone types a long note, because saving is a button and not an
     * autosave — the page is busy and the server hears nothing. Ten minutes
     * in, Save would fail as UNAUTHORIZED with the note still unsaved.
     *
     * appProcedure re-issues the cookie, so the call needs no body of its own.
     */
    touch: appProcedure.mutation(() => ({ ok: true }) as const),

    logout: publicProcedure.mutation(({ ctx }) => {
      // No maxAge: clearCookie already expires the cookie immediately, and
      // passing it makes Express 4 log a deprecation on every logout — which
      // the idle lock now triggers on its own, so the noise adds up.
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.clearCookie(ACCESS_COOKIE, sessionCookieOptions(ENV.isProduction));
      return { success: true } as const;
    }),
  }),

  meetings: router({
    /** Lets the workspace explain *why* Notion is unavailable instead of failing blankly. */
    status: appProcedure.query(async () => {
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

    list: appProcedure.query(async () => ({
      source: "notion" as const,
      meetings: await listNotionMeetings(),
    })),

    create: appProcedure.input(meetingInput).mutation(({ input }) => createNotionMeeting(input)),

    update: appProcedure.input(meetingWithId).mutation(async ({ input }) => {
      await updateNotionMeeting(input);
      return { success: true as const };
    }),

    remove: appProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await deleteNotionMeeting(input.id);
      return { success: true as const };
    }),
  }),

  /**
   * المهام — مصدر واحد تقرأ منه الطرق الثلاث وتكتب فيه.
   *
   * كلها appProcedure: المهام خلف بوّابة كلمة المرور مثل الاجتماعات، ومفتاح
   * Supabase ورمز المالك لا يغادران الخادم.
   */
  tasks: router({
    status: appProcedure.query(() => ({ configured: tasksAreConfigured() })),

    listOpen: appProcedure.query(() => listOpenTasks()),

    sessions: appProcedure
      .input(z.object({ since: z.string().optional() }).optional())
      .query(({ input }) => listFocusSessions(input?.since)),

    listCompleted: appProcedure
      .input(z.object({ since: z.string().optional() }).optional())
      .query(({ input }) => listCompletedTasks(input?.since)),

    create: appProcedure
      .input(
        z.object({
          title: z.string().trim().min(1, "المهمة تحتاج عنواناً"),
          description: z.string().trim().optional(),
          quadrant: quadrantId.optional(),
          scheduledStart: z.string().datetime().optional(),
          scheduledEnd: z.string().datetime().optional(),
          estimatedMinutes: z.number().int().positive().optional(),
          repeatRule: z.enum(["daily", "weekly"]).optional(),
        }),
      )
      .mutation(({ input }) => createTask(input as Parameters<typeof createTask>[0])),

    classify: appProcedure
      .input(z.object({ id: z.string().uuid(), quadrant: quadrantId }))
      .mutation(({ input }) => classifyTask(input.id, input.quadrant as Parameters<typeof classifyTask>[1])),

    schedule: appProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          start: z.string().datetime(),
          end: z.string().datetime(),
          repeatRule: z.enum(["daily", "weekly"]).nullable().optional(),
        }),
      )
      .mutation(({ input }) => scheduleTask(input.id, input.start, input.end, input.repeatRule)),

    complete: appProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => completeTask(input.id)),

    startFocus: appProcedure
      .input(z.object({ taskId: z.string().uuid(), minutes: z.number().int().positive().max(240) }))
      .mutation(async ({ input }) => ({ sessionId: await openFocusSession(input.taskId, input.minutes) })),

    endFocus: appProcedure
      .input(z.object({ sessionId: z.string().uuid(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        await closeFocusSession(input.sessionId, input.completed);
        return { success: true as const };
      }),
  }),
});

export type AppRouter = typeof appRouter;
