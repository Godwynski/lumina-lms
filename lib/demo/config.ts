import { DEMO_ACCOUNTS, type DemoAccount } from './accounts.ts';

export function isDemoModeEnabled(): boolean {
  return (process.env.DEMO_ACCESS_CODE?.length ?? 0) >= 24
    && (process.env.DEMO_PASSWORD?.length ?? 0) >= 12
    && process.env.DEMO_ACCESS_CODE !== process.env.DEMO_PASSWORD;
}

export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.email === normalized);
}
