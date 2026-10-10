// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/auth.ts
import { TRPCError } from "@trpc/server";

// server/_core/trpc.ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;

// server/auth.ts
function bearerToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}
function userIdFromToken(token) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json);
    if (!claims.sub) return null;
    if (claims.exp && claims.exp * 1e3 < Date.now()) return null;
    return claims.sub;
  } catch {
    return null;
  }
}
function identityOf(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const userId = userIdFromToken(token);
  return userId ? { userId, token } : null;
}
var authedProcedure = publicProcedure.use(({ ctx, next }) => {
  const identity = identityOf(ctx.req);
  if (!identity) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "\u064A\u0644\u0632\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
  return next({ ctx: { ...ctx, identity } });
});

// server/workspace.ts
import { TRPCError as TRPCError2 } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  isProduction: process.env.NODE_ENV === "production",
  notionApiToken: process.env.NOTION_API_TOKEN ?? "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID ?? "",
  // Supabase: الحسابات والمهام. الخادم يخاطبه برمز المستخدم نفسه، فسياسات
  // الصفوف (RLS) هي التي تحدّد ما يراه كل حساب — لا مفتاح خدمة هنا.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? ""
};

// server/workspace.ts
async function ownsWorkspace(who) {
  const url = ENV.supabaseUrl.replace(/\/$/, "");
  if (!url || !ENV.supabaseAnonKey) return false;
  const response = await fetch(
    `${url}/rest/v1/profiles?id=eq.${who.userId}&select=can_access_meetings`,
    {
      headers: {
        apikey: ENV.supabaseAnonKey,
        // برمز المستخدم: RLS تسمح له بقراءة ملفّه وحده، فلا يُقرأ ملفّ غيره.
        Authorization: `Bearer ${who.token}`
      }
    }
  );
  if (!response.ok) {
    console.error("[workspace] profile read failed", response.status);
    return false;
  }
  const rows = await response.json();
  return rows[0]?.can_access_meetings === true;
}
var workspaceAccess = authedProcedure.query(({ ctx }) => ownsWorkspace(ctx.identity).then((owner) => ({ owner })));
var workspaceProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (!await ownsWorkspace(ctx.identity)) {
    throw new TRPCError2({
      code: "FORBIDDEN",
      message: "\u062E\u062F\u0645\u0629 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0645\u0633\u0627\u062D\u0629 \u0639\u0645\u0644 \u0648\u0627\u062D\u062F\u0629\u060C \u0648\u062D\u0633\u0627\u0628\u0643 \u0644\u064A\u0633 \u0645\u0627\u0644\u0643\u0647\u0627 \u0628\u0639\u062F."
    });
  }
  return next({ ctx });
});

// server/_core/systemRouter.ts
import { z } from "zod";
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers.ts
import { z as z2 } from "zod";
import { nanoid } from "nanoid";
import { TRPCError as TRPCError4 } from "@trpc/server";

// shared/meeting-date.ts
var ARABIC_MONTHS = [
  "\u064A\u0646\u0627\u064A\u0631",
  "\u0641\u0628\u0631\u0627\u064A\u0631",
  "\u0645\u0627\u0631\u0633",
  "\u0623\u0628\u0631\u064A\u0644",
  "\u0645\u0627\u064A\u0648",
  "\u064A\u0648\u0646\u064A\u0648",
  "\u064A\u0648\u0644\u064A\u0648",
  "\u0623\u063A\u0633\u0637\u0633",
  "\u0633\u0628\u062A\u0645\u0628\u0631",
  "\u0623\u0643\u062A\u0648\u0628\u0631",
  "\u0646\u0648\u0641\u0645\u0628\u0631",
  "\u062F\u064A\u0633\u0645\u0628\u0631"
];
var ARABIC_WEEKDAYS = [
  "\u0627\u0644\u0623\u062D\u062F",
  "\u0627\u0644\u0627\u062B\u0646\u064A\u0646",
  "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621",
  "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621",
  "\u0627\u0644\u062E\u0645\u064A\u0633",
  "\u0627\u0644\u062C\u0645\u0639\u0629",
  "\u0627\u0644\u0633\u0628\u062A"
];
var ENGLISH_MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
];
var ENGLISH_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
var ARABIC_INDIC = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
function toWesternDigits(value) {
  return value.replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)));
}
function toArabicDigits(value) {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_INDIC[Number(digit)]);
}
function monthIndex(token) {
  const arabic = ARABIC_MONTHS.indexOf(token);
  if (arabic !== -1) return arabic;
  const english = ENGLISH_MONTHS.indexOf(token.toLowerCase());
  if (english !== -1) return english;
  return -1;
}
function toIsoDate(display) {
  const value = toWesternDigits((display ?? "").trim());
  if (!value) return null;
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parts = value.replace(/[،,]/g, " ").split(/\s+/).filter(Boolean);
  let day = -1;
  let month = -1;
  let year = -1;
  for (const part of parts) {
    const asMonth = monthIndex(part);
    if (asMonth !== -1 && month === -1) {
      month = asMonth;
      continue;
    }
    if (!/^\d+$/.test(part)) continue;
    const numeric = Number(part);
    if (numeric >= 1e3 && year === -1) year = numeric;
    else if (numeric >= 1 && numeric <= 31 && day === -1) day = numeric;
  }
  if (day === -1 || month === -1 || year === -1) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function fromIsoDate(iso, language = "ar") {
  const match = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso ?? "";
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11) return iso;
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  if (language === "en") {
    return `${ENGLISH_WEEKDAYS[weekday]}, ${day} ${ENGLISH_MONTHS[month].replace(/^./, (c) => c.toUpperCase())} ${year}`;
  }
  return `${ARABIC_WEEKDAYS[weekday]}\u060C ${toArabicDigits(day)} ${ARABIC_MONTHS[month]} ${toArabicDigits(year)}`;
}

