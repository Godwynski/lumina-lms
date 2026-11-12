# Lumina LMS — Testing Suite Architecture

This directory houses system-level integration, adversarial concurrency, security (RLS), and invariant verification test suites for Lumina LMS.

---

## 🏗️ Test Structure

The codebase uses the following test organization powered by [Vitest](https://vitest.dev/):

1. **Unit & Server Action Tests (`lib/**/__tests__/` & colocated `*.test.ts`):**
   - Individual server actions (`lib/actions/__tests__/`): Catalog, Circulation, Dashboard, History, Reservations, Users, Analytics, Attendance.
   - Core utility libraries (`lib/__tests__/`, `lib/api-utils.test.ts`, `lib/auth-helpers.test.ts`, etc.): Session resolution, error serialization, token validation.
   - Route handlers (`app/api/**/__tests__/`): Admin endpoints and webhooks.

2. **Integration & Adversarial Suites (`test/`):**
   - **Circulation & Concurrency:** [`actions-circulation-adversarial.test.ts`](./actions-circulation-adversarial.test.ts), [`circulation-reservations-adversarial.test.ts`](./circulation-reservations-adversarial.test.ts)
   - **Real database (RLS, triggers, SQL functions):** [`db-real.test.ts`](./db-real.test.ts) runs `supabase/schema_clean_install.sql` in real Postgres (PGlite, no Docker). Known bugs are `it.fails` until fixed.
   - **Security:** [`challenger-m2-it2-security.test.ts`](./challenger-m2-it2-security.test.ts)
   - **Navigation & Loading States:** [`navigation-and-loading-states.test.ts`](./navigation-and-loading-states.test.ts)
   - **Realtime & Freshness:** [`realtime-invariants-and-freshness.test.ts`](./realtime-invariants-and-freshness.test.ts)
   - **Role-Based Access Control:** [`role-by-role-execution.test.ts`](./role-by-role-execution.test.ts), [`with-auth-api-adversarial.test.ts`](./with-auth-api-adversarial.test.ts)

3. **Mocks & Test Fixtures (`test/mocks/`):**
   - [`supabase.ts`](./mocks/supabase.ts): Hermetic chained Supabase query builder mock supporting filters, joins, pagination, and error injection.

---

## 🚀 Running Tests

```bash
# Run test suites in a checkout without nested worktrees
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test suite
npx vitest run test/actions-circulation-adversarial.test.ts

# Generate V8 coverage report
npm run test:coverage
```

## Nested worktrees and verification scope

This repository can contain other checkouts under .claude/worktrees. Exclude them when collecting tests for the current checkout.

~~~powershell
npx vitest run --exclude '**/.claude/**'
npx vitest run --exclude '**/.claude/**' lib/actions/__tests__/users.test.ts
npm run typecheck
npm run lint
~~~

Use the reported totals and failures from the current run. A targeted suite does not establish full-suite status. Database suites use the test configuration and fixtures in this directory. Inspect setup before running a suite against any external service.
