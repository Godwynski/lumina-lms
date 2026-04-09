import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth-helpers';

export default async function ReturnRedirectPage() {
  const role = await getUserRole();
  if (!role || role === 'student') {
    redirect('/dashboard');
  }

  redirect('/circulation?mode=return');
}

