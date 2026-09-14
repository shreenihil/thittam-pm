import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login');
  }

  if (session.mustResetPassword) {
    redirect('/reset-password');
  }

  redirect('/dashboard');
}
