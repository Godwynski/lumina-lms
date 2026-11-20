<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mandatory Testing & Zero-Cheating Standard (All Agents)

Every code change in this repository—**major or minor**—MUST add or update automated behavioral tests that exercise the changed behavior before completion.

### Zero-Cheating Rules (Strictly Enforced)
1. **No source-code regex tests:** Never use `fs.readFileSync` on `.ts`/`.tsx` files to assert patterns against source code. Import and run the real function, server action, route handler, hook, or React component. (Reading `.sql` files to initialize PGlite Postgres in `test/db-*.test.ts` is the only allowed file read.)
2. **No skipped or masked tests:** Never leave `it.skip`, `describe.skip`, `it.todo`, `it.fails`, `test.skip`, or `.only`.
3. **No self-mocking or tautologies:** Never mock the unit under test or assert `expect(true).toBe(true)`. Mock only external boundaries (`@/lib/supabase/*`, `next/navigation`, `next/cache`, network/mail).
4. **Fix bugs, don't weaken tests:** If a test fails because production code is buggy, fix production code—never delete or weaken assertions.
5. **Verify before finishing:** Always run `npx vitest run --exclude '**/.claude/**'` and `npm run typecheck`, and report exact pass/fail counts.

### Project Test Architecture
- **Real Postgres (PGlite):** `test/db-*.test.ts` (loads `supabase/schema_clean_install.sql` in-process with `@electric-sql/pglite` to test schemas, triggers, RPCs, and RLS across roles).
- **Core libraries, auth, permissions & middleware:** `lib/__tests__/*.test.ts`
- **Server actions:** `lib/actions/__tests__/*.test.ts` (uses `test/mocks/supabase.ts`)
- **API route handlers & auth callbacks:** `test/api-*.test.ts` (invokes exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE` handlers with `NextRequest`/`Request`)
- **Custom hooks & React 19 UI components:** `test/hooks.test.tsx`, `test/ui-*.test.tsx` (uses `test/helpers/render.tsx` with `react-dom/client` `createRoot` + `act`; note `@testing-library/react` is NOT installed—only `@testing-library/jest-dom` matchers are loaded in `test/setup.ts`).

### Verification Commands
- `npx vitest run --exclude '**/.claude/**'`
- `npm run typecheck`
