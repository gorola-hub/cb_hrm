'use client';

import React, { useState } from 'react';
import { CalendarDays, Clock, CheckCircle2, XCircle, Ban, Loader2 } from 'lucide-react';

export interface LeaveBalance {
  leaveType: 'CASUAL' | 'SICK' | 'PRIVILEGED';
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveRequestItem {
  id: string;
  leaveType: 'CASUAL' | 'SICK' | 'PRIVILEGED';
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
  balances: Record<'CASUAL' | 'SICK' | 'PRIVILEGED', LeaveBalance> | null;
  loading: boolean;
  onRefresh: () => void;
}

const LEAVE_LABELS: Record<'CASUAL' | 'SICK' | 'PRIVILEGED', string> = {
  CASUAL: 'Casual Leave',
  SICK: 'Sick Leave',
  PRIVILEGED: 'Privileged Leave',
};

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

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      {balances && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['CASUAL', 'SICK', 'PRIVILEGED'] as const).map((type) => {
            const b = balances[type];
            return (
              <div
                key={type}
                className="bg-card border border-border rounded-2xl p-5 shadow-lg card-noise space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-serif">
                    {LEAVE_LABELS[type]}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-400/15 text-[#ffd700] border border-amber-400/30">
                    {b.entitled} / yr
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-foreground">{b.remaining}</span>
                  <span className="text-xs text-muted-foreground font-serif">days remaining</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2.5">
                  <span>Used: <strong className="text-foreground font-mono">{b.used}</strong></span>
                  <span>Pending: <strong className="text-amber-500 dark:text-[#ffd700] font-mono">{b.pending}</strong></span>
                </div>
              </div>
            );
          })}
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
          <div className="space-y-3">
            {requests.map((req) => {
              const badge = getStatusBadge(req.status);
              const StatusIcon = badge.icon;
              return (
                <div
                  key={req.id}
                  className="bg-secondary border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground font-serif">
                        {LEAVE_LABELS[req.leaveType]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.className}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {req.startDate === req.endDate
                          ? req.startDate
                          : `${req.startDate} → ${req.endDate}`}{' '}
                        ({req.totalDays} {req.totalDays === 1 ? 'day' : 'days'})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{req.reason}</p>
                    {req.adminNotes && (
                      <p className="text-xs text-foreground/90 bg-card/60 border border-border rounded-lg px-2.5 py-1.5 mt-1">
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
                      className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 transition cursor-pointer disabled:opacity-50"
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

