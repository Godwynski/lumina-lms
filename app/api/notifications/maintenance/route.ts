import { NextResponse } from 'next/server';
import { runMaintenanceTasks } from '@/lib/notifications';
import { withAuthApi } from '@/lib/api-utils';

export const POST = withAuthApi(async () => {
  try {
    const results = await runMaintenanceTasks();
    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error('Maintenance task error:', error);
    return NextResponse.json({ error: 'Failed to run maintenance tasks' }, { status: 500 });
  }
}, { allowedRoles: ['super_admin', 'librarian'] });
