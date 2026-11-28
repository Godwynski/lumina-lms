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

Keep privileged keys and passwords in environment configuration. Refer to the template for example values. Set SMTP_PORT explicitly for your provider. The mail implementation falls back to 465 when it is unset.

## Sign-in

Normal access uses Microsoft sign-in with an institutional account. Account activation and assigned permissions determine which features are available. Initial account provisioning is defined in the database schema.

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

The seed and clean scripts are listed in [package.json](package.json). Review each script and confirm its target environment before running it.

## Scope and limitations

Lumina is a **Restricted / Authenticated OPAC** for patrons (students and faculty) and authorized library personnel. Koha and MARC 21 inform the library-system and bibliographic-reference context; they are references, not integrated products. The application’s role labels are Patron and Library Staff; the database role values are `patron` and `library_staff`.

Cash fine payments and official receipts are handled manually in a physical ledger. Lumina computes fines and tracks Receivable, Paid, and Condoned resolutions, but does not provide full digital accounting or receipt issuance. Book purchase price, replacement cost, and donation tracking are not implemented.

### Capstone evaluation

Set distinct server-only `DEMO_ACCESS_CODE` (at least 24 characters) and `DEMO_PASSWORD`
(at least 12 characters) to show Quick Demo Access. Share only the evaluator access
code. The password is used by the server to authenticate the four fixture users.

Against the explicitly selected Supabase host, run
`npx ts-node -T scripts/seed-demo.ts <supabase-host>` using the same demo password.
The script refuses to replace an institutional Super Admin and inserts stable
fixture records without clearing application tables. Remove the deployment's
demo configuration after evaluation and rotate or disable the demo users in Supabase.
