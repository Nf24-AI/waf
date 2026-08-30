// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1e3;
var IDLE_MINUTES = 10;
var IDLE_MS = IDLE_MINUTES * 60 * 1e3;
var IDLE_WARN_MS = 60 * 1e3;

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/trpc.ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;

// server/_core/systemRouter.ts
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

// server/access.ts
import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  notionApiToken: process.env.NOTION_API_TOKEN ?? "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID ?? "",
  // Single-user gate. Empty means open, which is only safe on localhost.
  appPassword: process.env.APP_PASSWORD ?? ""
};

// server/access.ts
var ACCESS_COOKIE = "meeting-prep-session";
function secret() {
  const value = ENV.cookieSecret || ENV.appPassword;
  if (!value) throw new Error("JWT_SECRET must be set when APP_PASSWORD is used.");
  return new TextEncoder().encode(value);
}
function accessIsOpen() {
  return !ENV.appPassword;
}
async function createSessionToken() {
  return new SignJWT({ scope: "owner" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${IDLE_MINUTES}m`).sign(secret());
}
async function hasValidSession(cookieHeader) {
  if (accessIsOpen()) return true;
  const token = parseCookieHeader(cookieHeader ?? "")[ACCESS_COOKIE];
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
function sessionCookieOptions(secure) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/"
  };
}
function passwordMatches(candidate) {
  const expected = ENV.appPassword;
  if (!expected) return true;
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  }
  return diff === 0;
}
async function touchSession(res) {
  res.cookie(ACCESS_COOKIE, await createSessionToken(), sessionCookieOptions(ENV.isProduction));
}
var appProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!await hasValidSession(ctx.req.headers.cookie)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "This workspace is locked." });
  }
  if (!accessIsOpen()) await touchSession(ctx.res);
  return next({ ctx });
});

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
  const missing = [
    !ENV.notionApiToken && "NOTION_API_TOKEN",
    !ENV.notionDatabaseId && "NOTION_DATABASE_ID"
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new NotionConfigError(`Notion is not configured. Missing: ${missing.join(", ")}.`);
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
  link: ["external link", "link", "url", "\u0627\u0644\u0631\u0627\u0628\u0637", "\u0645\u0631\u062C\u0639 \u062E\u0627\u0631\u062C\u064A"]
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
  link: ["url"]
};
var ALIAS_ONLY = /* @__PURE__ */ new Set(["time", "image"]);
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
    image: readField(page, schema.image)
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
  const created = { ...meeting, id: page.id };
  await replaceManagedContent(created, Boolean(schema.time));
  return { ...created, link: created.link || page.url || "" };
}
async function deleteNotionMeeting(id) {
  await notionRequest(`/pages/${id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
}

// server/routers.ts
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
var meetingInput = z2.object(meetingFields);
var meetingWithId = z2.object({ id: z2.string(), ...meetingFields });
var appRouter = router({
  system: systemRouter,
  auth: router({
    /** Reports lock state rather than a Manus identity. */
    me: publicProcedure.query(async ({ ctx }) => ({
      locked: !accessIsOpen(),
      unlocked: await hasValidSession(ctx.req.headers.cookie)
    })),
    unlock: publicProcedure.input(z2.object({ password: z2.string() })).mutation(async ({ ctx, input }) => {
      if (!passwordMatches(input.password)) {
        return { success: false };
      }
      const token = await createSessionToken();
      ctx.res.cookie(ACCESS_COOKIE, token, sessionCookieOptions(ENV.isProduction));
      return { success: true };
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
    touch: appProcedure.mutation(() => ({ ok: true })),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.clearCookie(ACCESS_COOKIE, sessionCookieOptions(ENV.isProduction));
      return { success: true };
    })
  }),
  meetings: router({
    /** Lets the workspace explain *why* Notion is unavailable instead of failing blankly. */
    status: appProcedure.query(async () => {
      if (!isNotionConfigured()) {
        const missing = [
          !ENV.notionApiToken && "NOTION_API_TOKEN",
          !ENV.notionDatabaseId && "NOTION_DATABASE_ID"
        ].filter(Boolean);
        return { configured: false, reachable: false, error: `Not configured. Missing: ${missing.join(", ")}.` };
      }
      try {
        const info = await getNotionDatabaseInfo();
        const missing = ["title", "date", "type", "attendees", "status", "summary", "link"].filter((field) => !info.schema[field]);
        return { configured: true, reachable: true, title: info.title, missing };
      } catch (error) {
        return { configured: true, reachable: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),
    list: appProcedure.query(async () => ({
      source: "notion",
      meetings: await listNotionMeetings()
    })),
    create: appProcedure.input(meetingInput).mutation(({ input }) => createNotionMeeting(input)),
    update: appProcedure.input(meetingWithId).mutation(async ({ input }) => {
      await updateNotionMeeting(input);
      return { success: true };
    }),
    remove: appProcedure.input(z2.object({ id: z2.string() })).mutation(async ({ input }) => {
      await deleteNotionMeeting(input.id);
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
