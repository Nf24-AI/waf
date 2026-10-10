# Deploying Waf to Vercel

## Current deployment

Project `waf` on Vercel, from the repo `Nf24-AI/waf`, served at
<https://waf-silk.vercel.app>. Every merge to `main` deploys to production;
every other branch gets a preview.

The site is public: the home page and sign-in are open, and everything else
needs an account. Vercel Deployment Protection must stay off for production,
or sign-up emails and share links lead to a Vercel login instead of the app.

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

A signed-in page locks itself after `IDLE_MINUTES` (shared/const.ts) with
nothing happening on it, asking first for the last `IDLE_WARN_MS`. Locking
signs the account out, so the next visit starts at sign-in.

## Environment variables in Vercel

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | the Supabase project URL |
| `SUPABASE_ANON_KEY` | its anon key |
| `VITE_SUPABASE_URL` | the same URL, for the browser |
| `VITE_SUPABASE_ANON_KEY` | the same anon key, for the browser |
| `NOTION_API_TOKEN` | the integration secret (`ntn_…`) |
| `NOTION_DATABASE_ID` | the meetings database id |

Never commit these. `.env` is git-ignored.

## Database changes

SQL lives in `scripts/waf-*.sql` and is run by hand in the Supabase SQL editor.
Each file can be run again safely, and the code keeps working before a new
column exists, so the order of "merge" and "run the SQL" does not matter.

## How it is wired

Vercel does not run a long-lived server, so the Express app is split:

- `server/_core/app.ts` builds the API and binds no port.
- `server/_core/index.ts` adds Vite or static files and calls `listen` — local only.
- `server/vercel-entry.ts` exports the same app; the build bundles it to `api/index.js`.
- `vercel.json` sends `/api/trpc/*` to that function and everything else to the
  built client in `dist/public`.

## Known limits of the serverless shape

The Notion adapter spaces its requests to respect Notion's rate limit, and that
spacing is per-instance. Several concurrent lambdas each keep their own queue,
so heavy parallel use could still hit a 429. For one user this does not arise.
