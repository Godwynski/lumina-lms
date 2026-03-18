# Lumina LMS

A modern Learning Management System built with Next.js and Supabase.

## Overview

Lumina LMS is a comprehensive library and learning management system designed to streamline resource management, borrowing workflows, and educational content delivery. Built with a modern tech stack, it offers role-based access control for different user types including Students, Staff, Librarians, and System Administrators.

## Features

- **Smart Catalog**: AI-powered search and categorization of thousands of resources
- **Role-Based Access Control**: Secure workflows tailored for different user roles
- **Automated Fines System**: Track borrowing histories, due dates, and automated fine calculations
- **Offline Access**: Progressive Web App capabilities for offline functionality
- **Real-time Updates**: Live data synchronization with Supabase
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Dark/Light Theme**: Automatic theme switching based on system preference
- **PDF Viewer**: Built-in PDF viewing capabilities
- **QR Code Generation**: For quick resource access and checkouts

## Technology Stack

### Frontend
- **Next.js 16.1.7** - React framework for server-rendered applications
- **React 19.0.0** - UI library
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **TypeScript 5.x** - Type-safe JavaScript

### UI Components
- **Radix UI** - Accessible primitive components
- **Lucide React** - Beautiful icon set
- **Framer Motion** - Animation library
- **Next Themes** - Dark/light theme management

### Backend & Infrastructure
- **Supabase** - Backend-as-a-service (PostgreSQL, Auth, Storage)
- **Prisma 6.16.0** - TypeScript ORM for database operations
- **Supabase JS Client** - Direct Supabase API access
- **Supabase SSR** - Server-side rendering support

### Development Tools
- **ESLint** - Code linting
- **Autoprefixer** - CSS vendor prefixing
- **PostCSS** - CSS processing

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── api/             # API routes
│   ├── auth/            # Authentication pages
│   ├── admin/           # Admin dashboard
│   ├── protected/       # Protected routes
│   ├── offline/         # Offline functionality
│   └── page.tsx         # Home page
├── components/          # Reusable UI components
├── lib/                 # Utility functions and services
│   ├── auth-helpers.ts  # Authentication helpers
│   ├── supabase/        # Supabase client configuration
│   ├── utils.ts         # General utilities
│   └── actions/         # Server actions
├── prisma/              # Prisma ORM configuration
│   └── schema.prisma    # Database schema
├── supabase/            # Supabase-specific files
├── public/              # Static assets
└── styles/              # Global styles
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd lumina-lms
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   DATABASE_URL=your_postgresql_connection_string
   JWT_SECRET=your_jwt_secret
   ```

4. Push Prisma schema to Supabase:
   ```bash
   npx prisma db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `NEXT_PUBLIC_CARD_ASSET_BUCKET` | Public storage bucket for static card assets (default: `library-cards`) | No |
| `NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH` | Show the support/debug "Refresh assets" button on My Card (`true`/`false`) | No |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT token generation | Yes |
| `VERCEL_URL` | Vercel deployment URL (auto-set) | No |

## Database Schema

The Prisma schema defines the following models:
- User (extends Supabase auth users)
- Resource (books, articles, media)
- BorrowRecord (track borrowing history)
- Fine (automated fine calculations)
- Category (resource categorization)
- Role (user role definitions)
- And more...

See `prisma/schema.prisma` for the complete schema.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run postinstall` - Generate Prisma client (runs automatically after install)

## Features in Detail

### Authentication
- Email/password sign-in
- Magic link authentication
- Social login providers (configurable)
- Role-based access protection

### Resource Management
- CRUD operations for learning resources
- AI-powered tagging and categorization
- Advanced search with filters
- Resource availability tracking

### Borrowing System
- Checkout and return workflows
- Due date tracking
- Reservation system
- Late return notifications

### Administration
- User management
- Role and permission configuration
- System settings
- Analytics and reporting
- Backup and restore functionality

### Offline Capabilities
- Service worker for PWA functionality
- Cached assets for offline viewing
- Background sync for data updates
- Offline form submissions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Supabase](https://supabase.com/)
- UI components inspired by [Radix UI](https://radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)

## Known Issues & Missing Features

### Current Limitations
1. Limited social authentication providers (only email/password implemented)
2. Basic reporting dashboard (needs enhancement)
3. No multi-language support (i18n)
4. Limited customization options for institutions
5. Basic notification system (email only)

### Planned Improvements
1. Enhanced AI-powered recommendation system
2. Mobile application development
3. Advanced analytics dashboard
4. Payment gateway integration for fines
5. Calendar integration for scheduling
6. Improved accessibility compliance (WCAG 2.1)
7. Comprehensive test suite
8. Documentation for administrators and end-users

## Deployment

### Vercel (Recommended)
1. Push code to GitHub repository
2. Import project in Vercel dashboard
3. Configure environment variables
4. Deploy

### Self-Hosted
1. Build the application: `npm run build`
2. Start the server: `npm run start`
3. Ensure environment variables are set
4. Use a process manager like PM2 for production

## Support

For issues, questions, or feature requests, please open an issue in the GitHub repository.

---
*Developed with ❤️ using Next.js and Supabase*
