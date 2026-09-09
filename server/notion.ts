import type { MeetingAgendaItem, MeetingDraft, MeetingRecord } from "@shared/meeting-store";
import { fromIsoDate, toIsoDate } from "@shared/meeting-date";
import { ENV } from "./_core/env";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

/** Sections this tool owns inside a meeting page. Anything else is left alone. */
const MANAGED_SECTIONS = ["time", "agenda", "actions", "note"];
const AGENDA_SEPARATOR = " :: ";
/**
 * Agenda items are stored as one bullet per item: title :: context :: goal.
 * A field containing the separator used to corrupt the line and lose text on
 * read, so occurrences are escaped with an invisible separator on write.
 */
const AGENDA_ESCAPED = " ::⁣ ";

function encodeAgendaField(value: string) {
  return value.split(AGENDA_SEPARATOR).join(AGENDA_ESCAPED);
}

function decodeAgendaField(value: string) {
  return value.split(AGENDA_ESCAPED).join(AGENDA_SEPARATOR);
}

/**
 * title :: context :: goal :: decision :: owner
 *
 * Older lines hold only the first three; the extras simply read as empty, so a
 * meeting written before decisions existed still loads.
 */
function parseAgendaLine(line: string): MeetingAgendaItem {
  const parts = line.split(AGENDA_SEPARATOR).map(decodeAgendaField);
  return {
    title: parts[0] ?? "",
    context: parts[1] ?? "",
    goal: parts[2] ?? "",
    decision: parts[3] ?? "",
    owner: parts[4] ?? "",
  };
}

type NotionRichText = Array<{ plain_text?: string; text?: { content?: string }; name?: string }>;

type NotionProperty = {
  type?: string;
  title?: NotionRichText;
  rich_text?: NotionRichText;
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }> | null;
  people?: Array<{ name?: string }> | null;
  files?: Array<{ external?: { url?: string }; file?: { url?: string } }> | null;
  status?: { name?: string } | null;
  date?: { start?: string } | null;
  url?: string | null;
};

type NotionPage = {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty>;
};

type NotionBlock = {
  id: string;
  type?: string;
  heading_2?: { rich_text?: NotionRichText };
  paragraph?: { rich_text?: NotionRichText };
  bulleted_list_item?: { rich_text?: NotionRichText };
};

export class NotionConfigError extends Error {}

function getConfig() {
  // Name only what is actually missing. Reporting both sent us hunting for a
  // token that was set while the database id was quietly empty.
  const missing = [
    !ENV.notionApiToken && "NOTION_API_TOKEN",
    !ENV.notionDatabaseId && "NOTION_DATABASE_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new NotionConfigError(`Notion is not configured. Missing: ${missing.join(", ")}.`);
  }
  return { token: ENV.notionApiToken, databaseId: ENV.notionDatabaseId };
}

export function isNotionConfigured() {
  return Boolean(ENV.notionApiToken && ENV.notionDatabaseId);
}

// ---------------------------------------------------------------------------
// Request plumbing
// ---------------------------------------------------------------------------

/**
 * Notion allows roughly three requests per second per integration. Listing a
 * workspace fans out to one request per meeting page, so serialise everything
 * through a small spacing queue instead of hitting 429s under Promise.all.
 */
const MIN_REQUEST_GAP_MS = 340;
let requestChain: Promise<unknown> = Promise.resolve();

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const result = requestChain.then(task, task);
  requestChain = result
    .then(
      () => new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS)),
      () => new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS))
    );
  return result;
}

