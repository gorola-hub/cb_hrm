'use client';

import { useState } from 'react';
import { LiveClock } from '@/components/attendance/LiveClock';
import { PunchCard } from '@/components/attendance/PunchCard';
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar';

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Greeting & Live Clock Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Employee Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track shifts, record breaks, and view your monthly attendance records.
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

