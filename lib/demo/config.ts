// Demo accounts for thesis evaluation. Server-only: never import from a client component.
// Demo is ON only when DEMO_MODE=true. The sign-up trigger accepts these emails
// only while scripts/demo.ts (npm run demo:on) has listed them in public.demo_accounts.

export type DemoAccount = {
  email: string;
  label: string;
  fullName: string;
  role: 'super_admin' | 'librarian' | 'student_assistant' | 'student';
  cardNumber: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'admin@lumina.test', label: 'Super Admin', fullName: 'Demo Super Admin', role: 'super_admin', cardNumber: 'DEMO-ADM-001' },
  { email: 'librarian@lumina.test', label: 'Librarian', fullName: 'Demo Librarian', role: 'librarian', cardNumber: 'DEMO-LIB-001' },
  { email: 'staff@lumina.test', label: 'Staff', fullName: 'Demo Staff', role: 'student_assistant', cardNumber: 'DEMO-STF-001' },
  { email: 'student@lumina.test', label: 'Student', fullName: 'Demo Student', role: 'student', cardNumber: 'DEMO-STU-001' },
];

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === normalized);
}
