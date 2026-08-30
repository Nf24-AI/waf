# Deploying Waf to Vercel

## Current deployment

Project `waf` on the `NF` team, from the private repo `Nf24-AI/waf`.

**Vercel Deployment Protection is on**, so every request redirects to Vercel SSO
and only someone with access to the account can open the site. It is what
protects the meetings before `APP_PASSWORD` is set. Turning it off makes the
site genuinely public — do not, until the blocker below is settled.

## Before you deploy — one thing that is not optional

**Set `APP_PASSWORD`.**
Without it the workspace is open and anyone with the URL can read, edit and
archive your meetings. The gate only appears when this is set, and the idle
lock below only runs when the gate exists.

## The fonts — settled, no longer a blocker

This used to say the fonts were not cleared for a public origin. They are now.
`scripts/embed-fonts.ts` inlines the four faces the design uses into
`tokens/fonts.css` as data URIs, so the build emits no font files, and the raw
sources are neither tracked nor in git history. See
`client/src/design-system/FONT-LICENSE.md` for how that maps onto the licence.
Confirm before any deploy that ships a font change:

```bash
find dist/public -name "*.woff2"          # must print nothing
git rev-list --all --objects | grep assets/fonts   # must print nothing
```

## The idle lock

Past the gate, the workspace locks itself after `IDLE_MINUTES` (shared/const.ts)
with nothing happening on the page, asking first for the last `IDLE_WARN_MS`.

Two clocks have to agree for this to be safe. The server expires the session
token after the same window and slides it forward on every authenticated
request; the browser watches for activity. They disagree while someone types a
long note, because saving here is a button and not an autosave — so the page
pings `auth.touch` on activity, at most twice a window, to keep them in step.
Without that ping, Save fails as UNAUTHORIZED with the note still unsaved.

## Environment variables to add in Vercel

| Variable | Value |
| --- | --- |
| `NOTION_API_TOKEN` | the integration secret (`ntn_…`) |
| `NOTION_DATABASE_ID` | the Meeting Prep database id |
| `APP_PASSWORD` | a password you choose |
| `JWT_SECRET` | a long random string, used to sign the session cookie |
| `NODE_ENV` | `production` |

Never commit these. `.env` is git-ignored.

## Steps

```bash
vercel login          # interactive — run this yourself
vercel link           # link this directory to a new project
vercel env add NOTION_API_TOKEN production
vercel env add NOTION_DATABASE_ID production
vercel env add APP_PASSWORD production
vercel env add JWT_SECRET production
vercel --prod
```

## How it is wired

Vercel does not run a long-lived server, so the Express app is split:

- `server/_core/app.ts` builds the API and binds no port.
- `server/_core/index.ts` adds Vite or static files and calls `listen` — local only.
- `api/index.ts` exports the same app as a serverless function.
- `vercel.json` sends `/api/trpc/*` to that function and everything else to the
  built client in `dist/public`.

## Known limits of the serverless shape

The Notion adapter spaces its requests to respect Notion's rate limit, and that
spacing is per-instance. Several concurrent lambdas each keep their own queue,
so heavy parallel use could still hit a 429. For one user this does not arise.
