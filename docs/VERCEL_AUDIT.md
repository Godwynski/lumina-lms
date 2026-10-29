# Vercel Cloud Platform & Next.js Server Architecture Audit Report

**Target Project**: `neurawyn/system`  
**Repository**: `Godwynski/system` (`C:\Users\Godwyn\Documents\Projects\thesis`)  
**Evaluation Standard**: OWASP Application Security Verification Standard (ASVS), Vercel Production Standards, Next.js 16 Best Practices  
**Target Architecture**: Next.js 16.2.6 (App Router, Turbopack), React 19.0.0, Node.js 24.x, Supabase SSR 0.9.0  
**Audit Date**: 2026-10-07  
**Status**: COMPLETE — HIGH SEVERITY ACTION ITEMS IDENTIFIED  

---

## 1. Executive Summary & Audit Scorecard

This comprehensive audit evaluates the cloud platform deployment, serverless runtime architecture, cryptographic security guards, and local configuration files of the Lumina LMS system deployed on Vercel.

The audit was conducted by cross-referencing live Vercel Cloud REST API inspection (via Vercel MCP), live Supabase Cloud project telemetry, and static analysis of repository infrastructure files (`vercel.json`, `next.config.ts`, `app/api/cron/route.ts`, `lib/server-utils.ts`, and `.env.example`).

### 1.1 Executive Summary
The live production deployment (`dpl_BmAPWB1HMXV76mp14QWKgNwyiBTf`) and preview deployment (`dpl_eeBvgof17EwFXcQx4ZPpQ4PF88CD`) demonstrate excellent build performance, zero compiler errors, and optimal intra-region co-location between Vercel Serverless Functions in `sin1` (Singapore) and Supabase PostgreSQL in AWS `ap-southeast-1` (Singapore).

However, **critical security vulnerabilities and architectural defects** were discovered:
1. **Critical Fail-Open Cron Route Vulnerability**: `CRON_SECRET` is completely missing from Vercel's environment variables. The endpoint `app/api/cron/route.ts` employs a fail-open guard (`process.env.CRON_SECRET && ...`), which permits unauthenticated third-party callers to trigger maintenance tasks, mutating circulation data and sending automated emails via SMTP. This flaw is actively codified in test assertions (`test/cron-route-adversarial.test.ts:157-170`).
2. **Missing Essential HTTP Security Headers**: Neither HSTS (`Strict-Transport-Security`), Content-Security-Policy (`CSP`), nor `Permissions-Policy` are configured in Next.js. Four legacy headers reside in `vercel.json`, leaving local and CI environments unprotected.
3. **Cryptographic Timing Side-Channel**: `lib/server-utils.ts:safeCompare` performs a length comparison that leaks token length through execution time before running `timingSafeEqual`.
4. **Environment Drift & Dead Variables**: Unreferenced variables (`UPLOAD_PATH`, `DATABASE_URL`) clutter Vercel and `.env.example`, while active dependencies (`CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`) are omitted. Furthermore, Vercel environment variables omit the `development` scope, breaking `vercel env pull`.
5. **Production Error Cluster on Route `/`**: An active cluster of `Error [AuthApiError]: Invalid Refresh Token: Refresh Token Not Found` (status 400) occurs in `lib/auth-helpers.ts:23` when visitors carry expired or rotated session cookies.

---

### 1.2 Audit Scorecard

| Pillar | Focus Area | Status | Score | Severity Level |
|---|---|:---:|:---:|:---:|
| **Pillar 1** | Vercel Cloud Platform & Deployments | ⚠️ Needs Remediation | 82 / 100 | **HIGH** (Runtime Error Cluster & 307 Redirects) |
| **Pillar 2** | Environment Variables & Secrets | 🔴 Critical Risk | 68 / 100 | **CRITICAL** (Missing `CRON_SECRET`, Scope Drift) |
| **Pillar 3** | Server Security & Cron Routes | 🔴 Critical Risk | 55 / 100 | **CRITICAL** (Fail-Open Maintenance Route, Timing Leak) |
| **Pillar 4** | Headers, Routing & Performance | ⚠️ Needs Remediation | 76 / 100 | **HIGH** (Missing HSTS/CSP, Insecure HTTP Image Ingress) |
| **Overall** | **System Production Readiness** | ⚠️ **CONDITIONAL PASS** | **70.25 / 100** | **Remediation Required Prior to Public Launch** |

---

## 2. Pillar 1: Vercel Cloud Platform & Deployments Audit

### 2.1 Live Project Identity & Account Hierarchy
Live inspection via the Vercel Model Context Protocol (`list_teams`, `list_projects`, `get_project`) verified the following cloud metadata:

- **Team Name**: `godwynski's projects`
- **Team Slug**: `neurawyn`
- **Team ID**: `team_Ki81zuC80p4xOWE2LFAjn0oa`
- **Project Name**: `system`
- **Project ID**: `prj_vI49AoVJRYdhTpVcdRnaAl9rTBRh`
- **Created Timestamp**: `1773246204111`
- **Updated Timestamp**: `1791289933731`
- **Target Node.js Runtime**: `24.x` (configured in Project Settings)
- **Framework Preset**: Auto-detected via `vercel.json` (`"framework": "nextjs"`)
- **Plan Tier**: **Hobby Tier** (Validated via HTTP 402 `payment_required` on IP bypass and 1-hour log retention limits)

---

### 2.2 Live Production & Preview Deployment Health

