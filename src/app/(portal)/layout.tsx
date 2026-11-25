import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { SessionSyncProvider } from '@/components/providers/SessionSyncProvider';
import { LenisProvider } from '@/components/providers/LenisProvider';
import { getPendingLeaveCount } from '@/service/leave.service';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const pendingLeaveCount =
    session.user.role?.code === 'ADMIN' ? await getPendingLeaveCount() : 0;

  return (
    <LenisProvider>
      <SessionSyncProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
          <Navbar user={session.user} initialPendingLeaveCount={pendingLeaveCount} />
          <main className="flex-1 w-full px-[5%] md:px-[15%] py-6 md:py-8 space-y-8">
            {children}
          </main>
        </div>
      </SessionSyncProvider>
    </LenisProvider>
  );
}
