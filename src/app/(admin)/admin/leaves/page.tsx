import { ShieldAlert } from 'lucide-react';
import { AdminLeaveTable } from '@/components/leaves/AdminLeaveTable';

export default function AdminLeavesPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-500 dark:text-[#ffd700]" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
              Leave Approvals
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-serif">
            Review employee leave requests and automatically synchronize approved dates with attendance.
          </p>
        </div>
      </div>

      <AdminLeaveTable />
    </div>
  );
}