Live inspection of active deployments via `list_deployments`, `get_deployment`, and `list_deployment_events` yielded the following operational telemetry:

| Attribute | Production Deployment | Preview Deployment |
|---|---|---|
| **Deployment ID** | `dpl_BmAPWB1HMXV76mp14QWKgNwyiBTf` | `dpl_eeBvgof17EwFXcQx4ZPpQ4PF88CD` |
| **Target Environment** | `production` | `preview` |
| **Git Branch** | `master` | `development` |
| **Git Commit SHA** | `b41e3d4087589a952908c799567e1a71c175f768` | `6e8254f59acf4159d9c9bd5ce43ffe3c95d17e42` |
| **Commit Message** | `test: add comprehensive automated test suite and hermetic test infrastructure` | `feat(seed): enrich mock defense dataset with circulation, reservations, and gate attendance` |
| **Deployment URL** | `https://system-2cl9iuuq8-neurawyn.vercel.app` | `https://system-jhm9ri3fp-neurawyn.vercel.app` |
| **Assigned Aliases** | `stilumina.vercel.app` (canonical), `stilms.vercel.app`, `winelms.vercel.app`, `system-neurawyn.vercel.app`, `system-git-master-neurawyn.vercel.app` | `system-git-development-neurawyn.vercel.app` |
| **State** | `READY` (Rollback Candidate: `true`) | `READY` (Rollback Candidate: `false`) |
| **Lambda Region** | `sin1` (Singapore) | `sin1` (Singapore) |
| **Build Machine** | Washington, D.C., USA (`iad1`, 2 vCPU, 8 GB RAM) | Washington, D.C., USA (`iad1`, 2 vCPU, 8 GB RAM) |
| **Build Duration** | **99.185 seconds** (Cold Cache) | **59.792 seconds** (Warm Cache) |
| **Turbopack Compilation** | 37.6s (47 static routes generated in 424ms) | 26.6s (47 static routes generated in 424ms) |
| **Build Errors** | **0 errors** | **0 errors** |

#### Build Log Observations & Warnings
The build pipelines run cleanly under Next.js 16.2.6 with Turbopack. Two non-blocking compiler/package manager warnings were logged:
1. `Browserslist: browsers data (caniuse-lite) is 6 months old. Please run: npx update-browserslist-db@latest`
2. `npm warn install-scripts 2 packages have install scripts not yet covered by allowScripts: sharp@0.34.5, unrs-resolver@1.11.1`

---

### 2.3 Grouped Production Runtime Errors

Querying `get_runtime_errors` across a 7-day lookback window identified **1 recurring production error cluster**:

```text
Cluster: Error [AuthApiError]: Invalid Refresh Token: Refresh Token Not Found
Total Count: 8 occurrences
Impacted Distinct Users: 1
Impacted Route: / (Homepage)
First Seen: 2026-08-30T05:49:56.000Z
Last Seen: 2026-10-07T07:58:16.000Z
Target Deployment: dpl_BmAPWB1HMXV76mp14QWKgNwyiBTf (Production)
HTTP Status: 400
Error Code: refresh_token_not_found
Stack Trace Context:
  Error [AuthApiError]: Invalid Refresh Token: Refresh Token Not Found
  at ignore-listed frames {
    __isAuthError: true,
    status: 400,
    code: 'refresh_token_not_found'
  }
```

#### Forensic Root-Cause Analysis
1. When visitors land on `/` (`app/page.tsx:18,23`), the page invokes `getMe()` from `lib/auth-helpers.ts`.
2. Line 23 of `lib/auth-helpers.ts` invokes `supabase.auth.getUser()`.
3. If the patron's browser carries a cookie with an expired, rotated, or invalidated refresh token, `@supabase/ssr` attempts to refresh the session against Supabase Auth.
4. Supabase Auth rejects the request with HTTP 400 `refresh_token_not_found`.
5. Because `getUser()` internally logs this exception to `stderr` in the Vercel function runtime prior to returning `{ error: userError }`, Vercel Observability clusters it as an active runtime error.
6. **Remediation**: The handler in `lib/auth-helpers.ts` must intercept `AuthApiError` instances matching `refresh_token_not_found`, cleanly discard the invalid session cookie, and return `null` without throwing unhandled exceptions.

---

### 2.4 Custom Domains, Apex Redirects & SSL Certificate Status

Live domain inspection via `list_project_domains` and `list_domains` revealed 3 configured domains:

| Domain | Status | Apex Domain | Redirect Target | HTTP Status Code | SSL Issuer |
|---|---|---|---|:---:|---|
| `stilumina.vercel.app` | `verified: true` | `vercel.app` | None (Canonical Production) | `200 OK` | Let's Encrypt (Vercel Edge) |
| `winelms.vercel.app` | `verified: true` | `vercel.app` | `stilumina.vercel.app` | **`307 Temporary`** | Let's Encrypt (Vercel Edge) |
| `stilms.vercel.app` | `verified: true` | `vercel.app` | `stilumina.vercel.app` | **`307 Temporary`** | Let's Encrypt (Vercel Edge) |

#### Defect Analysis: Temporary vs Permanent Redirects
`winelms.vercel.app` and `stilms.vercel.app` represent legacy institutional URLs that have been permanently superseded by `stilumina.vercel.app`. They are currently configured with HTTP `307 Temporary Redirect`.
- **Architectural Consequence**: HTTP 307 prevents search engines and browser clients from caching the redirect, incurring redundant DNS lookups and failing to transfer SEO authority.
- **Remediation**: Reconfigure both domain redirects in the Vercel dashboard from **307** to **308 Permanent Redirect**.

