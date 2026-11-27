'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Plane } from 'lucide-react';
import { LeaveRequestModal, LeaveTypeItem } from '@/components/leaves/LeaveRequestModal';
import {
  LeaveBalance,
  LeaveHistoryList,
  LeaveRequestItem,
} from '@/components/leaves/LeaveHistoryList';

export default function LeavesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [hasJoiningDate, setHasJoiningDate] = useState<boolean>(true);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);

  const loadLeaves = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      const [leavesRes, typesRes] = await Promise.all([
        fetch('/api/leaves', { cache: 'no-store' }),
        fetch('/api/leave-types', { cache: 'no-store' }),
      ]);
      const leavesJson = await leavesRes.json();
      const typesJson = await typesRes.json();
      if (leavesRes.ok && leavesJson.success && leavesJson.data) {
        setRequests(leavesJson.data.requests);
        setBalances(leavesJson.data.balances);
        setHasJoiningDate(leavesJson.data.hasJoiningDate ?? true);
      }
      if (typesRes.ok && typesJson.success && Array.isArray(typesJson.leaveTypes)) {
        setLeaveTypes(typesJson.leaveTypes);
      }
    } catch {
      // Handled gracefully
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLeaves(true);

    const silentRefresh = () => {
      if (document.visibilityState === 'visible') {
        loadLeaves(false);
      }
    };

    window.addEventListener('focus', silentRefresh);
    document.addEventListener('visibilitychange', silentRefresh);
    const interval = setInterval(silentRefresh, 10000);

    return () => {
      window.removeEventListener('focus', silentRefresh);
      document.removeEventListener('visibilitychange', silentRefresh);
      clearInterval(interval);
    };
  }, [loadLeaves]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Plane className="w-6 h-6 text-amber-500 dark:text-[#ffd700]" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-serif">
              Leave Management
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-serif">
            Check annual leave balances, apply for time off, and track approval status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 shadow-sm transition active:scale-95 cursor-pointer font-serif"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      <LeaveHistoryList
        requests={requests}
        balances={balances}
        hasJoiningDate={hasJoiningDate}
        loading={loading}
        onRefresh={() => loadLeaves(false)}
      />

      <LeaveRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => loadLeaves(false)}
        leaveTypes={leaveTypes.length > 0 ? leaveTypes : undefined}
      />
    </div>
  );
}