async function notionRequest<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const authToken = token ?? getConfig().token;

  return schedule(async () => {
    const response = await fetch(`${NOTION_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Notion API ${response.status}: ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  });
}

function richText(items: NotionRichText | undefined) {
  return items?.map((item) => item.plain_text ?? item.text?.content ?? "").join("") ?? "";
}

function text(content: string) {
  return [{ type: "text" as const, text: { content: (content ?? "").slice(0, 2000) } }];
}

// ---------------------------------------------------------------------------
// Adaptive schema mapping
//
// The database may use Arabic or English property names. Resolve each logical
// field once by alias, falling back to the first property of the right type, so
// reads and writes always target the same real property.
// ---------------------------------------------------------------------------

type FieldKey = "title" | "date" | "time" | "type" | "attendees" | "status" | "summary" | "link" | "image" | "share";

const ALIASES: Record<FieldKey, string[]> = {
  title: ["name", "title", "العنوان", "الاسم", "اسم الاجتماع", "عنوان الاجتماع"],
  date: ["date", "التاريخ", "تاريخ"],
  time: ["time", "الوقت", "وقت"],
  image: ["image", "الصورة", "صورة", "logo", "الشعار"],
  type: ["type", "النوع", "نوع الاجتماع"],
  attendees: ["attendees", "الحضور", "participants", "المشاركون"],
  status: ["status", "الحالة"],
  summary: ["summary", "الملخص", "الملخص التنفيذي"],
  link: ["external link", "link", "url", "الرابط", "مرجع خارجي"],
  share: ["share", "المشاركة", "مشاركة", "رابط المشاركة"],
};

const ACCEPTED_TYPES: Record<FieldKey, string[]> = {
  title: ["title"],
  date: ["date"],
  time: ["rich_text"],
  image: ["url", "files"],
  type: ["select"],
  attendees: ["rich_text", "multi_select", "people"],
  status: ["status", "select"],
  summary: ["rich_text"],
  link: ["url"],
  share: ["rich_text"],
};

/** Fields matched only by name. A loose type match would steal another column. */
const ALIAS_ONLY = new Set<FieldKey>(["time", "image", "share"]);

export type ResolvedField = { name: string; type: string } | null;
export type DatabaseSchema = Record<FieldKey, ResolvedField> & {
  statusOptions: string[];
  typeOptions: string[];
};

type RawDatabase = {
  id: string;
  title?: NotionRichText;
  properties: Record<
    string,
    {
      type: string;
      status?: { options?: Array<{ name: string }> };
      select?: { options?: Array<{ name: string }> };
    }
  >;
};

const SCHEMA_TTL_MS = 5 * 60 * 1000;
let schemaCache: { databaseId: string; schema: DatabaseSchema; fetchedAt: number } | null = null;

function resolveSchema(raw: RawDatabase): DatabaseSchema {
  const entries = Object.entries(raw.properties);
  const taken = new Set<string>();

  const pick = (key: FieldKey): ResolvedField => {
    const accepted = ACCEPTED_TYPES[key];
    const aliases = ALIASES[key];

    const byAlias = entries.find(
      ([name, prop]) =>
        !taken.has(name) && accepted.includes(prop.type) && aliases.includes(name.trim().toLowerCase())
    );
    const chosen = ALIAS_ONLY.has(key)
      ? byAlias
      : byAlias ?? entries.find(([name, prop]) => !taken.has(name) && accepted.includes(prop.type));

    if (!chosen) return null;
    taken.add(chosen[0]);
    return { name: chosen[0], type: chosen[1].type };
  };

  // Resolve the strongly-typed fields first so looser ones cannot steal them.
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

  const optionsOf = (field: ResolvedField) => {
    if (!field) return [];
    const prop = raw.properties[field.name];
    return (prop?.status?.options ?? prop?.select?.options ?? []).map((option) => option.name);
  };

  return {
    title, date, time, type, attendees, status, summary, link, image, share,
    statusOptions: optionsOf(status),
    typeOptions: optionsOf(type),
  };
}

export async function getDatabaseSchema(force = false): Promise<DatabaseSchema> {
  const { databaseId } = getConfig();
  if (!force && schemaCache?.databaseId === databaseId && Date.now() - schemaCache.fetchedAt < SCHEMA_TTL_MS) {
    return schemaCache.schema;
  }

  const raw = await notionRequest<RawDatabase>(`/databases/${databaseId}`);
  const schema = resolveSchema(raw);
  schemaCache = { databaseId, schema, fetchedAt: Date.now() };
  return schema;
}

export async function getNotionDatabaseInfo() {
  const { databaseId } = getConfig();
  const raw = await notionRequest<RawDatabase>(`/databases/${databaseId}`);
  return { id: raw.id, title: richText(raw.title), schema: resolveSchema(raw) };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function propertyText(property: NotionProperty | undefined): string {
  if (!property) return "";
  switch (property.type) {
    case "title": return richText(property.title);
    case "rich_text": return richText(property.rich_text);
    case "select": return property.select?.name ?? "";
    case "status": return property.status?.name ?? "";
    case "date": return property.date?.start ?? "";
    case "url": return property.url ?? "";
    case "multi_select": return (property.multi_select ?? []).map((o) => o.name ?? "").filter(Boolean).join(", ");
    case "people": return (property.people ?? []).map((p) => p.name ?? "").filter(Boolean).join(", ");
    case "files": {
      const first = (property.files ?? [])[0];
      return first?.external?.url ?? first?.file?.url ?? "";
    }
    default: return "";
  }
}

function readField(page: NotionPage, field: ResolvedField) {
  return field ? propertyText(page.properties[field.name]) : "";
}

function mapStatus(status: string): MeetingRecord["status"] {
  const normalized = status.trim().toLowerCase();
  if (status === "تم الاجتماع" || ["done", "completed", "complete"].includes(normalized)) return "تم الاجتماع";
  if (status === "جاهز للعرض" || ["ready", "in progress", "ready to present"].includes(normalized)) return "جاهز للعرض";
  return "مسودة";
}

/** Walk the blocks of a page, collecting only the sections this tool manages. */
async function readPageContent(pageId: string) {
  let time = "";
  let note = "";
  const agenda: MeetingAgendaItem[] = [];
  const actions: string[] = [];

  try {
    let section = "";
    let cursor: string | undefined;

    do {
      const query = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
      const response = await notionRequest<{ results: NotionBlock[]; has_more?: boolean; next_cursor?: string }>(
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
          if (section === "note") note = note ? `${note}\n${value}` : value;
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

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);
  } catch (error) {
    console.warn(`[Notion] Could not read content of page ${pageId}:`, error);
  }

  return { time, note, agenda, actions };
}

async function mapPage(page: NotionPage, schema: DatabaseSchema): Promise<MeetingRecord> {
  const content = await readPageContent(page.id);
  const isoDate = readField(page, schema.date);

  return {
    id: page.id,
    title: readField(page, schema.title) || "اجتماع بدون عنوان",
    // Notion stores a real date; the workspace shows a readable string.
    date: isoDate ? fromIsoDate(isoDate) : "اختر التاريخ",
    // Prefer the Time property; older meetings only have it in the page body.
    time: readField(page, schema.time) || content.time,
    type: readField(page, schema.type) || "أخرى",
    status: mapStatus(readField(page, schema.status)),
    attendees: readField(page, schema.attendees).split(/[,،]/).map((person) => person.trim()).filter(Boolean),
    summary: readField(page, schema.summary),
    agenda: content.agenda,
    actions: content.actions,
    note: content.note,
    link: readField(page, schema.link) || page.url || "",
    image: readField(page, schema.image),
    share: readField(page, schema.share),
  };
}

export async function listNotionMeetings(): Promise<MeetingRecord[]> {
  const { databaseId } = getConfig();
  const schema = await getDatabaseSchema();

  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionRequest<{ results: NotionPage[]; has_more?: boolean; next_cursor?: string }>(
      `/databases/${databaseId}/query`,
      { method: "POST", body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }) }
    );
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  // Sequential on purpose: mapPage fetches blocks, and the scheduler already
  // spaces requests, so Promise.all would queue them exactly the same way.
  const meetings: MeetingRecord[] = [];
  for (const page of pages) meetings.push(await mapPage(page, schema));
  return meetings;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function statusValue(status: MeetingRecord["status"], options: string[]) {
  const wanted =
    status === "تم الاجتماع" ? ["Done", "تم الاجتماع", "Completed"]
    : status === "جاهز للعرض" ? ["In progress", "جاهز للعرض", "Ready"]
    : ["Not started", "مسودة", "Draft"];
  // Prefer an option the database actually defines; Notion rejects unknown ones.
  return options.find((option) => wanted.includes(option)) ?? wanted[0];
}

function buildProperties(meeting: Partial<MeetingRecord>, schema: DatabaseSchema) {
  const properties: Record<string, unknown> = {};

  if (schema.title && meeting.title !== undefined) {
    properties[schema.title.name] = { title: text(meeting.title) };
  }
  if (schema.date && meeting.date !== undefined) {
    const iso = toIsoDate(meeting.date);
    // Placeholders such as "اختر التاريخ" clear the property instead of failing.
    properties[schema.date.name] = { date: iso ? { start: iso } : null };
  }
  if (schema.time && meeting.time !== undefined) {
    properties[schema.time.name] = { rich_text: text(meeting.time) };
  }
  if (schema.type && meeting.type !== undefined) {
    properties[schema.type.name] = { select: meeting.type ? { name: meeting.type } : null };
  }
  if (schema.attendees && meeting.attendees !== undefined) {
    const names = meeting.attendees.filter(Boolean);
    if (schema.attendees.type === "multi_select") {
      properties[schema.attendees.name] = { multi_select: names.map((name) => ({ name })) };
    } else if (schema.attendees.type === "rich_text") {
      properties[schema.attendees.name] = { rich_text: text(names.join(", ")) };
    }
    // "people" needs Notion user ids, which plain names cannot supply.
  }
  if (schema.status && meeting.status !== undefined) {
    const value = statusValue(meeting.status, schema.statusOptions);
    properties[schema.status.name] =
      schema.status.type === "status" ? { status: { name: value } } : { select: { name: value } };
  }
  if (schema.summary && meeting.summary !== undefined) {
    properties[schema.summary.name] = { rich_text: text(meeting.summary) };
  }
  if (schema.link && meeting.link !== undefined) {
    properties[schema.link.name] = { url: meeting.link || null };
  }
  if (schema.share && meeting.share !== undefined) {
    properties[schema.share.name] = { rich_text: text(meeting.share) };
  }
  // A "files" property needs Notion's upload flow, so only a url one is written.
  if (schema.image?.type === "url" && meeting.image !== undefined) {
    properties[schema.image.name] = { url: meeting.image || null };
  }

  return properties;
}

function block(type: "heading_2" | "paragraph" | "bulleted_list_item", content: string) {
  return { object: "block", type, [type]: { rich_text: text(content) } };
}

function managedBlocks(meeting: MeetingDraft, hasTimeProperty: boolean) {
  return [
    // Skipped when Time is a real property, so the value has one home only.
    ...(hasTimeProperty ? [] : [block("heading_2", "Time"), block("paragraph", meeting.time)]),
    block("heading_2", "Agenda"),
    ...meeting.agenda.map((item) =>
      block("bulleted_list_item", [item.title, item.context, item.goal, item.decision, item.owner].map(encodeAgendaField).join(AGENDA_SEPARATOR))
    ),
    block("heading_2", "Actions"),
    ...meeting.actions.map((action) => block("bulleted_list_item", action)),
    block("heading_2", "Note"),
    block("paragraph", meeting.note),
  ];
}

/**
 * Replace only the sections this tool owns. Blocks outside Time/Agenda/Actions/
 * Note are notes the user wrote themselves and must survive a save.
 */
async function replaceManagedContent(meeting: MeetingDraft & { id: string }, hasTimeProperty: boolean) {
  const stale: string[] = [];
  let section = "";
  let cursor: string | undefined;

  do {
    const query = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const response = await notionRequest<{ results: NotionBlock[]; has_more?: boolean; next_cursor?: string }>(
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

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  for (const id of stale) {
    await notionRequest(`/blocks/${id}`, { method: "DELETE" });
  }

  const children = managedBlocks(meeting, hasTimeProperty);
  // Notion caps children at 100 per request.
  for (let index = 0; index < children.length; index += 100) {
    await notionRequest(`/blocks/${meeting.id}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(index, index + 100) }),
    });
  }
}

