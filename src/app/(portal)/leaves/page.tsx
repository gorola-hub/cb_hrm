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
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);

  const loadLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesRes, typesRes] = await Promise.all([
        fetch('/api/leaves'),
        fetch('/api/leave-types'),
      ]);
      const leavesJson = await leavesRes.json();
      const typesJson = await typesRes.json();
      if (leavesRes.ok && leavesJson.success && leavesJson.data) {
        setRequests(leavesJson.data.requests);
        setBalances(leavesJson.data.balances);
      }
      if (typesRes.ok && typesJson.success && Array.isArray(typesJson.leaveTypes)) {
        setLeaveTypes(typesJson.leaveTypes);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaves();
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
        loading={loading}
        onRefresh={loadLeaves}
      />

      <LeaveRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={loadLeaves}
        leaveTypes={leaveTypes.length > 0 ? leaveTypes : undefined}
      />
    </div>
  );
}