// shared/meeting-share.ts
var SHARE_GRACE_DAYS = 1;
var SHARE_TIME_ZONE = "Asia/Riyadh";
var isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHARE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
function shareToday(now = /* @__PURE__ */ new Date()) {
  return isoDay.format(now);
}
function shareExpiresOn(meetingDate) {
  const iso = toIsoDate(meetingDate);
  if (!iso) return null;
  const day = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;
  day.setUTCDate(day.getUTCDate() + SHARE_GRACE_DAYS);
  return day.toISOString().slice(0, 10);
}
function isShareExpired(meetingDate, now = /* @__PURE__ */ new Date()) {
  const last = shareExpiresOn(meetingDate);
  if (!last) return true;
  return shareToday(now) > last;
}
function canShare(meeting) {
  return shareExpiresOn(meeting.date) !== null;
}
function toSharedMeeting(meeting) {
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    time: meeting.time,
    type: meeting.type,
    status: meeting.status,
    attendees: meeting.attendees,
    summary: meeting.summary,
    agenda: meeting.agenda,
    actions: meeting.actions,
    link: meeting.link,
    image: meeting.image
  };
}

// server/notion.ts
var NOTION_VERSION = "2022-06-28";
var NOTION_API = "https://api.notion.com/v1";
var MANAGED_SECTIONS = ["time", "agenda", "actions", "note"];
var AGENDA_SEPARATOR = " :: ";
var AGENDA_ESCAPED = " ::\u2063 ";
function encodeAgendaField(value) {
  return value.split(AGENDA_SEPARATOR).join(AGENDA_ESCAPED);
}
function decodeAgendaField(value) {
  return value.split(AGENDA_ESCAPED).join(AGENDA_SEPARATOR);
}
function parseAgendaLine(line) {
  const parts = line.split(AGENDA_SEPARATOR).map(decodeAgendaField);
  return {
    title: parts[0] ?? "",
    context: parts[1] ?? "",
    goal: parts[2] ?? "",
    decision: parts[3] ?? "",
    owner: parts[4] ?? ""
  };
}
var NotionConfigError = class extends Error {
};
function getConfig() {
  const missing2 = [
    !ENV.notionApiToken && "NOTION_API_TOKEN",
    !ENV.notionDatabaseId && "NOTION_DATABASE_ID"
  ].filter(Boolean);
  if (missing2.length > 0) {
    throw new NotionConfigError(`Notion is not configured. Missing: ${missing2.join(", ")}.`);
  }
  return { token: ENV.notionApiToken, databaseId: ENV.notionDatabaseId };
}
function isNotionConfigured() {
  return Boolean(ENV.notionApiToken && ENV.notionDatabaseId);
}
var MIN_REQUEST_GAP_MS = 340;
var requestChain = Promise.resolve();
function schedule(task) {
  const result = requestChain.then(task, task);
  requestChain = result.then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS)),
    () => new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS))
  );
  return result;
}
async function notionRequest(path, init, token) {
  const authToken = token ?? getConfig().token;
  return schedule(async () => {
    const response = await fetch(`${NOTION_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...init?.headers ?? {}
      }
    });
    if (!response.ok) {
      const body2 = await response.text();
      throw new Error(`Notion API ${response.status}: ${body2}`);
    }
    if (response.status === 204) return void 0;
    const body = await response.text();
    return body ? JSON.parse(body) : void 0;
  });
}
function richText(items) {
  return items?.map((item) => item.plain_text ?? item.text?.content ?? "").join("") ?? "";
}
function text(content) {
  return [{ type: "text", text: { content: (content ?? "").slice(0, 2e3) } }];
}
var ALIASES = {
  title: ["name", "title", "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0633\u0645 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639", "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639"],
  date: ["date", "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", "\u062A\u0627\u0631\u064A\u062E"],
  time: ["time", "\u0627\u0644\u0648\u0642\u062A", "\u0648\u0642\u062A"],
  image: ["image", "\u0627\u0644\u0635\u0648\u0631\u0629", "\u0635\u0648\u0631\u0629", "logo", "\u0627\u0644\u0634\u0639\u0627\u0631"],
  type: ["type", "\u0627\u0644\u0646\u0648\u0639", "\u0646\u0648\u0639 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639"],
  attendees: ["attendees", "\u0627\u0644\u062D\u0636\u0648\u0631", "participants", "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0648\u0646"],
  status: ["status", "\u0627\u0644\u062D\u0627\u0644\u0629"],
  summary: ["summary", "\u0627\u0644\u0645\u0644\u062E\u0635", "\u0627\u0644\u0645\u0644\u062E\u0635 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A"],
  link: ["external link", "link", "url", "\u0627\u0644\u0631\u0627\u0628\u0637", "\u0645\u0631\u062C\u0639 \u062E\u0627\u0631\u062C\u064A"],
  share: ["share", "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629", "\u0645\u0634\u0627\u0631\u0643\u0629", "\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629"]
};
var ACCEPTED_TYPES = {
  title: ["title"],
  date: ["date"],
  time: ["rich_text"],
  image: ["url", "files"],
  type: ["select"],
  attendees: ["rich_text", "multi_select", "people"],
  status: ["status", "select"],
  summary: ["rich_text"],
  link: ["url"],
  share: ["rich_text"]
};
var ALIAS_ONLY = /* @__PURE__ */ new Set(["time", "image", "share"]);
var SCHEMA_TTL_MS = 5 * 60 * 1e3;
var schemaCache = null;
function resolveSchema(raw) {
  const entries = Object.entries(raw.properties);
  const taken = /* @__PURE__ */ new Set();
  const pick = (key) => {
    const accepted = ACCEPTED_TYPES[key];
    const aliases = ALIASES[key];
    const byAlias = entries.find(
      ([name, prop]) => !taken.has(name) && accepted.includes(prop.type) && aliases.includes(name.trim().toLowerCase())
    );
    const chosen = ALIAS_ONLY.has(key) ? byAlias : byAlias ?? entries.find(([name, prop]) => !taken.has(name) && accepted.includes(prop.type));
    if (!chosen) return null;
    taken.add(chosen[0]);
    return { name: chosen[0], type: chosen[1].type };
  };
  const title = pick("title");
  const date = pick("date");
  const time = pick("time");
  const image = pick("image");
  const share = pick("share");
  const link = pick("link");
  const status = pick("status");
  const type = pick("type");
  const summary = pick("summary");
  const attendees = pick("attendees");
  const optionsOf = (field) => {
    if (!field) return [];
    const prop = raw.properties[field.name];
    return (prop?.status?.options ?? prop?.select?.options ?? []).map((option) => option.name);
  };
  return {
    title,
    date,
    time,
    type,
    attendees,
    status,
    summary,
    link,
    image,
    share,
    statusOptions: optionsOf(status),
    typeOptions: optionsOf(type)
  };
}
async function getDatabaseSchema(force = false) {
  const { databaseId } = getConfig();
  if (!force && schemaCache?.databaseId === databaseId && Date.now() - schemaCache.fetchedAt < SCHEMA_TTL_MS) {
    return schemaCache.schema;
  }
  const raw = await notionRequest(`/databases/${databaseId}`);
  const schema = resolveSchema(raw);
  schemaCache = { databaseId, schema, fetchedAt: Date.now() };
  return schema;
}
async function getNotionDatabaseInfo() {
  const { databaseId } = getConfig();
  const raw = await notionRequest(`/databases/${databaseId}`);
  return { id: raw.id, title: richText(raw.title), schema: resolveSchema(raw) };
}
function propertyText(property) {
  if (!property) return "";
  switch (property.type) {
    case "title":
      return richText(property.title);
    case "rich_text":
      return richText(property.rich_text);
    case "select":
      return property.select?.name ?? "";
    case "status":
      return property.status?.name ?? "";
    case "date":
      return property.date?.start ?? "";
    case "url":
      return property.url ?? "";
    case "multi_select":
      return (property.multi_select ?? []).map((o) => o.name ?? "").filter(Boolean).join(", ");
    case "people":
      return (property.people ?? []).map((p) => p.name ?? "").filter(Boolean).join(", ");
    case "files": {
      const first = (property.files ?? [])[0];
      return first?.external?.url ?? first?.file?.url ?? "";
    }
    default:
      return "";
  }
}
function readField(page, field) {
  return field ? propertyText(page.properties[field.name]) : "";
}
function mapStatus(status) {
  const normalized = status.trim().toLowerCase();
  if (status === "\u062A\u0645 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639" || ["done", "completed", "complete"].includes(normalized)) return "\u062A\u0645 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639";
  if (status === "\u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0631\u0636" || ["ready", "in progress", "ready to present"].includes(normalized)) return "\u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0631\u0636";
  return "\u0645\u0633\u0648\u062F\u0629";
}
async function readPageContent(pageId) {
  let time = "";
  let note = "";
  const agenda = [];
  const actions = [];
  try {
    let section = "";
    let cursor;
    do {
      const query = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
      const response = await notionRequest(
        `/blocks/${pageId}/children${query}`
      );
      for (const item of response.results) {
        if (item.type === "heading_2") {
          section = richText(item.heading_2?.rich_text).trim().toLowerCase();
          continue;
        }
        if (!MANAGED_SECTIONS.includes(section)) continue;
        if (item.type === "paragraph") {
          const value = richText(item.paragraph?.rich_text);
          if (!value) continue;
          if (section === "time") time = time ? `${time} ${value}` : value;
          if (section === "note") note = note ? `${note}
${value}` : value;
        } else if (item.type === "bulleted_list_item") {
          const value = richText(item.bulleted_list_item?.rich_text);
          if (!value) continue;
          if (section === "agenda") {
            agenda.push(parseAgendaLine(value));
          } else if (section === "actions") {
            actions.push(value);
          }
        }
      }
      cursor = response.has_more ? response.next_cursor ?? void 0 : void 0;
    } while (cursor);
  } catch (error) {
    console.warn(`[Notion] Could not read content of page ${pageId}:`, error);
  }
  return { time, note, agenda, actions };
}
async function mapPage(page, schema) {
  const content = await readPageContent(page.id);
  const isoDate = readField(page, schema.date);
  return {
    id: page.id,
    title: readField(page, schema.title) || "\u0627\u062C\u062A\u0645\u0627\u0639 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646",
    // Notion stores a real date; the workspace shows a readable string.
    date: isoDate ? fromIsoDate(isoDate) : "\u0627\u062E\u062A\u0631 \u0627\u0644\u062A\u0627\u0631\u064A\u062E",
    // Prefer the Time property; older meetings only have it in the page body.
    time: readField(page, schema.time) || content.time,
    type: readField(page, schema.type) || "\u0623\u062E\u0631\u0649",
    status: mapStatus(readField(page, schema.status)),
    attendees: readField(page, schema.attendees).split(/[,،]/).map((person) => person.trim()).filter(Boolean),
    summary: readField(page, schema.summary),
    agenda: content.agenda,
    actions: content.actions,
    note: content.note,
    link: readField(page, schema.link) || page.url || "",
    image: readField(page, schema.image),
    share: readField(page, schema.share)
  };
}
async function listNotionMeetings() {
  const { databaseId } = getConfig();
  const schema = await getDatabaseSchema();
  const pages = [];
  let cursor;
  do {
    const response = await notionRequest(
      `/databases/${databaseId}/query`,
      { method: "POST", body: JSON.stringify({ page_size: 100, ...cursor ? { start_cursor: cursor } : {} }) }
    );
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor ?? void 0 : void 0;
  } while (cursor);
  const meetings = [];
  for (const page of pages) meetings.push(await mapPage(page, schema));
  return meetings;
}
function statusValue(status, options) {
  const wanted = status === "\u062A\u0645 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639" ? ["Done", "\u062A\u0645 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639", "Completed"] : status === "\u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0631\u0636" ? ["In progress", "\u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0631\u0636", "Ready"] : ["Not started", "\u0645\u0633\u0648\u062F\u0629", "Draft"];
  return options.find((option) => wanted.includes(option)) ?? wanted[0];
}
function buildProperties(meeting, schema) {
  const properties = {};
  if (schema.title && meeting.title !== void 0) {
    properties[schema.title.name] = { title: text(meeting.title) };
  }
  if (schema.date && meeting.date !== void 0) {
    const iso = toIsoDate(meeting.date);
    properties[schema.date.name] = { date: iso ? { start: iso } : null };
  }
  if (schema.time && meeting.time !== void 0) {
    properties[schema.time.name] = { rich_text: text(meeting.time) };
  }
  if (schema.type && meeting.type !== void 0) {
    properties[schema.type.name] = { select: meeting.type ? { name: meeting.type } : null };
  }
  if (schema.attendees && meeting.attendees !== void 0) {
    const names = meeting.attendees.filter(Boolean);
    if (schema.attendees.type === "multi_select") {
      properties[schema.attendees.name] = { multi_select: names.map((name) => ({ name })) };
    } else if (schema.attendees.type === "rich_text") {
      properties[schema.attendees.name] = { rich_text: text(names.join(", ")) };
    }
  }
  if (schema.status && meeting.status !== void 0) {
    const value = statusValue(meeting.status, schema.statusOptions);
    properties[schema.status.name] = schema.status.type === "status" ? { status: { name: value } } : { select: { name: value } };
  }
  if (schema.summary && meeting.summary !== void 0) {
    properties[schema.summary.name] = { rich_text: text(meeting.summary) };
  }
  if (schema.link && meeting.link !== void 0) {
    properties[schema.link.name] = { url: meeting.link || null };
  }
  if (schema.share && meeting.share !== void 0) {
    properties[schema.share.name] = { rich_text: text(meeting.share) };
  }
  if (schema.image?.type === "url" && meeting.image !== void 0) {
    properties[schema.image.name] = { url: meeting.image || null };
  }
  return properties;
}
function block(type, content) {
  return { object: "block", type, [type]: { rich_text: text(content) } };
}
function managedBlocks(meeting, hasTimeProperty) {
  return [
    // Skipped when Time is a real property, so the value has one home only.
    ...hasTimeProperty ? [] : [block("heading_2", "Time"), block("paragraph", meeting.time)],
    block("heading_2", "Agenda"),
    ...meeting.agenda.map(
      (item) => block("bulleted_list_item", [item.title, item.context, item.goal, item.decision, item.owner].map(encodeAgendaField).join(AGENDA_SEPARATOR))
    ),
    block("heading_2", "Actions"),
    ...meeting.actions.map((action) => block("bulleted_list_item", action)),
    block("heading_2", "Note"),
    block("paragraph", meeting.note)
  ];
}
async function replaceManagedContent(meeting, hasTimeProperty) {
  const stale = [];
  let section = "";
  let cursor;
  do {
    const query = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const response = await notionRequest(
      `/blocks/${meeting.id}/children${query}`
    );
    for (const item of response.results) {
      if (item.type === "heading_2") {
        section = richText(item.heading_2?.rich_text).trim().toLowerCase();
        if (MANAGED_SECTIONS.includes(section)) stale.push(item.id);
        continue;
      }
      if (MANAGED_SECTIONS.includes(section)) stale.push(item.id);
    }
    cursor = response.has_more ? response.next_cursor ?? void 0 : void 0;
  } while (cursor);
  for (const id of stale) {
    await notionRequest(`/blocks/${id}`, { method: "DELETE" });
  }
  const children = managedBlocks(meeting, hasTimeProperty);
  for (let index = 0; index < children.length; index += 100) {
    await notionRequest(`/blocks/${meeting.id}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(index, index + 100) })
    });
  }
}
async function updateNotionMeeting(meeting) {
  const schema = await getDatabaseSchema();
  await notionRequest(`/pages/${meeting.id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: buildProperties(meeting, schema) })
  });
  await replaceManagedContent(meeting, Boolean(schema.time));
}
async function createNotionMeeting(meeting) {
  const { databaseId } = getConfig();
  const schema = await getDatabaseSchema();
  const page = await notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: buildProperties(meeting, schema)
    })
  });
  const created = { ...meeting, id: page.id, share: "" };
  await replaceManagedContent(created, Boolean(schema.time));
  return { ...created, link: created.link || page.url || "" };
}
async function deleteNotionMeeting(id) {
  await notionRequest(`/pages/${id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
}
async function findNotionMeetingByShareToken(token) {
  if (!token) return null;
  const { databaseId } = getConfig();
  const schema = await getDatabaseSchema();
  if (!schema.share) return null;
  const response = await notionRequest(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 2,
      filter: { property: schema.share.name, rich_text: { equals: token } }
    })
  });
  if (response.results.length !== 1) return null;
  const page = response.results[0];
  const meeting = await mapPage(page, schema);
  return { ...meeting, link: meeting.link === page.url ? "" : meeting.link };
}
async function setNotionMeetingShare(id, token) {
  let schema = await getDatabaseSchema();
  if (!schema.share && token) {
    try {
      const { databaseId } = getConfig();
      await notionRequest(`/databases/${databaseId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { Share: { rich_text: {} } } })
      });
      schema = await getDatabaseSchema(true);
    } catch (error) {
      console.error("[notion] could not add the Share property", error);
    }
  }
  if (!schema.share) {
    if (!token) return;
    throw new Error(
      "\u0642\u0627\u0639\u062F\u0629 Notion \u062A\u0646\u0642\u0635\u0647\u0627 \u062E\u0627\u0635\u064A\u0629 Share. \u0634\u063A\u0651\u0644: pnpm setup:notion"
    );
  }
  await notionRequest(`/pages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: { [schema.share.name]: { rich_text: text(token) } }
    })
  });
}
async function getNotionMeetingDate(id) {
  const schema = await getDatabaseSchema();
  const page = await notionRequest(`/pages/${id}`);
  const iso = readField(page, schema.date);
  return iso ? fromIsoDate(iso) : null;
}

