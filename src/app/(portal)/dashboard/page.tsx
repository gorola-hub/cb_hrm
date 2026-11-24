'use client';

import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { LiveClock } from '@/components/attendance/LiveClock';
import { PunchCard } from '@/components/attendance/PunchCard';
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar';

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* PAGE HEADER: Matching CRM's page header typography and border structure */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-6 h-6 text-amber-500 dark:text-[#ffd700]" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
              Employee Portal
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-serif">
            Track shifts, record unlimited breaks, and inspect monthly attendance records.
          </p>
        </div>

        <LiveClock />
      </div>

      {/* Main Punch Card Section */}
      <PunchCard onAttendanceUpdated={() => setRefreshTrigger((prev) => prev + 1)} />

      {/* Monthly Attendance Calendar Section */}
      <AttendanceCalendar refreshTrigger={refreshTrigger} />
    </div>
  );
}
