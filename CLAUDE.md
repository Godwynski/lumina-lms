# Lumina LMS — Agent Engineering & Mandatory Testing Rules

Read `AGENTS.md` (including Next.js version guidance in `node_modules/next/dist/docs/`) and `.agents/rules/testing-and-verification.md` before modifying code.

## Mandatory Testing & Zero-Cheating Standard

Every code change—**major or minor** (features, bugfixes, UI states, hooks, server actions, API routes, utilities, SQL migrations/RPCs)—MUST include or update automated behavioral tests covering every modified or newly added behavior:

1. **Test every functionality (major and minor):** Happy paths, invalid/malformed inputs, edge/boundary cases, and role/permission enforcement.
2. **No source-code regex tests:** NEVER use `fs.readFileSync` on `.ts` or `.tsx` source files to assert regexes. Import and execute the real function, action, route handler, hook, or React component. (Reading `.sql` files to boot PGlite in `test/db-*.test.ts` is the only allowed file read.)
3. **No skipped or masked failures:** NEVER commit `it.skip`, `describe.skip`, `it.todo`, `it.fails`, or `.only`.
4. **No self-mocking or tautologies:** Mock only external boundaries (`@/lib/supabase/*`, `next/navigation`, `next/cache`, fetch/nodemailer), never the code under test.
5. **Never weaken assertions:** When a test fails, fix the production bug unless the spec itself intentionally changed.
6. **React 19 DOM tests:** `@testing-library/react` is NOT installed in this repo (`@testing-library/jest-dom` IS loaded via `test/setup.ts`). Use `test/helpers/render.tsx` (`react-dom/client` `createRoot` + `act`) for UI and hook tests.
7. **Database / SQL changes:** Any edit to `supabase/` migrations, RLS policies, triggers, or RPCs must also sync `supabase/schema_clean_install.sql` and pass real Postgres PGlite tests in `test/db-*.test.ts`.
8. **Mandatory verification before finishing:** Run `npx vitest run --exclude '**/.claude/**'` and `npm run typecheck` (`npx tsc --noEmit`), and report exact counts.
9. **Knowledge graph:** After modifying code files, run `graphify update .` (per `.agents/rules/graphify.md`).