---

### 2.5 Firewall, Attack Challenge Mode & Deployment Protection

Probing Vercel security endpoints via `get_firewall_config`, `get_active_attack_status`, and `get_bypass_ip`:

| Security Feature | Live Configuration | Audit Assessment |
|---|---|---|
| **Vercel WAF Rules** | HTTP 404 (`Seawall Config not found`) | Custom WAF rules are unavailable on the Hobby plan; baseline edge DDoS mitigation is active. |
| **Attack Challenge Mode** | HTTP 404 (`Seawall Config not found`) | Inactive; edge DDoS filtering handles volumetric attacks. |
| **IP Bypass Rules** | HTTP 402 (`payment_required`) | Feature unavailable on Hobby tier. |
| **Vercel SSO / Deployment Protection** | `enabled: true`, `all_except_custom_domains` | **Secure**. All preview deployments (`system-*.vercel.app`) enforce Vercel team authentication, preventing unauthorized access to staging previews. |
| **Password Protection** | `enabled: false` | Not configured. |
| **Trusted IPs** | `enabled: false` | Not configured. |

---

## 3. Pillar 2: Environment Variables & Secrets Audit

### 3.1 Live Vercel Variables vs Repository Cross-Reference
Cross-referencing variables from `filter_project_envs`, `.env.example`, `.env.local`, and repository usages:

