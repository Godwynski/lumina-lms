# Lumina LMS — Zero-Cheat Behavioral Test Suite

All tests execute real production code against real Postgres (PGlite), mocked Supabase/Next boundaries, API route handlers, or jsdom React 19 renders. See `AGENTS.md` and `.agents/rules/testing-and-verification.md` for mandatory rules.

## Suite Layout

1. **Real Postgres Schema, RLS, Triggers & RPCs (`test/`):**
   - `test/db-schema-and-rls.test.ts` — Schema defaults, triggers (`handle_new_user`, `sync_book_available_copies`), helper functions, and per-role RLS enforcement (`anon`, `student`, `student_assistant`, `librarian`, `super_admin`, `service_role`).
   - `test/db-rpcs-and-triggers.test.ts` — `process_qr_checkout`, `process_qr_return`, `get_borrowing_history_v2`, reservation promotion, catalog RPCs, expiry, and annual reset.
2. **Core Utilities, Auth, Permissions & Services (`lib/__tests__/`):**
   - `lib/__tests__/utils-and-mappers.test.ts`
   - `lib/__tests__/auth-and-permissions.test.ts` (including `proxy.ts`)
   - `lib/__tests__/api-and-error-utils.test.ts`
   - `lib/__tests__/services-and-assets.test.ts`
3. **Server Actions (`lib/actions/__tests__/`):**
   - `lib/actions/__tests__/circulation.test.ts`
   - `lib/actions/__tests__/history.test.ts`
   - `lib/actions/__tests__/reservations.test.ts`
   - `lib/actions/__tests__/attendance.test.ts`
   - `lib/actions/__tests__/catalog-and-books.test.ts`
   - `lib/actions/__tests__/users-and-profile.test.ts`
   - `lib/actions/__tests__/dashboard-and-analytics.test.ts`
4. **API Route Handlers & Auth Routes (`test/`):**
   - `test/api-admin-routes.test.ts`
   - `test/api-catalog-and-circulation-routes.test.ts`
   - `test/api-auth-and-user-routes.test.ts`
5. **Custom Hooks & React 19 UI Components (`test/`):**
   - `test/hooks.test.tsx`
   - `test/ui-circulation-and-history.test.tsx`
   - `test/ui-admin-catalog-and-attendance.test.tsx`
6. **Helpers & Mocks:**
   - `test/setup.ts` — Environment defaults and `@testing-library/jest-dom`.
   - `test/mocks/supabase.ts` — Chained Supabase query/RPC mock.
   - `test/helpers/render.tsx` — React 19 `createRoot` + `act` DOM test helpers.

## Running Verification

```powershell
npx vitest run --exclude '**/.claude/**'
npm run typecheck
```
