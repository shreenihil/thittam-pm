import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import { DashboardClientLayout } from './ClientLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login');
  }

  if (session.mustResetPassword) {
    redirect('/reset-password');
  }

  return <DashboardClientLayout user={session}>{children}</DashboardClientLayout>;
}
