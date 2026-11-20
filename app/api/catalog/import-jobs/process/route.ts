import { NextResponse } from 'next/server';
import { getMe } from '@/lib/auth-helpers';
import { safeCompare } from '@/lib/server-utils';
import { catalogWorkerToken, scheduleCatalogImport } from '@/lib/catalog-import-scheduler';

export const maxDuration = 60;
export async function POST(request: Request) {
  const internal = safeCompare(request.headers.get('authorization') || '', `Bearer ${catalogWorkerToken()}`);
  if (!internal) {
    const me = await getMe();
    if (!me || !['super_admin', 'librarian'].includes(me.role) || me.profile.status !== 'ACTIVE') return NextResponse.json({ error: 'Staff access required.' }, { status: 403 });
  }
  scheduleCatalogImport(internal);
  return NextResponse.json({ accepted: true }, { status: 202 });
}
