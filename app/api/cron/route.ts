import { NextResponse } from 'next/server';
import { runMaintenanceTasks } from '@/lib/notifications';

export async function GET(request: Request) {
  // Vercel Cron sends an Authorization header with a Bearer token matching CRON_SECRET
  // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#secure-cron-jobs
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runMaintenanceTasks();
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Cron job failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
