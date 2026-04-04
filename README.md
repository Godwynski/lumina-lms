# Lumina LMS (Library Management System)

Lumina is a modern, high-performance Library Management System built for educational institutions. It provides a seamless interface for managing physical and digital assets, automated circulation, and integrated student identity management.

![Lumina Overview](https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=2000)

## 🚀 Key Features

*   **Unified Inventory Control**: A single dashboard for physical books and digital resources with advanced filtering and real-time availability tracking.
*   **Smart Circulation Engine**: Streamlined borrowing and return flows with automated penalty calculations and detailed operational logs.
*   **Integrated Digital Identity**: Virtual library cards for students featuring QR code scanning for instantaneous, secure checkouts.
*   **Role-Based Access Control**: Granular permissions for Administrators, Librarians, Staff, and Students.
*   **Asset Lifecycle Management**: Comprehensive tools for cataloging, metadata editing, and resource decommissioning.

## 🛠️ Technical Stack

*   **Frontend**: Next.js 15+ (App Router), React 19, Tailwind CSS.
*   **Backend**: Supabase (PostgreSQL, Authentication, Real-time).
*   **Styling**: Lucide React icons, Framer Motion animations, Radix UI primitives.
*   **Performance**: Vercel-optimized asset delivery, SWR for client-side caching.

## 📂 Project Architecture

```text
├── app/              # Next.js App Router pages & layouts
├── components/       # Reusable React components (UI/Feature-specific)
├── lib/              # Core business logic, utilities, and Supabase client
├── public/           # Static assets (favicons, manifest)
├── supabase/         # Database migrations, RLS policies, and triggers
└── scripts/          # Automation and maintenance scripts
```

## ⚡ Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Godwynski/system.git
    cd system
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your-project-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    ```

4.  **Run migrations**:
    ```bash
    npx supabase db push
    ```

5.  **Start development server**:
    ```bash
    npm run dev
    ```

## 🔐 Security & Permissions

Lumina enforces strict **Row Level Security (RLS)** at the database layer. Access is validated through JWT tokens and custom database triggers ensuring that users only interact with data they are authorized to see based on their assigned role in the `profiles` table.

---

Built with precision for the modern library.
