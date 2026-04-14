# Lumina LMS Platform 📚

**Lumina** is a premium, high-performance Library Management System designed for modern educational institutions. It provides a state-of-the-art interface for managing physical and digital assets, automated circulation workflows, and integrated student identity management.

![Lumina Overview](https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=2000)

## 🌟 Key Features

*   **Unified Inventory Engine**: Full-spectrum control over physical books and digital assets with real-time availability tracking and global search filters.
*   **Automated Circulation**: Intelligent borrowing, returning, and reservation flows with automated penalty calculation.
*   **System-Wide Audit Logging**: Robust, non-blocking telemetry powered by Next.js `after()`, tracking every administrative and circulation event.
*   **Librarian-Led Approvals**: Manual account oversight workflow ensuring strict status enforcement and synchronized library card access.
*   **Virtual Identity System**: Dynamic digital student cards with secure QR code generation for streamlined, contactless checkouts.
*   **Role-Based Security**: Precise access control layers for Students, Staff, Librarians, and Administrators.

## ⚡ Performance Architecture

Lumina is engineered for sub-second perceived latency using a "Streaming First" approach:
*   **Instant Loading**: Leverages Next.js streaming with a **Promise-pass + React `use()`** pattern.
*   **Zero-Blocking UI**: Critical data is streamed directly to client components, ensuring shells render immediately while data hydrates in the background.
*   **Optimistic UI**: Powered by SWR and Server Actions for instantaneous user feedback.

## 🛠️ Technical Stack

*   **Framework**: [Next.js 15+](https://nextjs.org/) (App Router, Server Actions, `after()`)
*   **Core Logic**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Backend-as-a-Service**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Real-time)
*   **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide](https://lucide.dev/)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/) (Lazy-loaded for performance)
*   **State Management**: [SWR](https://swr.vercel.app/) (Optimistic Updates, Caching)

## 📂 Project Structure

```text
├── app/              # Next.js App Router (Pages, Layouts, Server Actions)
├── components/       # UI Components (Radix-based primitives & Feature components)
├── lib/              # Core utilities, API clients, and TypeScript definitions
├── hooks/            # Custom React hooks for data fetching and UI state
├── supabase/         # Database migrations, seed data, and RLS policies
├── public/           # Static assets (including Lumina Beacon branding)
├── scripts/          # Automation scripts (database management, reset tools)
├── tests/            # Unit (Vitest) and E2E (Playwright) testing suites
└── playwright/       # Playwright-specific configuration and helpers
```

## 🚀 Developer Setup

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/Godwynski/system.git
    cd system
    npm install
    ```

2.  **Environment Configuration**:
    Create a `.env.local` file with your Supabase credentials.

3.  **Database Initialization**:
    For a fresh installation, we recommend using the unified schema and sample data:
    *   Apply `supabase/schema_clean_install.sql` in your Supabase SQL Editor.
    *   (Optional) Apply `supabase/sample_data.sql` to seed the database with test users and books.

4.  **Launch Platform**:
    ```bash
    npm run dev
    ```

## 📦 Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Spins up the development server with Hot Module Replacement. |
| `npm run build` | Compiles the production-ready Next.js bundle. |
| `npm run start` | Runs the compiled production build locally. |
| `npm run lint` | Runs ESLint for codebase quality checks. |
| `npm run typecheck` | Validates TypeScript types. |
| `npm run test` | Executes unit tests via Vitest. |
| `npm run test:e2e` | Runs E2E integration tests using Playwright. |
| `npm run test:e2e:ui` | Opens the Playwright UI for interactive testing. |
| `npm run analyze` | Visualizes the production bundle size. |

## 🔐 Security

Lumina implements strict **Row Level Security (RLS)** at the PostgreSQL layer. All data access is filtered through Supabase Auth JWTs, ensuring a zero-trust architecture where users only access data permitted by their specific role.

---

*Built with precision by Lumina Engineering.*
