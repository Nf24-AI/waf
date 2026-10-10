# Waf — واف

Tools for the project manager and product owner, in Arabic and English.
Live at <https://waf-silk.vercel.app>.

## What is in it

| Service | Route | Data |
|---|---|---|
| Meetings: prepare, present, decision log, status report | `/meetings`, `/display`, `/decisions`, `/status` | Notion |
| Time management: three separate frameworks | `/time-management` | Supabase |
| Service directory | separate app, linked from the home page | its own |

The three time frameworks are used on their own. Each keeps its own tasks
(`origin` on the row) and its own design; none links to another.

- Eisenhower matrix — `/time-management/eisenhower`
- Time blocking — `/time-management/time-blocking`
- Focus session — `/time-management/focus`

## Accounts

Sign-in is Supabase Auth (email and password). The server calls Supabase with
the signed-in user's own token, so row-level security decides what each
account reads — there is no service key in the app.

Meetings live in one Notion database with no owner column, so they are limited
to accounts with `profiles.can_access_meetings = true`. A read-only share link
is the only way in without an account, and it opens one meeting.

## Setup

```bash
corepack pnpm install
cp .env.example .env     # fill in the values below
corepack pnpm dev        # http://localhost:3000
```

**Supabase.** Create a project, put its URL and anon key in `.env` (both the
plain and the `VITE_` names), then run the SQL files in `scripts/` in this
order: `waf-auth.sql`, `waf-tasks.sql`, `waf-task-options.sql`,
`waf-workspace.sql`, `waf-timeblock.sql`, `waf-task-origin.sql`. Each one can
be run again safely. The code does not wait for the later ones: a column that
is not there yet is left out of the request until it is.

**Notion.** Create an integration at
[notion.so/my-integrations](https://www.notion.so/my-integrations), connect it
to the page that should hold the database, set `NOTION_API_TOKEN` and
`NOTION_PARENT_PAGE_ID`, and run `corepack pnpm setup:notion`. It creates the
database and prints the `NOTION_DATABASE_ID` to add. Run it again later and it
adds only the properties that are missing. An existing database works too: the
adapter matches properties by type, so Arabic or English names both work.

## Layout

- `client/src/pages` — one file per page; `auth/` holds sign-in and its relatives
- `client/src/design-system` — tokens and the stylesheets of each framework
- `client/src/lib/i18n.ts` — the language option (`t(ar, en)`)
- `server/routers.ts` — tRPC procedures
- `server/tasks.ts` — tasks and focus sessions on Supabase
- `server/notion.ts` — the Notion adapter for meetings
- `server/workspace.ts` — who may open the meetings
- `shared/` — models and pure logic used by both sides
- `scripts/` — SQL migrations, Notion setup, font embedding

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

## Read-only share links

Each meeting can be handed to someone outside the workspace. The selected
meeting has a **رابط للقراءة فقط** panel: create the link, copy it, send it.

What the holder of a link gets:

- The meeting page, read-only. No editing, no timer, no marking topics covered.
- **Not** your preparation notes (`note`), and not the token itself.
- **Not** the rest of your meetings. The token names one meeting; there is no
  list behind the page and no id to substitute.

The link expires at the end of the day after the meeting, derived from the
meeting's own date — so a meeting must have a date before it can be shared.
**إيقاف المشاركة** retires a link immediately, which is also how a leaked one
is killed before it would expire on its own.

Everything else stays behind sign-in. `meetings.shared` is the only public
procedure and it is a query; issuing and retiring links need the workspace
owner, like every other meeting write.

The token lives in a `Share` rich_text property in Notion. The first link
issued adds the property if the database does not have it yet.

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
corepack pnpm dev            # development with live reload
corepack pnpm check          # TypeScript, no emit
corepack pnpm test           # Vitest
corepack pnpm build          # production bundle
corepack pnpm setup:notion   # create or repair the meetings database
```

`pnpm test` skips the live Notion connection tests until `NOTION_API_TOKEN` and
`NOTION_DATABASE_ID` are set. Deployment is described in `DEPLOY.md`.
