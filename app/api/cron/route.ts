import { NextResponse } from 'next/server';
import { runMaintenanceTasks } from '@/lib/notifications';
import { safeCompare } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // 10s maximum execution ceiling on Vercel Hobby plan (expandable to 60s on Pro)

export async function GET(request: Request) {
  // Vercel Cron sends an Authorization header with a Bearer token matching CRON_SECRET
  // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#secure-cron-jobs
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('Cron error: CRON_SECRET is not configured on the server');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runMaintenanceTasks();
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Cron job failed:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

