# Lumina LMS

A library book reservation, borrowing, inventory, and QR attendance system for STI College Alabang.

Students browse the catalog, reserve books, view their library card, and check borrowing and attendance history. Authorized staff process checkout and return transactions, record gate attendance, and manage library records.

## Documentation

- [User guide](docs/user-guide.md) for circulation, attendance, and account management.
- [Documentation index](docs/README.md) for requirements, assessments, and thesis sources.
- [Testing guide](test/README.md) for test organization and commands.
- [Accessibility guidance](docs/accessibility.md) for interaction patterns and assessment limits.

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
| DEMO_MODE, DEMO_PASSWORD | Optional evaluation accounts |

Keep privileged keys and passwords in environment configuration. Refer to the template for example values. Set SMTP_PORT explicitly for your provider. The mail implementation falls back to 465 when it is unset.

## Sign-in and evaluation accounts

Normal access uses Microsoft sign-in with an institutional account. Account activation and assigned permissions determine which features are available. Initial account provisioning is defined in the database schema.

Evaluation accounts are supported by [demo configuration](lib/demo/config.ts), the [demo login route](app/api/demo-login/route.ts), and [scripts/demo.ts](scripts/demo.ts). Set DEMO_MODE=true in the application environment and use npm run demo:on to provision the accounts. The script creates a password in local environment configuration if one is missing. Configure the same DEMO_PASSWORD in the deployed environment when evaluating a deployment.

Provisioning may transfer the super-admin role from the existing administrator to the demo administrator. npm run demo:off removes demo accounts and restores the recorded administrator. These commands change authentication and profile data. Keep DEMO_MODE=false for ordinary institutional operation.

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

The earlier detailed overview is retained as a [historical snapshot](docs/archive/project-overview-2026-11-12.md), including its architecture discussion and academic attribution.
