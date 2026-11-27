'use client';

import React, { useState } from 'react';
import { CalendarDays, Clock, CheckCircle2, XCircle, Ban, Loader2, AlertCircle } from 'lucide-react';
import { LeaveTypeItem } from './LeaveRequestModal';

export interface LeaveBalance {
  leaveType: LeaveTypeItem;
  year: number;
  entitledDays: number;
  carriedForwardDays: number;
  adjustedDays: number;
  totalEntitlement: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays: number;
  notes?: string | null;
}

export interface LeaveRequestItem {
  id: string;
  leaveType: {
    id: string;
    code: string;
    name: string;
    isPaid?: boolean;
  };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  adminNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface LeaveHistoryListProps {
  requests: LeaveRequestItem[];
  balances: LeaveBalance[];
  hasJoiningDate?: boolean;
  loading: boolean;
  onRefresh: () => void;
}

function getStatusBadge(status: LeaveRequestItem['status']) {
  switch (status) {
    case 'APPROVED':
      return {
        label: 'Approved',
        icon: CheckCircle2,
        className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        icon: XCircle,
        className: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        icon: Ban,
        className: 'bg-muted text-muted-foreground border-border',
      };
    default:
      return {
        label: 'Pending',
        icon: Clock,
        className: 'bg-amber-400/20 text-amber-500 dark:text-[#ffd700] border-amber-400/30',
      };
  }
}

export function LeaveHistoryList({
  requests,
  balances,
  hasJoiningDate = true,
  loading,
  onRefresh,
}: LeaveHistoryListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCancel(id: string) {
    setCancellingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/leaves/${id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionError(json.error?.message || 'Unable to cancel leave request.');
        return;
      }
      onRefresh();
    } catch {
      setActionError('Network error while cancelling leave request.');
    } finally {
      setCancellingId(null);
    }
  }

  const visibleBalances = balances.filter((b) => b.leaveType.isActive !== false);

  return (
    <div className="space-y-6">
      {!loading && !hasJoiningDate && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs text-amber-300 font-serif">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#ffd700] mt-0.5" />
          <span>
            Your joining date is not set yet, so Paid Leave accrual is currently{' '}
            <strong className="font-mono text-[#ffd700]">0</strong> days. Please contact an
            administrator to add your joining date in CRM.
          </span>
        </div>
      )}

      {/* Dynamic Balance Cards */}
      {visibleBalances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleBalances.map((b) => (
            <div
              key={b.leaveType.id}
              className="bg-card border border-border rounded-xl p-4 shadow-sm card-noise flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-serif">
                  {b.leaveType.name}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-400/15 text-[#ffd700] border border-amber-400/30 shrink-0">
                  {b.leaveType.isPaid ? `${b.entitledDays} accrued` : 'Unpaid'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {b.leaveType.isPaid ? b.remainingDays : b.usedDays}
                </span>
                <span className="text-xs text-muted-foreground font-serif">
                  {b.leaveType.isPaid ? 'days remaining' : 'days taken'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground border-t border-border pt-2">
                <span>
                  Used: <strong className="text-foreground font-mono">{b.usedDays}</strong>
                </span>
                <span>
                  Pending:{' '}
                  <strong className="text-amber-500 dark:text-[#ffd700] font-mono">
                    {b.pendingDays}
                  </strong>
                </span>
                {b.carriedForwardDays > 0 && (
                  <span>
                    Carry-Fwd:{' '}
                    <strong className="text-emerald-400 font-mono">+{b.carriedForwardDays}</strong>
                  </span>
                )}
                {b.adjustedDays !== 0 && (
                  <span>
                    Adjusted:{' '}
                    <strong className="text-indigo-400 font-mono">
                      {b.adjustedDays > 0 ? `+${b.adjustedDays}` : b.adjustedDays}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requests List */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4 card-noise">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-5 h-5 text-[#ffd700]" />
            <h2 className="text-lg font-bold text-foreground font-serif">My Leave Applications</h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {requests.length} {requests.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {actionError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#ffd700]" />
            <span>Loading leave applications...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground font-serif">
            No leave applications submitted yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {requests.map((req) => {
              const badge = getStatusBadge(req.status);
              const StatusIcon = badge.icon;
              return (
                <div
                  key={req.id}
                  className="bg-secondary border border-border rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground font-serif">
                        {req.leaveType.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${badge.className}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[#ffd700]">
                      {req.startDate === req.endDate
                        ? req.startDate
                        : `${req.startDate} → ${req.endDate}`}{' '}
                      ({req.totalDays} {req.totalDays === 1 ? 'day' : 'days'})
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                    {req.adminNotes && (
                      <p className="text-[11px] text-foreground/90 bg-card/60 border border-border rounded-lg px-2.5 py-1.5 mt-1">
                        <span className="font-semibold text-[#ffd700]">Reviewer Note:</span>{' '}
                        {req.adminNotes}
                        {req.reviewer ? ` — ${req.reviewer.name}` : ''}
                      </p>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(req.id)}
                      disabled={cancellingId === req.id}
                      className="self-start px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 transition cursor-pointer disabled:opacity-50"
                    >
                      {cancellingId === req.id ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
