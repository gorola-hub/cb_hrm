'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface AdminLeaveItem {
  id: string;
  leaveType: {
    id: string;
    code: string;
    name: string;
  };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  adminNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    empId?: string | null;
    alias?: string | null;
    role: { code: string; name: string };
    designation?: { name: string } | null;
  };
  reviewer?: { id: string; name: string; email: string } | null;
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export function AdminLeaveTable() {
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [requests, setRequests] = useState<AdminLeaveItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminLeaveItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLeaves = useCallback(async (status: StatusFilter) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/leaves?status=${status}`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setRequests(json.data.requests);
        setPendingCount(json.data.pendingCount);
      } else {
        setError(json.error?.message || 'Unable to load leave requests.');
      }
    } catch {
      setError('Network error loading leave requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves(filter);
  }, [filter, fetchLeaves]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leaves/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to approve leave request.');
        return;
      }
      window.dispatchEvent(new CustomEvent('hrm:leaves-updated'));
      await fetchLeaves(filter);
    } catch {
      setError('Network error approving leave request.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leaves/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to reject leave request.');
        return;
      }
      setRejectTarget(null);
      setRejectReason('');
      window.dispatchEvent(new CustomEvent('hrm:leaves-updated'));
      await fetchLeaves(filter);
    } catch {
      setError('Network error rejecting leave request.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-5 card-noise">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer font-serif ${
                filter === tab
                  ? 'bg-zinc-900 text-[#ffd700] border border-amber-400/60'
                  : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
              }`}
            >
              {tab}
              {tab === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-serif">
          <ShieldCheck className="w-4 h-4 text-[#ffd700]" />
          <span>Approving automatically marks weekday attendance as LV</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-[#ffd700]" />
          <span>Loading company leave requests...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground font-serif">
          No leave requests match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <div
              key={item.id}
              className="bg-secondary border border-border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-foreground font-serif">
                    {item.user.name}
                  </span>
                  {item.user.empId && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">
                      {item.user.empId}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-[#ffd700] border border-amber-400/30">
                    {item.user.role.code}
                  </span>
                  <span className="text-xs font-bold text-foreground/90">
                    {item.leaveType.name} ({item.leaveType.code})
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.startDate === item.endDate
                      ? item.startDate
                      : `${item.startDate} → ${item.endDate}`}{' '}
                    ({item.totalDays}d)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
                {item.adminNotes && (
                  <p className="text-xs text-foreground/80">
                    <span className="font-semibold text-[#ffd700]">Admin Note:</span>{' '}
                    {item.adminNotes}
                  </p>
                )}
              </div>

              {item.status === 'PENDING' ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApprove(item.id)}
                    disabled={processingId === item.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectTarget(item);
                      setRejectReason('');
                    }}
                    disabled={processingId === item.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 transition cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-card border border-border text-muted-foreground self-start lg:self-center">
                  {item.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rejection Explanation Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground font-serif">
              Reject Leave Request — {rejectTarget.user.name}
            </h3>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reject-reason"
                  className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5 font-serif"
                >
                  Rejection Reason
                </label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this leave request cannot be approved..."
                  className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectTarget.id}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
