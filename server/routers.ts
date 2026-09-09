import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
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
  findNotionMeetingByShareToken,
  getNotionMeetingDate,
  listNotionMeetings,
  setNotionMeetingShare,
  updateNotionMeeting,
} from "./notion";
import { ENV } from "./_core/env";

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

    /**
     * Issue a read-only link for one meeting, or replace the one it has.
     *
     * The token is the whole secret, so it is generated here and never
     * derived from anything guessable about the meeting. Re-sharing mints a
     * fresh one, which is also how a leaked link is retired: the old address
     * stops resolving the moment the new one exists.
     */
    share: appProcedure
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
    unshare: appProcedure
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
});

export type AppRouter = typeof appRouter;
