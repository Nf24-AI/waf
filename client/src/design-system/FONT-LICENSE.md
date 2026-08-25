# thmanyah font licence — how this project complies

The thmanyah typeface is © 2026 thmanyah Publishing and Distribution
(<https://thmanyah.com>, ask@thmanyah.com).

## What the licence says

**Permitted** — the font is free to use, including commercially, in websites
and applications. There is no fee.

**Conditional** — embedding in a website or web application is allowed *"only
as part of a compiled, packaged, or obfuscated product."*

**Prohibited** — making the font available *"in any manner that allows end
users or third parties to extract, download, access, reuse, or redistribute the
Font Software independently as font files, including through web embedding."*
It also forbids uploading or hosting the files on any server or platform.

## How this project satisfies that

A normal Vite build emits each `.woff2` as a standalone asset under `/assets/`,
which any visitor can download directly. That is the prohibited shape, so:

- `scripts/embed-fonts.ts` inlines the faces into `tokens/fonts.css` as data
  URIs. The build ships **zero** font files — verify with
  `find dist/public -name "*.woff2"`.
- The raw `.woff2` sources are git-ignored and were purged from history, so they
  are not hosted on GitHub either.
- Only the four faces the design uses are embedded: Sans and Serif Display at
  Regular and Medium. The other eleven were being served for nothing.

## Changing which weights are used

Put the `.woff2` files back in `assets/fonts/` (from thmanyah.com or the design
system bundle), edit the `FACES` list in `scripts/embed-fonts.ts`, then:

```bash
pnpm fonts:embed
```

Commit the regenerated `tokens/fonts.css`. Never commit the `.woff2` files.

## If the repository ever becomes public

Nothing needs to change — the font sources are neither tracked nor in history.
Confirm with `git rev-list --all --objects | grep assets/fonts`.
