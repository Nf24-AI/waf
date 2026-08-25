# Project TODO

- [x] Establish Arabic RTL visual system with elegant editorial styling, typography, spacing, and responsive layout
- [x] Build meeting dashboard with active-meeting selection and preparation/presentation navigation
- [x] Build Edit Mode with structured meeting metadata, agenda sections, talking points, notes, and action items
- [x] Add inline controls for adding, editing, reordering, and removing agenda items and action items
- [x] Build Display Mode as a clean, presentation-ready meeting view with no editing controls
- [x] Add clear loading, empty, and connection-error states for the prototype before Notion is connected
- [x] Add local prototype data flow and architecture that can later connect to Notion as the source of truth
- [x] Add automated tests for core meeting data behavior and UI-facing route contracts
- [x] Verify responsive layouts and visual polish in desktop and mobile previews
- [x] Save final project checkpoint for handoff

- [x] Implement agenda and action-item reordering controls
- [x] Add real prototype loading and connection-error states with retry behavior
- [x] Refactor meeting data into a reusable adapter-ready store for future Notion integration
- [x] Add route and workspace interaction test coverage

- [x] Wire a reachable prototype loading flow during workspace initialization
- [x] Make the connection-error trigger visible and retryable
- [x] Connect Home.tsx to the adapter-backed prototype meeting source
- [x] Add route and interaction contract tests for preparation and presentation modes

- [x] Add tests for display-mode navigation, list reordering, loading transition, and connection retry behavior

- [x] Simplify the workspace visual language and reduce decorative density
- [x] Add a clear Arabic/English language toggle for core labels and controls
- [x] Keep essential meeting basics visible together in the preparation view
- [x] Rebuild Display Mode as a compact single-page presentation layout with no page scrolling
- [x] Add compact display overflow handling for long agendas and text
- [x] Re-test desktop, mobile, and display-mode behavior after the simplification

- [x] Complete bilingual coverage for core preparation labels, field labels, empty/error/loading copy, and metadata
- [x] Add real compact overflow handling for long presentation content
- [x] Re-run post-refinement desktop and mobile visual verification for both modes

- [x] Connect meeting persistence to Notion with a configurable database adapter
- [x] Add a full-screen presentation control with graceful browser fallback
- [x] Add ready-to-use meeting templates for internal, partner, leadership, and other meetings
- [x] Add tests and visual verification for Notion states, templates, and full-screen mode

- [x] Fix rendered workspace tests to provide the tRPC context required by the Notion-aware Home page

- [x] Persist and hydrate time, agenda items, notes, and action items in Notion so it is the full source of truth
- [x] Add a fourth general/other meeting template in Arabic and English
- [x] Add rendered tests for the full-screen toggle and unsupported-browser fallback

- [x] Assert the user-visible unsupported-browser fallback for full-screen mode

- [x] Add an in-app UI customization panel for theme, accent, density, and presentation preferences
- [x] Persist UI preferences locally and apply them to preparation and display modes
- [x] Add clear reset-to-default behavior and bilingual customization labels
- [x] Test customization interactions and responsive behavior

- [x] Add rendered tests for accent, content density, display density, and reset-to-default behavior
- [x] Run fresh desktop and mobile visual verification after the customization panel changes

- [x] Capture the customization panel visibly open on desktop and mobile, plus compact display mode after a preference change

- [x] Keep the workspace visible while authenticated Notion data loads, showing sync status without blocking the prototype UI

- [x] Add an explicit non-blocking Notion syncing indicator while the workspace remains usable
- [x] Test the syncing indicator and capture display mode after switching to compact display density

- [ ] Assemble a sanitized source bundle containing client/src, server, shared, drizzle, and configuration files
- [ ] Add a safe .env.example with variable names only and no credential values
- [ ] Include README.md and package metadata while excluding node_modules, .env, logs, and generated secrets
- [ ] Verify the bundle contains no token or secret values before delivery
