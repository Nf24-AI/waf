# Meeting Prep Tool

Arabic/English RTL meeting workspace. Prepare a meeting, then present it.

**Notion is the database.** Meetings are Notion pages; there is no separate
application database. Nothing is stored in the browser except UI preferences.

## Setup

### 1. Create a Notion integration

Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) →
**New integration** → copy the *Internal Integration Secret* (starts with `ntn_`).

Put it in `.env`:

```
NOTION_API_TOKEN=ntn_...
```

### 2. Create the database

Open the Notion page that should hold the database. Connect your integration to
it via the `•••` menu → **Connections**. Copy the 32-character id from the page
URL into `.env` as `NOTION_PARENT_PAGE_ID`, then run:

```bash
pnpm setup:notion
```

It creates a **Meeting Prep** database with the exact schema the adapter needs
and prints the `NOTION_DATABASE_ID` to add to `.env`.

Re-run it any time with `NOTION_DATABASE_ID` already set and it repairs the
existing database instead, adding only the properties that are missing.

To use an existing database instead, skip this and set `NOTION_DATABASE_ID`
yourself — but connect the integration to that database first, or every request
returns 404. The adapter matches properties **by type**, so Arabic or English
names both work. It needs: a `title`, a `date`, a `url`, a `select` or `status`,
plus `rich_text` fields for the summary and attendees. A `rich_text` property
named **Time** is matched by name only — add it and the meeting time becomes
sortable and filterable in Notion instead of living in the page body.

### 3. Run

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Access control

Single user, gated by one password:

| `APP_PASSWORD` | Behaviour |
|---|---|
| empty | Open. Correct for `pnpm dev` on localhost. |
| set | A signed session cookie is required for every meeting request. |

**Set `APP_PASSWORD` and `JWT_SECRET` before deploying to any public URL.**
Without it, anyone with the address can read and edit your meetings.

The original Manus OAuth flow was removed — it only resolves inside the Manus
platform, where it made every meeting request fail with `UNAUTHORIZED`.

## Layout

- `client/src/` — React workspace: preparation mode, display mode, UI customization
- `server/notion.ts` — the Notion adapter (schema mapping, CRUD, rate limiting)
- `server/access.ts` — single-user password gate
- `server/routers.ts` — tRPC procedures
- `shared/meeting-date.ts` — Arabic display date ↔ ISO conversion
- `scripts/setup-notion.ts` — one-time database creation

## How meetings map to Notion

Database properties hold the metadata. The page body holds the detail, under
the headings this tool owns:

| Heading | Content |
|---|---|
| `Agenda` | `title :: context :: goal` per bullet |
| `Actions` | One follow-up per bullet |
| `Note` | Preparation notes |

Anything you write **outside** those sections is left alone on save. Agenda
fields containing ` :: ` are escaped, so the separator never corrupts an item.

If the database has no **Time** property, the time falls back to a `Time`
heading in the page body.

Deleting a meeting archives the Notion page — restore it from Notion's trash.

## Sharing a meeting as a PDF

Display mode has a **تنزيل PDF** button. It opens the browser's print dialog —
choose *Save as PDF* as the destination and the meeting page is saved as
`واف — <title> — <date>.pdf`, ready to view or send on.

The export goes through the browser's print pipeline rather than a canvas
exporter, so the Arabic keeps its shaping and the text in the saved file stays
selectable and searchable instead of being flattened into a picture.

What changes on paper: the toolbar, the agenda progress rail and the *mark
covered* buttons are dropped, the decision and owner fields print as the text
typed into them rather than as empty boxes, the two bottom columns stack, and a
topic is never split across two sheets. Everything else prints as designed —
A4, 14mm/12mm margins.

## Commands

```bash
pnpm dev            # development with live reload
pnpm check          # TypeScript, no emit
pnpm test           # Vitest
pnpm build          # production bundle
pnpm start          # run the production build
pnpm setup:notion   # create the Meeting Prep database
```

`pnpm test` skips the live Notion connection tests until `NOTION_API_TOKEN` and
`NOTION_DATABASE_ID` are set.