export async function updateNotionMeeting(meeting: MeetingDraft & { id: string }) {
  const schema = await getDatabaseSchema();
  await notionRequest(`/pages/${meeting.id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: buildProperties(meeting, schema) }),
  });
  await replaceManagedContent(meeting, Boolean(schema.time));
}

export async function createNotionMeeting(meeting: MeetingDraft): Promise<MeetingRecord> {
  const { databaseId } = getConfig();
  const schema = await getDatabaseSchema();

  const page = await notionRequest<NotionPage>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: buildProperties(meeting, schema),
    }),
  });

  // A meeting is never born shared.
  const created: MeetingRecord = { ...meeting, id: page.id, share: "" };
  await replaceManagedContent(created, Boolean(schema.time));
  return { ...created, link: created.link || page.url || "" };
}

/** Notion has no hard delete through the API; archiving is the delete action. */
export async function deleteNotionMeeting(id: string) {
  await notionRequest(`/pages/${id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
}

// ---------------------------------------------------------------------------
// Read-only share links
// ---------------------------------------------------------------------------

/**
 * Find the one meeting a share token names.
 *
 * Notion does the matching, with an exact filter on the Share property, so a
 * token that is not in the database returns nothing rather than a page that
 * merely resembles it. The result is capped at two on purpose: one is the
 * answer, and a second means two meetings somehow carry the same token, which
 * is not a situation to guess your way out of — it returns null instead.
 *
 * The Notion page URL is stripped when it is only the fallback. A link holder
 * is outside the workspace; handing them the address of the underlying Notion
 * page tells them where the meetings live for no benefit they can use.
 */
export async function findNotionMeetingByShareToken(token: string): Promise<MeetingRecord | null> {
  if (!token) return null;

  const { databaseId } = getConfig();
  const schema = await getDatabaseSchema();
  if (!schema.share) return null;

  const response = await notionRequest<{ results: NotionPage[] }>(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 2,
      filter: { property: schema.share.name, rich_text: { equals: token } },
    }),
  });

  if (response.results.length !== 1) return null;

  const page = response.results[0];
  const meeting = await mapPage(page, schema);
  return { ...meeting, link: meeting.link === page.url ? "" : meeting.link };
}

/**
 * Write only the share token, leaving every other property and the page body
 * untouched.
 *
 * Deliberately not part of updateNotionMeeting: that one rebuilds the whole
 * page from what the workspace sent, and the token is not something the
 * workspace edits. Keeping the two apart means a normal save can never drop a
 * live link, and issuing a link can never overwrite a meeting.
 */
export async function setNotionMeetingShare(id: string, token: string) {
  const schema = await getDatabaseSchema();
  if (!schema.share) {
    // Surfaced to the workspace as a toast, so it is written for the person
    // reading it, not for a log.
    throw new Error(
      "قاعدة Notion تنقصها خاصية Share. شغّل: pnpm setup:notion"
    );
  }

  await notionRequest(`/pages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: { [schema.share.name]: { rich_text: text(token) } },
    }),
  });
}
