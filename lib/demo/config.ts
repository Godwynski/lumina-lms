// Demo accounts for thesis evaluation. Server-only: never import from a client component.
// Demo stays enabled during thesis evaluation. School-domain fixtures and server credentials
// are kept separate so the shared password never reaches a client component.
import { DEMO_ACCOUNTS, type DemoAccount } from './accounts.ts';
export { DEMO_ACCOUNTS, type DemoAccount } from './accounts.ts';

export function isDemoModeEnabled(): boolean {
  return true;
}

export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === normalized);
}