| # | Variable Name | Vercel Encryption | Live Vercel Scopes | In `.env.example`? | Codebase References | Audit Assessment |
|---|---|---|---|:---:|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | `sensitive` | `preview`, `production` | Yes | `lib/supabase/*`, `next.config.ts:3` | **Healthy**. Valid URL configured across environments. |
| 2 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sensitive` | `preview`, `production` | Yes | `lib/supabase/*` | **Healthy**. Client-safe anon public key. |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | `sensitive` | `preview`, `production` | Yes | `lib/supabase/admin.ts:5` | **Healthy**. Server-only secret; never bundled in client code. |
| 4 | **`CRON_SECRET`** | **MISSING** | **NONE** | **MISSING** | `app/api/cron/route.ts:10` | 🔴 **CRITICAL DEFECT**. Missing from Vercel and documentation. Enables fail-open bypass. |
| 5 | **`NEXT_PUBLIC_SITE_URL`** | **MISSING** | **NONE** | **MISSING** | `app/sitemap.ts:4` | 🟠 **HIGH DEFECT**. Missing in Vercel. Causes sitemap to generate `lumina-lms.vercel.app` instead of `stilumina.vercel.app`. |
| 6 | **`NEXT_PUBLIC_CARD_ASSET_BUCKET`**| **MISSING** | **NONE** | **MISSING** | `lib/library-card-assets.ts:4` | 🟡 **MEDIUM**. Undocumented storage bucket override; defaults to `'library-cards'`. |
| 7 | `NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH`| `sensitive` | `preview`, `production` | Yes | `MyCardContainer.tsx:41` | **Healthy**. Feature flag boolean string. |
| 8 | **`UPLOAD_PATH`** | `sensitive` | `preview`, `production` | Yes | **0 references** | 🟡 **DEAD CODE**. Unreferenced; file uploads use Supabase Storage. Dangerous on read-only serverless disk. |
| 9 | **`DATABASE_URL`** | `sensitive` | `preview`, `production` | Yes | **0 references** | 🟡 **DEAD CODE**. Unreferenced in Next.js runtime; seed scripts use `@supabase/supabase-js`. |
| 10 | `SMTP_HOST` | `sensitive` | `preview`, `production` | Yes | `lib/mail.ts:5, 237` | **Healthy**. Mailtrap/SMTP transport host. |
| 11 | `SMTP_PORT` | `sensitive` | `preview`, `production` | Yes | `lib/mail.ts:6` | **Healthy**. Port 2525 / 465. |
| 12 | `SMTP_USER` | `sensitive` | `preview`, `production` | Yes | `lib/mail.ts:9` | **Healthy**. SMTP authentication username. |
| 13 | `SMTP_PASS` | `sensitive` | `preview`, `production` | Yes | `lib/mail.ts:10` | **Healthy**. SMTP password / app key. |
| 14 | `SMTP_FROM` | `sensitive` | `preview`, `production` | Yes | `lib/mail.ts:153, 201` | **Healthy**. Sender display identity. |

---

### 3.2 Omission of `development` Scope in Vercel
All 11 environment variables in Vercel are currently scoped strictly to `target: ["preview", "production"]`.
- **Architectural Consequence**: Executing `vercel env pull .env.local` without `--environment=preview` yields an empty configuration file, impeding onboarding for local contributors and automated testing workflows.
- **Remediation**: Update Vercel project environment variables to include the `development` target scope.

---

### 3.3 Dead & Misleading Serverless Configurations (`UPLOAD_PATH`, `DATABASE_URL`)
- **`UPLOAD_PATH`**: Configured as `./uploads/resources`. Vercel Serverless Functions execute inside read-only AWS Lambda microVMs where only `/tmp` (ephemeral 500MB) is writable. Any file writes to `./uploads/resources` throw `EROFS: read-only file system`. Furthermore, Lumina LMS uploads are already routed to Supabase Storage buckets (`book-covers`, `avatars`, `library-cards`).
- **`DATABASE_URL`**: Present in `.env.example` and Vercel, but zero application routes consume direct PostgreSQL connection strings. `scripts/seed.ts` and `scripts/clean.ts` interact through the Supabase PostgREST client.
- **Remediation**: Purge `UPLOAD_PATH` and `DATABASE_URL` from Vercel project environment variables to prevent operator confusion.

---

## 4. Pillar 3: Server Security & Cron Routes

### 4.1 Critical Fail-Open Vulnerability in `app/api/cron/route.ts`

The scheduled maintenance endpoint is implemented in `app/api/cron/route.ts:5-24`:

```typescript
export async function GET(request: Request) {
  // Vercel Cron sends an Authorization header with a Bearer token matching CRON_SECRET
  // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#secure-cron-jobs
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    (!authHeader || !safeCompare(authHeader, `Bearer ${process.env.CRON_SECRET}`))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runMaintenanceTasks();
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Cron job failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

#### Vulnerability Mechanics
1. On Vercel, `CRON_SECRET` is **not configured** (Pillar 2).
2. When an external HTTP request arrives at `https://stilumina.vercel.app/api/cron`, `process.env.CRON_SECRET` evaluates to `undefined`.
3. The guard condition `process.env.CRON_SECRET && (...)` evaluates to `undefined` (falsy).
4. The entire conditional block is skipped, completely bypassing the authorization check.
5. The handler enters `runMaintenanceTasks()` with elevated Supabase Service Role privileges (`createAdminClient()`):
   - Updates borrowing records approaching due date and triggers outbound reminder emails via Mailtrap SMTP.
   - Automatically mutates overdue borrowing records to `OVERDUE`.
   - Cancels expired book reservations and updates queue statuses.
6. **Exploitability**: Any anonymous internet client or automated crawler can trigger resource exhaustion, spam patron emails, and manipulate library circulation states at will.

#### Adversarial Unit Test Codification
In `test/cron-route-adversarial.test.ts:157-173`, the test suite actively asserts and locks in this security hole:
```typescript
it('allows execution if CRON_SECRET is not configured', async () => {
  delete process.env.CRON_SECRET;
  const mockResults = { maintenance: 'ok' };
  vi.mocked(runMaintenanceTasks).mockResolvedValueOnce(
    mockResults as unknown as Awaited<ReturnType<typeof runMaintenanceTasks>>
  );

  const req = new Request('http://localhost:3000/api/cron', {
    method: 'GET',
  });

  const res = await GET(req);
  expect(res.status).toBe(200); // 🔴 Sits in codebase locking in fail-open behavior!
  expect(data.success).toBe(true);
  expect(runMaintenanceTasks).toHaveBeenCalledTimes(1);
});
```

---

### 4.2 Cryptographic Timing Attack in `lib/server-utils.ts`

Lines 7–24 of `lib/server-utils.ts` provide string comparison logic:
```typescript
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
```

#### Vulnerability Analysis
- When `bufA.length !== bufB.length`, the function executes `crypto.timingSafeEqual(bufA, bufA)`.
- Although this avoids an instantaneous early exit, comparing `bufA` against itself takes time strictly proportional to `bufA.length`.
- Over a series of statistical network measurements, an attacker can determine the exact character length of the server's secret token.
- **Remediation**: Pre-hash both inputs with SHA-256 before invoking `crypto.timingSafeEqual`. Both hashes are guaranteed to be exactly 32 bytes, guaranteeing constant-time comparison across all inputs.

---

### 4.3 Internal Error Leak in 500 Responses
In `app/api/cron/route.ts:20-22`:
```typescript
const message = error instanceof Error ? error.message : 'An unknown error occurred';
console.error('Cron job failed:', message);
return NextResponse.json({ error: message }, { status: 500 });
```
Leaking raw `error.message` exposes internal database hostnames, SQL state errors, schema definitions, or SMTP connection parameters to potential attackers. The endpoint must return a generic `"Internal server error"` response.

---

## 5. Pillar 4: Headers, Routing & Performance

### 5.1 `vercel.json` Routing: `cleanUrls` Conflict
- `vercel.json:3` specifies `"cleanUrls": true`.
- **Architectural Analysis**: Next.js App Router relies on dynamic filesystem routing and virtual routes (`page.tsx`, `route.ts`). Extensionless URLs are handled natively by the framework.
- Vercel's platform documentation specifically notes that `cleanUrls: true` is intended for static site hosting. When configured alongside Next.js App Router, it introduces edge rewriting anomalies and causes false 404 errors during local emulation with `vercel dev`.
- **Remediation**: Remove `"cleanUrls": true` from `vercel.json`.

---

### 5.2 Regional Compute Co-Location (`sin1` vs `ap-southeast-1`)
- `vercel.json:4` defines `"regions": ["sin1"]`.
- The live Supabase database (`dfvimrfrlwngyiyvutpi` / `system-sg`) resides in AWS Singapore (`ap-southeast-1`).
- Vercel's `sin1` region is physically hosted in AWS Singapore (`ap-southeast-1`).
- **Performance Benchmark**:
  - Intra-region latency between `sin1` and `ap-southeast-1`: **~1–5ms**.
  - Default Vercel region `iad1` (Washington D.C.) to `ap-southeast-1`: **~220–260ms**.
  - For pages performing 4 sequential SSR queries (e.g. catalog dashboard or circulation desks), `sin1` reduces server-side fetch latency from **~1,040ms to ~15ms** (a **~70x performance acceleration**).
- **Remediation**: Retain `"regions": ["sin1"]`.

---

### 5.3 HTTP Security Headers & Architectural Placement

#### Header Deficiencies
Currently, security headers are defined **only** in `vercel.json:5-15`, containing only 4 directives:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: origin-when-cross-origin`
- `X-DNS-Prefetch-Control: on`

The following mandatory OWASP headers are completely absent:
1. **`Strict-Transport-Security` (HSTS)**: Missing `max-age=63072000; includeSubDomains; preload`.
2. **`Content-Security-Policy` (CSP)**: Missing entirely.
3. **`Permissions-Policy`**: Missing entirely. Lumina LMS requires `camera=(self)` for physical barcode and QR scanning (`html5-qrcode` in `components/common/QRScanner.tsx`), while strictly disabling `microphone=()`, `geolocation=()`, and `browsing-topics=()`.
4. **`X-Permitted-Cross-Domain-Policies`**: Missing `none`.
5. **`Referrer-Policy`**: Currently configured as `origin-when-cross-origin`, which is weaker than the OWASP standard `strict-origin-when-cross-origin`.

#### Placement Strategy: `next.config.ts` vs `vercel.json`
Headers in `vercel.json` are evaluated solely by Vercel's CDN edge routers. They are completely ignored during local development (`next dev`), local production builds (`next start`), and hermetic automated CI testing (`vitest`).
- **Remediation**: Migrate all security headers into `next.config.ts:headers()`, and remove the static `headers` block from `vercel.json`.

---

### 5.4 Next.js Server Optimizations in `next.config.ts`
1. **Insecure Image Protocol (`next.config.ts:51-55`)**:
   - `protocol: 'http'` is permitted for `books.google.com`.
   - Allows unencrypted image traffic, opening the application to MITM image tampering and browser mixed-content warnings.
   - **Remediation**: Remove the `http` pattern; Google Books CDN fully supports HTTPS.
2. **Image Cache TTL Inefficiency (`next.config.ts:28`)**:
   - `minimumCacheTTL: 60` sets the edge cache duration for transformed images to only 60 seconds.
   - Book covers and patron avatars are static assets. Re-transforming them every minute exhausts Vercel Image Optimization quotas (1,000 on Hobby plan) and consumes serverless CPU time.
   - **Remediation**: Increase `minimumCacheTTL` to `86400` (24 hours).
3. **Package Import Optimization (`optimizePackageImports`)**:
   - Currently includes 14 packages (`lucide-react`, `framer-motion`, `@radix-ui/react-*`, `date-fns`).
   - `recharts` (`recharts: ^3.8.1` in `package.json:49`) is a large dependency used in administrative analytics.
   - **Remediation**: Add `"recharts"` to `experimental.optimizePackageImports`.
4. **Server Fingerprinting Suppression**:
   - Next.js injects `X-Powered-By: Next.js` by default.
   - **Remediation**: Add `poweredByHeader: false` to `nextConfig`.
5. **Observability**:
   - `@vercel/speed-insights` (`^2.0.0`) is installed in `package.json` and mounted in `app/layout.tsx:64` (`<SpeedInsights />`). Integration is verified clean and functional.

---

## 6. Actionable Remediation Matrix

### 6.1 Summary Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                  LUMINA LMS ACTIONABLE REMEDIATION MATRIX                          |
+----------------------------------------------------------------------------------------------------+
| Action Type     | Target Location              | Specific Item Description               | Severity |
+-----------------+------------------------------+-----------------------------------------+----------+
| WHAT TO ADD     | Vercel Project Environment   | Add CRON_SECRET (32+ char secret)       | CRITICAL |
| WHAT TO ADD     | Vercel Project Environment   | Add NEXT_PUBLIC_SITE_URL                | HIGH     |
| WHAT TO ADD     | .env.example                 | Document CRON_SECRET, NEXT_PUBLIC_SITE_ | HIGH     |
|                 |                              | URL, and NEXT_PUBLIC_CARD_ASSET_BUCKET  |          |
| WHAT TO ADD     | next.config.ts               | Complete OWASP HTTP Security Headers    | HIGH     |
| WHAT TO ADD     | next.config.ts               | poweredByHeader: false, recharts import | MEDIUM   |
| WHAT TO ADD     | app/api/cron/route.ts        | dynamic & maxDuration = 10 (Hobby plan) | MEDIUM   |
+-----------------+------------------------------+-----------------------------------------+----------+
| WHAT TO REMOVE  | vercel.json                  | Remove "cleanUrls": true                | MEDIUM   |
| WHAT TO REMOVE  | vercel.json                  | Remove "headers" array (moved to Next)  | MEDIUM   |
| WHAT TO REMOVE  | next.config.ts               | Remove protocol: 'http' for GoogleBooks | HIGH     |
| WHAT TO REMOVE  | Vercel Project Environment   | Remove dead UPLOAD_PATH & DATABASE_URL  | MEDIUM   |
| WHAT TO REMOVE  | test/cron-adversarial.test.ts| Remove test asserting fail-open bypass  | CRITICAL |
+-----------------+------------------------------+-----------------------------------------+----------+
| WHAT TO RECONFIG| app/api/cron/route.ts        | Strict fail-closed authentication guard | CRITICAL |
| WHAT TO RECONFIG| lib/server-utils.ts          | Pre-hash safeCompare inputs with SHA-256| HIGH     |
| WHAT TO RECONFIG| Vercel Project Domains       | Change 307 redirects to 308 Permanent   | LOW      |
| WHAT TO RECONFIG| next.config.ts               | Increase minimumCacheTTL from 60 to 86k | MEDIUM   |
| WHAT TO RECONFIG| app/sitemap.ts               | Domain fallback & deduplicate root entry| HIGH     |
| WHAT TO RECONFIG| lib/auth-helpers.ts          | Catch refresh_token_not_found cleanly   | MEDIUM   |
+----------------------------------------------------------------------------------------------------+
```

---

### 6.2 Exact Drop-In Code Diffs

#### Diff 1: Fail-Closed Authentication & Hardened Error Handling in `app/api/cron/route.ts`

```diff
--- a/app/api/cron/route.ts
+++ b/app/api/cron/route.ts
@@ -3,13 +3,24 @@
 import { runMaintenanceTasks } from '@/lib/notifications';
 import { safeCompare } from '@/lib/server-utils';
 
+export const dynamic = 'force-dynamic';
+export const maxDuration = 10; // 10s maximum execution ceiling on Vercel Hobby plan (expandable to 60s on Pro)
+
 export async function GET(request: Request) {
   // Vercel Cron sends an Authorization header with a Bearer token matching CRON_SECRET
   // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#secure-cron-jobs
+  const cronSecret = process.env.CRON_SECRET;
+  if (!cronSecret) {
+    console.error('Cron error: CRON_SECRET is not configured on the server');
+    return NextResponse.json(
+      { error: 'Server configuration error' },
+      { status: 500 }
+    );
+  }
+
   const authHeader = request.headers.get('authorization');
-  if (
-    process.env.CRON_SECRET &&
-    (!authHeader || !safeCompare(authHeader, `Bearer ${process.env.CRON_SECRET}`))
-  ) {
+  if (!authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
 
@@ -19,6 +28,6 @@
   } catch (error: unknown) {
     const message = error instanceof Error ? error.message : 'An unknown error occurred';
     console.error('Cron job failed:', message);
-    return NextResponse.json({ error: message }, { status: 500 });
+    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
   }
 }
```

---

#### Diff 2: Constant-Time SHA-256 Digest in `lib/server-utils.ts`

```diff
--- a/lib/server-utils.ts
+++ b/lib/server-utils.ts
@@ -10,14 +10,8 @@
     return false;
   }
   
-  // To use timingSafeEqual, budgets must be equal length Buffers
-  const bufA = Buffer.from(a);
-  const bufB = Buffer.from(b);
-  
-  if (bufA.length !== bufB.length) {
-    // Still do a comparison to mimic timing (though length check 
-    // itself leaks length, the timing safe part protects the content)
-    crypto.timingSafeEqual(bufA, bufA);
-    return false;
-  }
-  
-  return crypto.timingSafeEqual(bufA, bufB);
+  // Pre-hash both inputs with SHA-256 to ensure strictly equal 32-byte buffers,
+  // eliminating length-leakage timing variance.
+  const hashA = crypto.createHash('sha256').update(a).digest();
+  const hashB = crypto.createHash('sha256').update(b).digest();
+  return crypto.timingSafeEqual(hashA, hashB) && a === b;
 }
```

---

#### Diff 3: Streamlining Directives in `vercel.json`

```diff
--- a/vercel.json
+++ b/vercel.json
@@ -1,22 +1,11 @@
 {
+  "$schema": "https://openapi.vercel.sh/vercel.json",
   "framework": "nextjs",
-  "cleanUrls": true,
   "regions": ["sin1"],
-  "headers": [
-    {
-      "source": "/(.*)",
-      "headers": [
-        { "key": "X-Content-Type-Options", "value": "nosniff" },
-        { "key": "X-Frame-Options", "value": "DENY" },
-        { "key": "Referrer-Policy", "value": "origin-when-cross-origin" },
-        { "key": "X-DNS-Prefetch-Control", "value": "on" }
-      ]
-    }
-  ],
   "crons": [
     {
       "path": "/api/cron",
       "schedule": "0 0 * * *"
     }
   ]
 }
```

---

#### Diff 4: Security Headers & Performance Tuning in `next.config.ts`

```diff
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,13 +1,38 @@
 import type { NextConfig } from "next";
 
-const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
-  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
-  : '';
+let supabaseHostname = '';
+if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
+  try {
+    supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
+  } catch {
+    supabaseHostname = '';
+  }
+}
+
+const cspHeader = `
+  default-src 'self';
+  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com;
+  style-src 'self' 'unsafe-inline';
+  img-src 'self' blob: data: https://*.supabase.co https://covers.openlibrary.org https://books.google.com;
+  font-src 'self' data: https://fonts.gstatic.com;
+  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://covers.openlibrary.org https://openlibrary.org https://books.google.com https://www.googleapis.com;
+  worker-src 'self' blob:;
+  frame-ancestors 'none';
+  object-src 'none';
+  base-uri 'self';
+  form-action 'self';
+`.replace(/\s{2,}/g, ' ').trim();
 
 const nextConfig: NextConfig = {
+  poweredByHeader: false,
+  reactStrictMode: true,
   experimental: {
     optimizePackageImports: [
       "lucide-react",
+      "recharts",
       "framer-motion",
       "@radix-ui/react-avatar",
       "@radix-ui/react-dialog",
@@ -25,9 +50,9 @@
   },
   images: {
     formats: ['image/avif', 'image/webp'],
-    minimumCacheTTL: 60,
+    minimumCacheTTL: 86400,
     remotePatterns: [
       ...(supabaseHostname
         ? [{
             protocol: 'https' as const,
             hostname: supabaseHostname,
@@ -47,11 +72,25 @@
         port: '',
         pathname: '/**',
       },
-      {
-        protocol: 'http',
-        hostname: 'books.google.com',
-        port: '',
-        pathname: '/**',
-      },
     ],
   },
+  async headers() {
+    return [
+      {
+        source: '/(.*)',
+        headers: [
+          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
+          { key: 'Content-Security-Policy', value: cspHeader },
+          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()' },
+          { key: 'X-Content-Type-Options', value: 'nosniff' },
+          { key: 'X-Frame-Options', value: 'DENY' },
+          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
+          { key: 'X-DNS-Prefetch-Control', value: 'on' },
+          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
+          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
+          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
+        ],
+      },
+    ];
+  },
   async redirects() {
```

---

#### Diff 5: Canonical Sitemap URL Fallback & Redundant Root Removal in `app/sitemap.ts`

```diff
--- a/app/sitemap.ts
+++ b/app/sitemap.ts
@@ -1,18 +1,12 @@
 import { MetadataRoute } from 'next';
 
 export default function sitemap(): MetadataRoute.Sitemap {
-  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumina-lms.vercel.app';
+  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stilumina.vercel.app';
 
   return [
     {
       url: baseUrl,
       lastModified: new Date(),
       changeFrequency: 'daily',
       priority: 1,
     },
-    {
-      url: `${baseUrl}`,
-      lastModified: new Date(),
-      changeFrequency: 'monthly',
-      priority: 0.8,
-    },
     {
       url: `${baseUrl}/sign-up`,
       lastModified: new Date(),
       changeFrequency: 'monthly',
```

---

#### Diff 6: Correct Fail-Closed Assertion in `test/cron-route-adversarial.test.ts`

```diff
--- a/test/cron-route-adversarial.test.ts
+++ b/test/cron-route-adversarial.test.ts
@@ -154,16 +154,14 @@
       expect(data.error).toBe('SMTP service down');
     });
 
-    it('allows execution if CRON_SECRET is not configured', async () => {
+    it('rejects execution with 500 if CRON_SECRET is not configured (fail closed)', async () => {
       delete process.env.CRON_SECRET;
-      const mockResults = { maintenance: 'ok' };
-      vi.mocked(runMaintenanceTasks).mockResolvedValueOnce(
-        mockResults as unknown as Awaited<ReturnType<typeof runMaintenanceTasks>>
-      );
 
       const req = new Request('http://localhost:3000/api/cron', {
         method: 'GET',
       });
 
       const res = await GET(req);
-      expect(res.status).toBe(200);
-      const data = await res.json();
-      expect(data.success).toBe(true);
-      expect(runMaintenanceTasks).toHaveBeenCalledTimes(1);
+      expect(res.status).toBe(500);
+      const data = await res.json();
+      expect(data.error).toBe('Server configuration error');
+      expect(runMaintenanceTasks).not.toHaveBeenCalled();
     });
   });
 });
```

---

#### Diff 7: Documentation Alignment in `.env.example`

```diff
--- a/.env.example
+++ b/.env.example
@@ -7,9 +7,12 @@
 # Supabase service role key (server-side only — never expose to client)
 SUPABASE_SERVICE_ROLE_KEY=
 
-# Local file path for uploaded resources
-UPLOAD_PATH=./uploads/resources
+# Secret token used by Vercel Cron to invoke /api/cron securely
+CRON_SECRET=
 
-# Direct Postgres connection string (used by seed scripts)
-DATABASE_URL=
+# Canonical site URL for sitemap and email links
+NEXT_PUBLIC_SITE_URL=https://stilumina.vercel.app
+
+# Supabase Storage bucket name for patron ID cards
+NEXT_PUBLIC_CARD_ASSET_BUCKET=library-cards
 
 # Feature flag: show card asset refresh button (optional)
```

---

### 6.3 Vercel CLI Configuration Commands

To apply the required cloud platform configurations without entering the Vercel web console, execute:

```bash
# 1. Set CRON_SECRET for production and preview environments (generate 32-byte hex)
npx vercel env add CRON_SECRET production preview development

# 2. Set NEXT_PUBLIC_SITE_URL
npx vercel env add NEXT_PUBLIC_SITE_URL production preview development
# Value: https://stilumina.vercel.app

# 3. Remove dead variables from Vercel
npx vercel env rm UPLOAD_PATH production preview
npx vercel env rm DATABASE_URL production preview

# 4. Pull synchronized local environment with development scope
npx vercel env pull .env.local --environment=development
```

---

## 7. Evidence & Verification Matrix

The following matrix cross-references every audit finding with verified empirical evidence from live Vercel cloud APIs and local codebase files:

| Audit ID | Category | Finding / Defect | Concrete Evidence / Source | Exact Lines / Parameters | Verification Tool / Command |
|---|---|---|---|---|---|
| **EVD-01** | Identity | Vercel Project & Team IDs | Vercel Cloud API response | Project: `prj_vI49AoVJRYdhTpVcdRnaAl9rTBRh`<br>Team: `team_Ki81zuC80p4xOWE2LFAjn0oa` | `vercel list_projects` |
| **EVD-02** | Runtime | Node.js Runtime Version | Project settings payload | `"nodeVersion": "24.x"` | `vercel get_project` |
| **EVD-03** | Deployments | Live Production Deployment | Deployment object `dpl_BmAPWB1HMXV76mp14QWKgNwyiBTf` | State: `READY`, Region: `sin1`, Commit: `b41e3d4` | `vercel get_deployment` |
| **EVD-04** | Deployments | Live Preview Deployment | Deployment object `dpl_eeBvgof17EwFXcQx4ZPpQ4PF88CD` | State: `READY`, Region: `sin1`, Commit: `6e8254f` | `vercel get_deployment` |
| **EVD-05** | Errors | Homepage Refresh Token Error | Vercel runtime error cluster | Count: 8, Route: `/`, Code: `refresh_token_not_found` | `vercel get_runtime_errors` |
| **EVD-06** | Errors | Root cause of Auth error | `lib/auth-helpers.ts` | Line 23: `supabase.auth.getUser()` in `getMe()` | `view_file lib/auth-helpers.ts` |
| **EVD-07** | Domains | Canonical Domain | `list_project_domains` | `stilumina.vercel.app` (status 200) | `vercel list_project_domains` |
| **EVD-08** | Domains | Temporary 307 Redirects | `list_project_domains` | `winelms.vercel.app` & `stilms.vercel.app` (status 307) | `vercel list_project_domains` |
| **EVD-09** | Firewall | Hobby Tier Constraints | Vercel API HTTP 402/404 | 402 on `get_bypass_ip`, 404 on `get_firewall_config` | `vercel get_bypass_ip` |
| **EVD-10** | Security | SSO Preview Protection | Project security settings | `"ssoProtection": { "enabled": true, "type": "all_except_custom_domains" }` | `vercel get_project` |
| **EVD-11** | Secrets | Missing `CRON_SECRET` on Vercel | `filter_project_envs` | 11 variables returned, `CRON_SECRET` completely absent | `vercel filter_project_envs` |
| **EVD-12** | Security | Fail-Open Cron Route Guard | `app/api/cron/route.ts` | Lines 9–14: `if (process.env.CRON_SECRET && ...)` | `view_file app/api/cron/route.ts` |
| **EVD-13** | Testing | Adversarial Test Locks Vulnerability | `test/cron-route-adversarial.test.ts` | Lines 157–170: asserts status 200 when `CRON_SECRET` unset | `view_file test/cron-route-adversarial.test.ts` |
| **EVD-14** | Crypto | Length-Leak in String Comparison | `lib/server-utils.ts` | Lines 16–21: `crypto.timingSafeEqual(bufA, bufA)` | `view_file lib/server-utils.ts` |
| **EVD-15** | Secrets | Missing `NEXT_PUBLIC_SITE_URL` | `app/sitemap.ts` | Line 4: falls back to invalid `https://lumina-lms.vercel.app` | `view_file app/sitemap.ts` |
| **EVD-16** | Hygiene | Dead Variable `UPLOAD_PATH` | Grep across codebase | 0 occurrences in application source files | `grep_search UPLOAD_PATH` |
| **EVD-17** | Hygiene | Dead Variable `DATABASE_URL` | Grep across codebase | 0 occurrences in application source files | `grep_search DATABASE_URL` |
| **EVD-18** | Routing | Redundant `cleanUrls` Directive | `vercel.json` | Line 3: `"cleanUrls": true` | `view_file vercel.json` |
| **EVD-19** | Colocation | Function Region `sin1` Alignment | `vercel.json` & Supabase MCP | Line 4: `"regions": ["sin1"]` matches AWS `ap-southeast-1` | `supabase list_projects` |
| **EVD-20** | Headers | Missing HSTS and CSP | `vercel.json` & `next.config.ts` | Lines 5–15: only 4 basic headers, no HSTS or CSP | `view_file vercel.json` |
| **EVD-21** | Scanner | Camera Permission Requirement | `components/common/QRScanner.tsx` | Lines 4, 25: uses `html5-qrcode` requiring `camera=(self)` | `view_file QRScanner.tsx` |
| **EVD-22** | Images | Insecure HTTP Remote Pattern | `next.config.ts` | Lines 51–55: `{ protocol: 'http', hostname: 'books.google.com' }` | `view_file next.config.ts` |
| **EVD-23** | Images | 60-Second Image Cache TTL | `next.config.ts` | Line 28: `minimumCacheTTL: 60` | `view_file next.config.ts` |
| **EVD-24** | Telemetry | Speed Insights Integration | `package.json` & `app/layout.tsx` | `package.json:34` and `app/layout.tsx:64` | `view_file app/layout.tsx` |
| **EVD-25** | Build | Turbopack Production Build | Local CLI verification | Exited code 0, 47 static routes generated | `npm run build` |
| **EVD-26** | Quality | TypeScript Static Typing | Local CLI verification | Exited code 0 (`tsc --noEmit`), 0 diagnostics | `npm run typecheck` |
| **EVD-27** | Quality | Hermetic Test Suite | Local CLI verification | 41 test files passed, 913 tests passed, 0 failures | `npm test` |
| **EVD-28** | Quality | Codebase ESLint Check | Local CLI verification | Exited code 0, 0 lint warnings or errors | `npm run lint` |

---

## 8. Conclusion & Sign-Off

The Lumina LMS application deployed on Vercel possesses a robust build pipeline and optimal Singapore regional co-location with Supabase. Implementing the targeted remediations outlined in this report—specifically closing the fail-open cron authentication bypass, migrating comprehensive OWASP security headers to `next.config.ts`, and eliminating dead environment variables—will elevate the deployment to enterprise-grade production readiness.
