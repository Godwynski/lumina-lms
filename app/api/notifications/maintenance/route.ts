import { NextResponse } from 'next/server';
import { runMaintenanceTasks } from '@/lib/notifications';
import { withAuthApi } from '@/lib/api-utils';

export const POST = withAuthApi(async () => {
  try {
    const results = await runMaintenanceTasks();
    return NextResponse.json(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { allowedRoles: ['super_admin', 'librarian'] });