// server/tasks.ts
import { TRPCError as TRPCError3 } from "@trpc/server";

// shared/tasks.ts
var QUADRANTS = [
  { id: "important_urgent", importance: "important", urgency: "urgent", title: "\u0645\u0647\u0645 \u0648\u0639\u0627\u062C\u0644", verb: "\u0627\u0641\u0639\u0644 \u0627\u0644\u0622\u0646", titleEn: "Important & urgent", verbEn: "Do it now" },
  { id: "important_not_urgent", importance: "important", urgency: "not-urgent", title: "\u0645\u0647\u0645 \u0648\u063A\u064A\u0631 \u0639\u0627\u062C\u0644", verb: "\u062E\u0637\u0651\u0637 \u0644\u0647", titleEn: "Important, not urgent", verbEn: "Plan it" },
  { id: "not_important_urgent", importance: "not-important", urgency: "urgent", title: "\u063A\u064A\u0631 \u0645\u0647\u0645 \u0648\u0639\u0627\u062C\u0644", verb: "\u0641\u0648\u0651\u0636", titleEn: "Urgent, not important", verbEn: "Delegate" },
  { id: "not_important_not_urgent", importance: "not-important", urgency: "not-urgent", title: "\u063A\u064A\u0631 \u0645\u0647\u0645 \u0648\u063A\u064A\u0631 \u0639\u0627\u062C\u0644", verb: "\u0627\u062D\u0630\u0641", titleEn: "Neither urgent nor important", verbEn: "Drop it" }
];
var REPEAT_RULES = ["daily", "weekdays", "weekly", "custom"];
var WORK_DAYS = [0, 1, 2, 3, 4];
var TASK_CATEGORIES = [
  { id: "deep", label: "\u0639\u0645\u0644 \u0639\u0645\u064A\u0642", labelEn: "Deep work", tone: "purple" },
  { id: "meeting", label: "\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A", labelEn: "Meetings", tone: "blue" },
  { id: "personal", label: "\u0634\u062E\u0635\u064A", labelEn: "Personal", tone: "teal" },
  { id: "project", label: "\u0639\u0645\u0644 \u0639\u0644\u0649 \u0645\u0634\u0631\u0648\u0639", labelEn: "Project work", tone: "orange" },
  { id: "other", label: "\u0623\u062E\u0631\u0649", labelEn: "Other", tone: "gray" }
];
var DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var TASK_ORIGINS = ["eisenhower", "timeblock", "focus"];
var TASK_PRIORITIES = ["low", "medium", "high"];
function quadrantOf(importance, urgency) {
  const found = QUADRANTS.find((q) => q.importance === importance && q.urgency === urgency);
  if (!found) throw new Error(`\u0644\u0627 \u0631\u064F\u0628\u0639 \u0644\u0640 ${importance}/${urgency}`);
  return found.id;
}
function splitQuadrant(quadrant) {
  const found = QUADRANTS.find((q) => q.id === quadrant);
  if (!found) throw new Error(`\u0631\u064F\u0628\u0639 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641: ${quadrant}`);
  return { importance: found.importance, urgency: found.urgency };
}
function stateOf(task) {
  if (task.completedAt) return "completed";
  if (task.scheduledStart && task.scheduledEnd) return "scheduled";
  if (task.quadrant) return "classified";
  return "new";
}
var DAY_MS = 864e5;
function nextOccurrence(startIso, endIso, rule, days = []) {
  const anchor = weekdayOf(startIso);
  let step = 7;
  for (let offset = 1; offset <= 7; offset += 1) {
    if (repeatsOn(rule, (anchor + offset) % 7, anchor, days)) {
      step = offset;
      break;
    }
  }
  return {
    start: new Date(new Date(startIso).getTime() + step * DAY_MS).toISOString(),
    end: new Date(new Date(endIso).getTime() + step * DAY_MS).toISOString()
  };
}
var RIYADH_OFFSET_MS = 3 * 36e5;
function weekdayOf(iso) {
  return new Date(new Date(iso).getTime() + RIYADH_OFFSET_MS).getUTCDay();
}
function repeatsOn(rule, weekday, anchor, days = []) {
  if (rule === "daily") return true;
  if (rule === "weekdays") return WORK_DAYS.includes(weekday);
  if (rule === "weekly") return weekday === anchor;
  return days.includes(weekday);
}

