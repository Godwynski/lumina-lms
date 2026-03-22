import { redirect } from 'next/navigation';

export default function BorrowRedirectPage() {
  redirect('/protected/circulation?mode=checkout');
}
