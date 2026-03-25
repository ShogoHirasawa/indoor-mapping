# Indoor Mapping

## Language

All user-facing UI text (labels, buttons, toasts, alerts, placeholders, error messages) must be in **English**. Do not use Japanese or any other language in the UI.

## Project overview

CGM-style (like OpenStreetMap) indoor mapping platform. Any logged-in user can create, edit, and delete indoor data. Unauthenticated users can browse and view data but cannot edit.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Supabase (PostgreSQL + PostGIS + Auth)
- MapLibre GL via react-map-gl
- Zustand for state management

## Key conventions

- Database schema lives in `supabase/migrations/`
- API routes under `app/api/indoor/` use Supabase RLS for access control
- The "Global" organization (`c0eebc99-0000-4ef8-bb6d-6bb9bd380a11`) is the shared OSM-style space all users join automatically

## Git workflow

- Follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages
  - Format: `<type>(<scope>): <description>` (e.g. `feat(auth): allow unauthenticated users to browse data`)
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`
  - Include body for non-trivial changes explaining **why**, not just what
- **Always create a new branch before making any changes** — even without explicit instruction. Never commit directly to `main`
- Create a PR with a clear summary of changes so third parties can understand the intent
- Merge via PR after review (squash or merge commit, not rebase)
