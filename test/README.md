# Lumina LMS — Testing Suite Architecture

This directory houses system-level integration, adversarial concurrency, security (RLS), and invariant verification test suites for Lumina LMS.

---

## 🏗️ Test Structure

The codebase utilizes a dual-tier testing organization powered by [Vitest](https://vitest.dev/):

1. **Unit & Server Action Tests (`lib/**/__tests__/` & colocated `*.test.ts`):**
   - Individual server actions (`lib/actions/__tests__/`): Catalog, Circulation, Dashboard, History, Reservations, Users, Analytics, Attendance.
   - Core utility libraries (`lib/__tests__/`, `lib/api-utils.test.ts`, `lib/auth-helpers.test.ts`, etc.): Session resolution, error serialization, token validation.
   - Route handlers (`app/api/**/__tests__/`): Admin endpoints and webhooks.

2. **Integration & Adversarial Suites (`test/`):**
   - **Circulation & Concurrency:** [`actions-circulation-adversarial.test.ts`](./actions-circulation-adversarial.test.ts), [`circulation-reservations-adversarial.test.ts`](./circulation-reservations-adversarial.test.ts)
   - **Security & RLS Hardening:** [`challenger-m2-rls-hardening.test.ts`](./challenger-m2-rls-hardening.test.ts), [`challenger-m2-it2-security.test.ts`](./challenger-m2-it2-security.test.ts)
   - **Relational Integrity & Triggers:** [`challenger-m1-constraints.test.ts`](./challenger-m1-constraints.test.ts), [`challenger-m1-2-seed-triggers.test.ts`](./challenger-m1-2-seed-triggers.test.ts)
   - **Navigation & Loading States:** [`navigation-and-loading-states.test.ts`](./navigation-and-loading-states.test.ts)
   - **Realtime & Freshness:** [`realtime-invariants-and-freshness.test.ts`](./realtime-invariants-and-freshness.test.ts)
   - **Role-Based Access Control:** [`role-by-role-execution.test.ts`](./role-by-role-execution.test.ts), [`with-auth-api-adversarial.test.ts`](./with-auth-api-adversarial.test.ts)

3. **Mocks & Test Fixtures (`test/mocks/`):**
   - [`supabase.ts`](./mocks/supabase.ts): Hermetic chained Supabase query builder mock supporting filters, joins, pagination, and error injection.
   - [`query-chaining.test.ts`](./mocks/query-chaining.test.ts) & [`stress.test.ts`](./mocks/stress.test.ts): Mock fidelity validation.

---

## 🚀 Running Tests

```bash
# Run all test suites (49 files, 1,070+ tests)
npm test

# Run tests in watch mode
npm run test:watch

# Run a specific test suite
npx vitest run test/actions-circulation-adversarial.test.ts

# Generate V8 coverage report
npm run test:coverage
```
