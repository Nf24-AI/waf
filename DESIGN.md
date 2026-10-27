# Waf — design rules

Waf (وَاف, from وَفَى: to fulfil, to see through) is a set of tools for project
managers and product owners, Arabic-first with an English toggle. Every page
follows this file.

## The idea in one line

Meetings end in decisions that have owners; time is arranged so you keep what
you committed to. The interface is calm and exact. It is a work tool.

## Palette — "Tanomah at dusk"

Taken from the photo of Tanomah village at dusk (`src/assets/village-at-dusk.jpg`):
night sky, saffron horizon, light in the stone. Tokens live in
`src/styles/index.css`. Use the Tailwind names, never raw hex in components.

| Token | Role |
|---|---|
| `bg` / `sheet` / `sunk` | page / raised surface / recessed well (inputs groups, tracks) |
| `line` / `line-strong` | hairlines and borders; strong for hover and dividers that carry structure |
| `ink` / `ink-2` / `ink-3` | text: primary / secondary / tertiary (hints, meta) |
| `inverse` / `on-inverse` | the primary button (ink on light, light on dark) |
| `saffron` (+`-ink`, `-wash`, `on-saffron`) | **"now" and the one thing in focus.** The current time, the running timer, the active step, the single main call to action on a page. Never decoration. |
| `dusk` (+`-wash`) | links, selection, deep work, the "plan" quadrant |
| `palm` (+`-wash`) | done, positive |
| `ember` (+`-wash`) | urgent, destructive, errors |
| `plum`, `slate` (+`-wash`) | extra category tones |

Mappings used across the product:
- Quadrants: do → ember, plan → dusk, delegate → saffron, drop → slate.
- Categories: deep → dusk, meeting → saffron, personal → palm, project → plum, other → slate.
- Meeting status: draft → slate, ready → dusk, done → palm.

Light ("morning mist") and dark ("Tanomah night") are both first-class; the
theme follows the device unless the user picks one. Check both.

## Type

- `font-display` = Reem Kufi (geometric Kufi): page titles, section titles,
  big numbers (timer, stats), the wordmark. Keep display text short.
- `font-ui` = Readex Pro (default): everything else.
- Scale (`text-2xs … text-4xl`): 12, 13, 15, 16, 19, 24, 30, 40, 56 px.
- Numbers that change (times, counts, timers) use the `tnum` class.
- No ALL-CAPS labels, no eyebrow label above every heading, no single word
  coloured inside a headline, no "A · B · C" meta strings, no "→" appended to
  buttons.

## The signature: the day line

`<DayLine />` (`src/ui/DayLine.tsx`) is the horizon from the photo used as a
ruler: 06:00 → 24:00, filled with saffron up to now, today's appointments as
small ticks. It sits on the bottom edge of the app header on every page. Pages
may echo it (the time-blocking "now" line, the focus progress, the meeting
timer) in saffron. Nothing else on a page competes with it.

## Shape and surfaces

- Radii by hierarchy: `rounded-sm` (6px) controls and chips, `rounded-md`
  (10px) panels, `rounded-lg` (18px) big sheets and dialogs. `rounded-full` for
  pills and avatars only.
- Structure comes from hairlines (`border-line`, `divide-line`) and
  whitespace, not from stacks of identical shadowed cards. Use `sheet` for a
  surface that really is raised (an editor, a dialog, a column). Lists are
  rows with dividers.
- Shadow only on floating things (`shadow-[var(--shadow-float)]`): menus,
  dialogs, dragged items.
- Content width: app pages `max-w-6xl` (wide pages `max-w-[96rem]`), prose
  under ~70ch.

## Motion (Emil Kowalski's rules)

- Easing tokens: `--ease-out` (enter/exit, default), `--ease-in-out`
  (on-screen movement), `--ease-drawer` (sheets). Never `ease-in`.
- Durations: press 160ms, small popovers 150–200ms, dialogs 200–260ms, drawers
  ~380ms. UI motion stays under 300ms.
- Every pressable thing has the `press` class (scale 0.97 on active).
- Animate only `transform` and `opacity` (and `clip-path`). Never `transition: all`.
- Hover effects only under `@media (hover:hover)` when they move things.
- Nothing animates on keyboard-driven actions or on things seen 100× a day.
- One orchestrated moment per page at most (the landing draws the horizon once).
- `prefers-reduced-motion`: drop movement, keep opacity/colour.

## Mobile

- Bottom tab bar under `md`; content has `pb-28` to clear it.
- Touch targets ≥ 44px. Inputs ≥ 16px font on mobile (set globally).
- Safe areas: `env(safe-area-inset-*)` on fixed bars.
- Dialogs become bottom sheets under `sm` (built into `ui/Dialog`).
- No hover-only affordances: anything revealed on hover must also be reachable
  by tap and by keyboard.

## Words

- Write for the person using it, in plain Arabic, active voice. Buttons say
  exactly what happens: «احفظ الاجتماع» not «إرسال».
- The same action keeps the same name: button «أنجزتُها» → toast «أُنجزت».
- Empty states invite the next action. Errors say what happened and how to fix
  it, without apologising.
- Every string is written as `t("عربي", "English")` (see `src/lib/i18n.ts`).

## Building blocks

`src/ui`: `Button`, `ButtonLink`, `IconButton` (label required), `Field` +
`Input` / `TextArea` / `Select`, `Segmented`, `Dialog` / `Confirm`, `Empty`,
`Failure`, `Loading`, `Skeleton`, `DayLine` + `useNow`, `Wordmark`,
`LangToggle`, `ThemeToggle`, `cx`. Page frame: `AppShell` + `PageHead`
(`src/app/AppShell.tsx`). Toasts: `sonner`'s `toast()`. Icons: `lucide-react`
at `strokeWidth` 1.75, size 16–20.
