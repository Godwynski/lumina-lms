# Lumina LMS Platform 📚

**Lumina** is a premium, high-performance Library Management System designed for modern educational institutions. It provides a state-of-the-art interface for managing physical and digital assets, automated circulation workflows, and integrated student identity management.

![Lumina Overview](https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=2000)

## 🌟 Key Features

*   **Unified Inventory Engine**: Full-spectrum control over physical books and digital assets with real-time availability tracking and global search filters.
*   **Automated Circulation**: Intelligent borrowing, returning, and reservation flows with automated penalty calculation and audit logging.
*   **Virtual Identity System**: Dynamic digital student cards with secure QR code generation for streamlined, contactless checkouts.
*   **Advanced Analytics**: Comprehensive reporting dashboard for monitoring library health, circulation trends, and item popularity.
*   **Role-Based Security**: Precise access control layers for Students, Staff, Librarians, and Administrators.

## 🛠️ Technical Stack

*   **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
*   **Core Logic**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Backend-as-a-Service**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Real-time)
*   **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide](https://lucide.dev/)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **State Management**: [SWR](https://swr.vercel.app/) (Optimistic Updates, Caching)

## 📂 Project Structure

```text
├── app/              # Next.js 15 App Router (Pages, Layouts, Server Actions)
├── components/       # UI Components (Radix-based primitives & Feature components)
├── lib/              # Core utilities, API clients, and TypeScript definitions
├── public/           # Static assets, manifests, and favicons
├── supabase/         # Database migrations, seed data, and RLS policies
├── hooks/            # Custom React hooks for data fetching and UI state
├── scripts/          # Automation scripts for database management
└── tests/            # Unit and E2E testing suites
```

## ⚡ Developer Setup

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/Godwynski/system.git
    cd system
    npm install
    ```

2.  **Environment Configuration**:
    Create a `.env.local` file with the following keys:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
    ```

3.  **Database Initialization**:
    ```bash
    npx supabase db push
    npm run seed
    ```

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
| `npm run lint` | Runs ESLint to find and fix architectural/style issues. |
| `npm run typecheck` | Validates TypeScript types across the entire codebase. |
| `npm run test` | Executes unit tests via Vitest. |
| `npm run test:e2e` | Runs end-to-end integration tests using Playwright. |
| `npm run analyze` | Visualizes the production bundle size using `@next/bundle-analyzer`. |

## 🔐 Security

Lumina implements strict **Row Level Security (RLS)** at the PostgreSQL layer. All data access is filtered through Supabase Auth JWTs, ensuring a zero-trust architecture where users only access data permitted by their specific role.

---

*Built with precision by Lumina Engineering.*
