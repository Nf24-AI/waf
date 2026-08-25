# Deploying Waf to Vercel

## Current deployment

Project `waf` on the `NF` team, from the private repo `Nf24-AI/waf`.

**Vercel Deployment Protection is on**, so every request redirects to Vercel SSO
and only someone with access to the account can open the site. Keep it on: it is
what keeps the bundled fonts from being downloadable by third parties, and what
protects the meetings before `APP_PASSWORD` is set. Turning it off makes the
site genuinely public — do not, until both blockers below are settled.

## Before you deploy — two things that are not optional

**1. The fonts are not cleared for a public origin.**
See `client/src/design-system/FONT-LICENSE.md`. The thmanyah licence forbids
serving the font files where third parties can download them, which is exactly
what a public Vercel URL does. Either clear it with `ask@thmanyah.com`, or keep
the deployment behind Vercel's Deployment Protection.

**2. Set `APP_PASSWORD`.**
Without it the workspace is open and anyone with the URL can read, edit and
archive your meetings. The gate only appears when this is set.

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
