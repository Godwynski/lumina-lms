import { redirect } from 'next/navigation';

export default function ReturnRedirectPage() {
  redirect('/protected/circulation?mode=return');
}
