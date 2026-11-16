# Lumina LMS

A library book reservation, borrowing, inventory, and QR attendance system for STI College Alabang.

Patrons (students and faculty) browse the restricted/authenticated OPAC, reserve books, view their library card, and check borrowing and attendance history. Library Staff and librarians process checkout and returns according to assigned permissions. Koha and MARC 21 are reference systems and standards for the catalog approach; Lumina does not claim Koha interoperability or complete MARC 21 implementation.

## Documentation

- [Testing guide](test/README.md) for test organization and commands.

## Local setup

Use Node.js 24.x and npm 11 or later, as specified in [package.json](package.json). The project uses Next.js 16, React 19, TypeScript, Supabase, and Tailwind CSS. The lockfile records exact dependency versions.

~~~powershell
git clone https://github.com/Godwynski/lumina-lms.git
cd lumina-lms
npm ci
Copy-Item .env.example .env.local
~~~

Populate the variables described in [.env.example](.env.example) using your development Supabase project. Configure Microsoft authentication and its callback URLs for the environment before signing in.

For a new, empty database, [schema_clean_install.sql](supabase/schema_clean_install.sql) provides the baseline. For an existing database, review the applicable [migrations](supabase/migrations) and migration history before applying changes. Seed and cleanup scripts mutate data and are separate from starting the application.

~~~powershell
npm run dev
~~~

Open [localhost:3000](http://localhost:3000). Camera access requires HTTPS or localhost and browser permission.

## Configuration

| Variables | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public Supabase connection and authentication configuration |
| SUPABASE_SERVICE_ROLE_KEY | Privileged server-side operations |
| CRON_SECRET | Authentication for scheduled maintenance |
| NEXT_PUBLIC_SITE_URL | Canonical URL used in generated links |
| NEXT_PUBLIC_CARD_ASSET_BUCKET, NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH | Library-card storage and optional refresh control |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | Outgoing mail configuration |
| DEMO_PASSWORD | Evaluation account password |

Keep privileged keys and passwords in environment configuration. Refer to the template for example values. Set SMTP_PORT explicitly for your provider. The mail implementation falls back to 465 when it is unset.

## Sign-in and evaluation accounts

Normal access uses Microsoft sign-in with an institutional account. Account activation and assigned permissions determine which features are available. Initial account provisioning is defined in the database schema.

Evaluation accounts are supported by [demo configuration](lib/demo/config.ts), the [demo login route](app/api/demo-login/route.ts), and [scripts/demo.ts](scripts/demo.ts). Quick Demo Access stays enabled during thesis evaluation, even if DEMO_MODE is unset or false. Use npm run demo:on to provision the accounts. The script creates a password in local environment configuration if one is missing. Configure the same DEMO_PASSWORD in the deployed environment when evaluating a deployment.

| Role | Demo email | School ID |
|---|---|---|
| Super Admin | demo.aquino@alabang.sti.edu.ph | FAC-DEMO.AQUINO |
| Librarian | demo.galang@alabang.sti.edu.ph | FAC-DEMO.GALANG |
| Library Staff (student assistant) | demo.marasigan.20230148@alabang.sti.edu.ph | STU-20230148 |
| Patron (student) | demo.bautista.20220271@alabang.sti.edu.ph | STU-20220271 |

These are synthetic application accounts for Quick Demo Access, with password authentication through Supabase; they are not Microsoft accounts or email inboxes. All four use the server's DEMO_PASSWORD from `.env.local`. [Demo account fixtures](lib/demo/accounts.ts) define complete names, departments, phones, addresses, IDs, and role permissions. Provisioning migrates the old `@lumina.test` accounts in place, preserving their user IDs and history, and resets profiles and cards to ACTIVE. Re-run `npm run demo:on` to restore demo data after evaluation changes. Demo login uses the current saved profile and permissions; normal account-status and role restrictions still apply.

Provisioning may transfer the super-admin role from the existing administrator to the demo administrator. npm run demo:off removes demo accounts and restores the recorded administrator, but does not hide the evaluation buttons. These commands change authentication and profile data. Before ordinary institutional operation, disable demo access in `lib/demo/config.ts` and remove the demo accounts.

## Development commands

| Command | Purpose |
|---|---|
| npm run dev | Start the development server |
| npm run build | Create a production build |
| npm run start | Serve a production build |
| npm run typecheck | Check TypeScript |
| npm run lint | Run ESLint |
| npm test | Run Vitest |
| npm run test:watch | Watch tests |
| npm run test:coverage | Collect coverage |
| npm run analyze | Build with bundle analysis enabled |

When this checkout contains nested worktrees, use the exclusion in the [testing guide](test/README.md) to avoid collecting their test copies. Test counts and pass status come from command output for the revision being tested.

## Maintenance

The seed, clean, demo:on, and demo:off scripts are listed in [package.json](package.json). Review each script and confirm its target environment before running it.

## Scope and limitations

Lumina is a **Restricted / Authenticated OPAC** for patrons (students and faculty) and authorized library personnel. Koha and MARC 21 inform the library-system and bibliographic-reference context; they are references, not integrated products. The application’s role labels are Patron and Library Staff; the database role values are `patron` and `library_staff`.

Cash fine payments and official receipts are handled manually in a physical ledger. Lumina computes fines and tracks Receivable, Paid, and Condoned resolutions, but does not provide full digital accounting or receipt issuance. Book purchase price, replacement cost, and donation tracking are not implemented.