// server/tasks.ts
var TABLE = "eisenhower_tasks";
var SESSIONS = "waf_focus_sessions";
function tasksAreConfigured() {
  return Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);
}
function credentials() {
  const missing2 = [
    !ENV.supabaseUrl && "SUPABASE_URL",
    !ENV.supabaseAnonKey && "SUPABASE_ANON_KEY"
  ].filter(Boolean);
  if (missing2.length) {
    throw new TRPCError3({
      code: "PRECONDITION_FAILED",
      // الرسالة تسمّي الناقص: خطأ الإعداد يُقرأ مرة واحدة ويُصلَح، ولا يُخمَّن.
      message: `\u0627\u0644\u0645\u0647\u0627\u0645 \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637\u0629. \u0627\u0644\u0646\u0627\u0642\u0635: ${missing2.join("\u060C ")}`
    });
  }
  return { url: ENV.supabaseUrl.replace(/\/$/, ""), key: ENV.supabaseAnonKey };
}
var SupabaseError = class extends TRPCError3 {
  detail;
  constructor(status, detail) {
    super({
      code: status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
      message: status === 404 ? "\u0644\u0645 \u0646\u062C\u062F \u0645\u0627 \u062A\u0628\u062D\u062B \u0639\u0646\u0647." : "\u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
    });
    this.detail = detail;
  }
};
async function rest(who, path, init = {}) {
  const { url, key } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      // رمز المستخدم لا المفتاح المجهول: هو ما يجعل auth.uid() له.
      Authorization: `Bearer ${who.token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    console.error("[supabase]", response.status, path.split("?")[0], detail);
    throw new SupabaseError(response.status, detail);
  }
  const body = await response.text();
  return body ? JSON.parse(body) : void 0;
}
function toTask(row, sessions = 0) {
  const quadrant = row.classified_at && row.importance && row.urgency ? quadrantOf(row.importance, row.urgency) : void 0;
  const completedAt = row.completed_at ?? (row.is_done ? row.created_at : void 0);
  const core = {
    id: row.id,
    title: row.name,
    description: row.description ?? void 0,
    quadrant,
    scheduledStart: row.scheduled_start ?? void 0,
    scheduledEnd: row.scheduled_end ?? void 0,
    estimatedMinutes: row.estimated_minutes ?? void 0,
    repeatRule: row.repeat_rule ?? void 0,
    reminderMinutes: row.reminder_minutes ?? void 0,
    projectId: row.project_id ?? void 0,
    category: row.category ?? void 0,
    priority: row.priority ?? void 0,
    dueDate: row.due_date ?? void 0,
    repeatDays: row.repeat_days ?? void 0,
    origin: row.origin ?? void 0,
    completedSessions: sessions,
    createdAt: row.created_at,
    completedAt: completedAt ?? void 0
  };
  return { ...core, state: stateOf(core) };
}
var OPTIONAL_COLUMNS = [
  "repeat_rule",
  "reminder_minutes",
  "project_id",
  "category",
  "priority",
  "due_date",
  "repeat_days",
  "origin"
];
var BASE_COLUMNS = "id,name,description,importance,urgency,classified_at,scheduled_start,scheduled_end,estimated_minutes,completed_at,is_done,created_at";
var missing = /* @__PURE__ */ new Set();
function columns() {
  const extra = OPTIONAL_COLUMNS.filter((column) => !missing.has(column));
  return extra.length ? `${BASE_COLUMNS},${extra.join(",")}` : BASE_COLUMNS;
}
function absentColumn(error) {
  const detail = String(error?.detail ?? "");
  if (!/42703|does not exist/.test(detail)) return null;
  return OPTIONAL_COLUMNS.find((column) => detail.includes(column)) ?? null;
}
function optional(values) {
  const body = {};
  for (const [column, value] of Object.entries(values)) {
    if (!missing.has(column)) body[column] = value;
  }
  return body;
}
async function withSchemaFallback(run) {
  for (let attempt = 0; attempt <= OPTIONAL_COLUMNS.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (/repeat_rule_check/.test(String(error?.detail ?? ""))) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: "\u0647\u0630\u0627 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u064A\u062D\u062A\u0627\u062C \u062A\u0631\u062D\u064A\u0644 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A (waf-timeblock.sql). \u0627\u062E\u062A\u0631 \xAB\u0643\u0644 \u064A\u0648\u0645\xBB \u0623\u0648 \xAB\u0643\u0644 \u0623\u0633\u0628\u0648\u0639\xBB \u0627\u0644\u0622\u0646."
        });
      }
      const column = absentColumn(error);
      if (!column || missing.has(column)) throw error;
      missing.add(column);
    }
  }
  return run();
}
async function sessionCounts(who, taskIds) {
  const counts = /* @__PURE__ */ new Map();
  if (!taskIds.length) return counts;
  const list = taskIds.map((id) => `"${id}"`).join(",");
  const rows = await rest(
    who,
    `${SESSIONS}?select=task_id&completed=is.true&task_id=in.(${list})`
  );
  for (const row of rows) counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1);
  return counts;
}
async function withSessions(who, row) {
  const counts = await sessionCounts(who, [row.id]);
  return toTask(row, counts.get(row.id) ?? 0);
}
function scope(origin) {
  if (!origin || missing.has("origin")) return "";
  return `&origin=eq.${origin}`;
}
async function listOpenTasks(who, origin) {
  const rows = await withSchemaFallback(
    () => rest(
      who,
      `${TABLE}?select=${columns()}&completed_at=is.null&is_done=eq.false&is_archived=eq.false${scope(origin)}&order=created_at.desc`
    )
  );
  const counts = await sessionCounts(who, rows.map((row) => row.id));
  return rows.map((row) => toTask(row, counts.get(row.id) ?? 0));
}
async function createTask(who, input, guard = false) {
  if (guard && input.scheduledStart && input.scheduledEnd) {
    await assertFree(who, input.scheduledStart, input.scheduledEnd, void 0, input.origin);
  }
  const split = input.quadrant ? splitQuadrant(input.quadrant) : null;
  const [row] = await withSchemaFallback(
    () => rest(who, `${TABLE}?select=${columns()}`, {
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
        classified_at: split ? (/* @__PURE__ */ new Date()).toISOString() : null,
        scheduled_start: input.scheduledStart ?? null,
        scheduled_end: input.scheduledEnd ?? null,
        estimated_minutes: input.estimatedMinutes ?? null,
        ...optional({
          repeat_rule: input.repeatRule ?? null,
          reminder_minutes: input.reminderMinutes ?? null,
          project_id: input.projectId ?? null,
          category: input.category ?? null,
          priority: input.priority ?? null,
          due_date: input.dueDate ?? null,
          repeat_days: input.repeatDays?.length ? input.repeatDays : null,
          origin: input.origin ?? null
        })
      })
    })
  );
  return withSessions(who, row);
}
async function classifyTask(who, id, quadrant) {
  const { importance, urgency } = splitQuadrant(quadrant);
  const [row] = await withSchemaFallback(
    () => rest(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ importance, urgency, classified_at: (/* @__PURE__ */ new Date()).toISOString() })
    })
  );
  if (!row) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0627 \u0645\u0647\u0645\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641" });
  return withSessions(who, row);
}
async function originOf(who, id) {
  if (missing.has("origin")) return void 0;
  try {
    const [row] = await rest(who, `${TABLE}?select=origin&id=eq.${id}`);
    return row?.origin ?? void 0;
  } catch (error) {
    if (absentColumn(error) !== "origin") throw error;
    missing.add("origin");
    return void 0;
  }
}
async function assertFree(who, startIso, endIso, except, origin) {
  if (new Date(endIso) <= new Date(startIso)) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0648\u0642\u062A \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0644\u064A \u0648\u0642\u062A \u0627\u0644\u0628\u062F\u0627\u064A\u0629" });
  }
  const window = `scheduled_start=lt.${encodeURIComponent(endIso)}&scheduled_end=gt.${encodeURIComponent(startIso)}`;
  const self = except ? `&id=neq.${except}` : "";
  const clashes = await withSchemaFallback(
    () => rest(
      who,
      `${TABLE}?select=id,name&completed_at=is.null&is_archived=eq.false&${window}${self}${scope(origin)}`
    )
  );
  if (clashes.length) {
    throw new TRPCError3({
      code: "CONFLICT",
      message: `\u064A\u0648\u062C\u062F \u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0648\u0642\u062A \u0645\u0639 \xAB${clashes[0].name}\xBB`
    });
  }
}
async function updateTask(who, id, patch) {
  if (patch.schedule) {
    await assertFree(who, patch.schedule.start, patch.schedule.end, id, await originOf(who, id));
  }
  const body = {};
  if (patch.title !== void 0) body.name = patch.title.trim();
  if (patch.description !== void 0) body.description = patch.description?.trim() || null;
  if (patch.estimatedMinutes !== void 0) body.estimated_minutes = patch.estimatedMinutes;
  if (patch.schedule !== void 0) {
    body.scheduled_start = patch.schedule?.start ?? null;
    body.scheduled_end = patch.schedule?.end ?? null;
  }
  const [row] = await withSchemaFallback(
    () => rest(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...body,
        ...optional({
          ...patch.category === void 0 ? {} : { category: patch.category },
          ...patch.priority === void 0 ? {} : { priority: patch.priority },
          ...patch.dueDate === void 0 ? {} : { due_date: patch.dueDate },
          ...patch.repeatRule === void 0 ? {} : { repeat_rule: patch.repeatRule },
          ...patch.repeatDays === void 0 ? {} : { repeat_days: patch.repeatDays?.length ? patch.repeatDays : null }
        })
      })
    })
  );
  if (!row) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0627 \u0645\u0647\u0645\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641" });
  return withSessions(who, row);
}
async function setTaskArchived(who, id, archived) {
  const [row] = await withSchemaFallback(
    () => rest(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ is_archived: archived })
    })
  );
  if (!row) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0627 \u0645\u0647\u0645\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641" });
  return withSessions(who, row);
}
async function reopenTask(who, id) {
  const [row] = await withSchemaFallback(
    () => rest(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ completed_at: null, is_done: false })
    })
  );
  if (!row) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0627 \u0645\u0647\u0645\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641" });
  return withSessions(who, row);
}
async function completeTask(who, id) {
  const [row] = await withSchemaFallback(
    () => rest(who, `${TABLE}?id=eq.${id}&select=${columns()}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ completed_at: (/* @__PURE__ */ new Date()).toISOString(), is_done: true })
    })
  );
  if (!row) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0627 \u0645\u0647\u0645\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0651\u0641" });
  if (row.repeat_rule && row.scheduled_start && row.scheduled_end) {
    const when = nextOccurrence(row.scheduled_start, row.scheduled_end, row.repeat_rule, row.repeat_days ?? []);
    await createTask(who, {
      title: row.name,
      description: row.description ?? void 0,
      quadrant: row.classified_at && row.importance && row.urgency ? quadrantOf(row.importance, row.urgency) : void 0,
      scheduledStart: when.start,
      scheduledEnd: when.end,
      estimatedMinutes: row.estimated_minutes ?? void 0,
      repeatRule: row.repeat_rule,
      origin: row.origin ?? void 0,
      repeatDays: row.repeat_days ?? void 0,
      category: row.category ?? void 0,
      priority: row.priority ?? void 0
    });
  }
  return withSessions(who, row);
}
async function openFocusSession(who, taskId, plannedMinutes) {
  const id = crypto.randomUUID();
  await rest(who, SESSIONS, {
    method: "POST",
    body: JSON.stringify({
      id,
      user_id: who.userId,
      task_id: taskId,
      planned_minutes: plannedMinutes,
      started_at: (/* @__PURE__ */ new Date()).toISOString()
    })
  });
  return id;
}
async function closeFocusSession(who, id, completed) {
  await rest(who, `${SESSIONS}?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ended_at: (/* @__PURE__ */ new Date()).toISOString(), completed })
  });
}

// server/routers.ts
var quadrantId = z2.enum(QUADRANTS.map((q) => q.id));
var repeatRule = z2.enum(REPEAT_RULES);
var repeatDays = z2.array(z2.number().int().min(0).max(6)).max(7);
var taskCategory = z2.enum(TASK_CATEGORIES.map((c) => c.id));
var taskPriority = z2.enum(TASK_PRIORITIES);
var taskOrigin = z2.enum(TASK_ORIGINS);
var dayString = z2.string().regex(DAY_PATTERN, "\u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
var agendaItem = z2.object({
  title: z2.string(),
  context: z2.string(),
  goal: z2.string(),
  // Captured during the meeting; older clients may omit them.
  decision: z2.string().default(""),
  owner: z2.string().default("")
});
var meetingFields = {
  title: z2.string(),
  date: z2.string(),
  time: z2.string(),
  type: z2.string(),
  status: z2.enum(["\u0645\u0633\u0648\u062F\u0629", "\u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0631\u0636", "\u062A\u0645 \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639"]),
  attendees: z2.array(z2.string()),
  summary: z2.string(),
  agenda: z2.array(agendaItem),
  actions: z2.array(z2.string()),
  note: z2.string(),
  link: z2.string(),
  image: z2.string().default("")
};
var SHARE_TOKEN_LENGTH = 32;
var meetingInput = z2.object(meetingFields);
var meetingWithId = z2.object({ id: z2.string(), ...meetingFields });
var appRouter = router({
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
        const missing2 = [
          !ENV.notionApiToken && "NOTION_API_TOKEN",
          !ENV.notionDatabaseId && "NOTION_DATABASE_ID"
        ].filter(Boolean);
        return { configured: false, reachable: false, error: `Not configured. Missing: ${missing2.join(", ")}.` };
      }
      try {
        const info = await getNotionDatabaseInfo();
        const missing2 = ["title", "date", "type", "attendees", "status", "summary", "link"].filter((field) => !info.schema[field]);
        return { configured: true, reachable: true, title: info.title, missing: missing2 };
      } catch (error) {
        return { configured: true, reachable: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),
    list: workspaceProcedure.query(async () => ({
      source: "notion",
      meetings: await listNotionMeetings()
    })),
    create: workspaceProcedure.input(meetingInput).mutation(({ input }) => createNotionMeeting(input)),
    update: workspaceProcedure.input(meetingWithId).mutation(async ({ input }) => {
      await updateNotionMeeting(input);
      return { success: true };
    }),
    remove: workspaceProcedure.input(z2.object({ id: z2.string() })).mutation(async ({ input }) => {
      await deleteNotionMeeting(input.id);
      return { success: true };
    }),
    /**
     * Issue a read-only link for one meeting, or replace the one it has.
     *
     * The token is the whole secret, so it is generated here and never
     * derived from anything guessable about the meeting. Re-sharing mints a
     * fresh one, which is also how a leaked link is retired: the old address
     * stops resolving the moment the new one exists.
     */
    share: workspaceProcedure.input(z2.object({ id: z2.string() })).mutation(async ({ input }) => {
      const date = await getNotionMeetingDate(input.id);
      if (!date || !canShare({ date })) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: "\u0623\u0636\u0641 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u062C\u062A\u0645\u0627\u0639 \u0623\u0648\u0644\u064B\u0627 \u2014 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u062A\u064F\u062D\u0633\u0628 \u0645\u0646\u0647."
        });
      }
      const token = nanoid(SHARE_TOKEN_LENGTH);
      await setNotionMeetingShare(input.id, token);
      return { token, expiresOn: shareExpiresOn(date) };
    }),
    /** Retire the link. The address stops resolving immediately. */
    unshare: workspaceProcedure.input(z2.object({ id: z2.string() })).mutation(async ({ input }) => {
      await setNotionMeetingShare(input.id, "");
      return { success: true };
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
    shared: publicProcedure.input(z2.object({ token: z2.string().min(1).max(128) })).query(async ({ input }) => {
      const meeting = await findNotionMeetingByShareToken(input.token);
      if (!meeting) {
        throw new TRPCError4({ code: "NOT_FOUND", message: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." });
      }
      if (isShareExpired(meeting.date)) {
        throw new TRPCError4({
          code: "FORBIDDEN",
          message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637."
        });
      }
      return { meeting: toSharedMeeting(meeting) };
    })
  }),
  tasks: router({
    /**
     * `status` وحده عامّ: الصفحات تسأله قبل أن تعرف إن كان هناك مستخدم،
     * وجوابه إعداد الخادم لا بيانات أحد.
     */
    status: publicProcedure.query(() => ({ configured: tasksAreConfigured() })),
    // كل إطار يسأل عن مهامه وحدها؛ انظر TASK_ORIGINS.
    listOpen: authedProcedure.input(z2.object({ origin: taskOrigin })).query(({ ctx, input }) => listOpenTasks(ctx.identity, input.origin)),
    create: authedProcedure.input(
      z2.object({
        title: z2.string().trim().min(1, "\u0627\u0644\u0645\u0647\u0645\u0629 \u062A\u062D\u062A\u0627\u062C \u0639\u0646\u0648\u0627\u0646\u0627\u064B"),
        description: z2.string().trim().optional(),
        quadrant: quadrantId.optional(),
        scheduledStart: z2.string().datetime().optional(),
        scheduledEnd: z2.string().datetime().optional(),
        estimatedMinutes: z2.number().int().positive().optional(),
        repeatRule: repeatRule.optional(),
        repeatDays: repeatDays.optional(),
        reminderMinutes: z2.number().int().min(0).max(1440).optional(),
        projectId: z2.string().uuid().optional(),
        category: taskCategory.optional(),
        priority: taskPriority.optional(),
        dueDate: dayString.optional(),
        origin: taskOrigin
      })
    ).mutation(
      ({ ctx, input }) => createTask(ctx.identity, input, true)
    ),
    update: authedProcedure.input(
      z2.object({
        id: z2.string().uuid(),
        title: z2.string().trim().min(1, "\u0627\u0644\u0645\u0647\u0645\u0629 \u062A\u062D\u062A\u0627\u062C \u0639\u0646\u0648\u0627\u0646\u0627\u064B").optional(),
        description: z2.string().trim().nullable().optional(),
        estimatedMinutes: z2.number().int().positive().nullable().optional(),
        category: taskCategory.nullable().optional(),
        priority: taskPriority.nullable().optional(),
        dueDate: dayString.nullable().optional(),
        repeatRule: repeatRule.nullable().optional(),
        repeatDays: repeatDays.nullable().optional(),
        schedule: z2.object({ start: z2.string().datetime(), end: z2.string().datetime() }).nullable().optional()
      })
    ).mutation(
      ({ ctx, input: { id, ...patch } }) => updateTask(ctx.identity, id, patch)
    ),
    archive: authedProcedure.input(z2.object({ id: z2.string().uuid() })).mutation(({ ctx, input }) => setTaskArchived(ctx.identity, input.id, true)),
    restore: authedProcedure.input(z2.object({ id: z2.string().uuid() })).mutation(({ ctx, input }) => setTaskArchived(ctx.identity, input.id, false)),
    reopen: authedProcedure.input(z2.object({ id: z2.string().uuid() })).mutation(({ ctx, input }) => reopenTask(ctx.identity, input.id)),
    classify: authedProcedure.input(z2.object({ id: z2.string().uuid(), quadrant: quadrantId })).mutation(
      ({ ctx, input }) => classifyTask(ctx.identity, input.id, input.quadrant)
    ),
    complete: authedProcedure.input(z2.object({ id: z2.string().uuid() })).mutation(({ ctx, input }) => completeTask(ctx.identity, input.id)),
    startFocus: authedProcedure.input(z2.object({ taskId: z2.string().uuid(), minutes: z2.number().int().positive().max(240) })).mutation(async ({ ctx, input }) => ({
      sessionId: await openFocusSession(ctx.identity, input.taskId, input.minutes)
    })),
    endFocus: authedProcedure.input(z2.object({ sessionId: z2.string().uuid(), completed: z2.boolean() })).mutation(async ({ ctx, input }) => {
      await closeFocusSession(ctx.identity, input.sessionId, input.completed);
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  return { req: opts.req, res: opts.res };
}

// server/_core/app.ts
function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/vercel-entry.ts
var vercel_entry_default = createApp();
export {
  vercel_entry_default as default
};
