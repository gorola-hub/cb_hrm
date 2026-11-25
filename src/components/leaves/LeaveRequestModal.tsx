'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, Loader2, X, AlertCircle } from 'lucide-react';

export type LeaveTypeOption = 'CASUAL' | 'SICK' | 'PRIVILEGED';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

function getDefaultISTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function countWeekdays(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  const start = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function LeaveRequestModal({ isOpen, onClose, onSubmitted }: LeaveRequestModalProps) {
  const defaultDate = useMemo(() => getDefaultISTDate(), []);
  const [leaveType, setLeaveType] = useState<LeaveTypeOption>('CASUAL');
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workingDays = useMemo(() => countWeekdays(startDate, endDate), [startDate, endDate]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to submit leave request.');
        return;
      }

      setReason('');
      onSubmitted();
      onClose();
    } catch {
      setError('Network error submitting leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 card-noise text-card-foreground space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[#ffd700]">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground font-serif">Apply for Leave</h3>
              <p className="text-xs text-muted-foreground font-serif">
                Submit a leave request for administrator review (weekends excluded)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="leave-type"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
            >
              Leave Type
            </label>
            <select
              id="leave-type"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveTypeOption)}
              className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#ffd700]/40"
            >
              <option value="CASUAL">Casual Leave (CL)</option>
              <option value="SICK">Sick Leave (SL)</option>
              <option value="PRIVILEGED">Privileged Leave (PL)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="leave-start-date"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                Start Date (IST)
              </label>
              <input
                id="leave-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#ffd700]/40"
              />
            </div>

            <div>
              <label
                htmlFor="leave-end-date"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                End Date (IST)
              </label>
              <input
                id="leave-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#ffd700]/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-xs">
            <span className="text-muted-foreground font-serif">Counted Working Days</span>
            <span className="font-mono font-bold text-[#ffd700]">
              {workingDays} {workingDays === 1 ? 'working day' : 'working days'}
            </span>
          </div>

          <div>
            <label
              htmlFor="leave-reason"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
            >
              Reason
            </label>
            <textarea
              id="leave-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a brief explanation for your leave request..."
              className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#ffd700]/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 shadow-sm transition cursor-pointer disabled:opacity-50 font-serif"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit Leave Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

