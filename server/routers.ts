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

const agendaItem = z.object({
  title: z.string(),
  context: z.string(),
  goal: z.string(),
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

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(ACCESS_COOKIE, { ...sessionCookieOptions(ENV.isProduction), maxAge: -1 });
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
});

export type AppRouter = typeof appRouter;
