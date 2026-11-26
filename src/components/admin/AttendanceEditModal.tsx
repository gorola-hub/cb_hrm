'use client';

import React, { useState } from 'react';
import { X, Loader2, AlertCircle, FileEdit } from 'lucide-react';

export interface RosterBreakItem {
  id: string;
  breakStart: string | Date;
  breakEnd: string | Date | null;
  durationMinutes: number;
}

export interface RosterEntryItem {
  user: {
    id: string;
    name: string;
    email: string;
    empId: string | null;
    alias: string | null;
    role: { id: string; code: string; name: string };
    designation: { id: string; code: string; name: string } | null;
  };
  assignedShift: {
    id: string;
    code: string;
    displayName: string;
    startTime: string;
  } | null;
  attendance: {
    id: string;
    workDate: string;
    firstPunchIn: string | Date;
    lastPunchOut: string | Date | null;
    grossMinutes: number;
    totalBreakMinutes: number;
    netWorkMinutes: number;
    isLate: boolean;
    lateMinutes: number;
    status: 'IN_PROGRESS' | 'P' | 'HD' | 'A' | 'WO' | 'LV' | 'ANOMALY_STALE';
    isRegularized: boolean;
  } | null;
  breaks: RosterBreakItem[];
  activeBreak: RosterBreakItem | null;
  auditLogCount: number;
  liveState:
    | 'WORKING'
    | 'ON_BREAK'
    | 'ANOMALY_STALE'
    | 'ON_LEAVE'
    | 'COMPLETED'
    | 'WEEK_OFF'
    | 'OFFLINE';
}

interface AttendanceEditModalProps {
  entry: RosterEntryItem | null;
  workDate: string;
  onClose: () => void;
  onRegularized: () => void;
}

/**
 * Formats a UTC Date/ISO string as YYYY-MM-DDTHH:mm in Asia/Kolkata (IST) for datetime-local input.
 */
function toISTDateTimeLocal(value?: string | Date | null, fallbackWorkDate?: string, fallbackTime = '19:00'): string {
  if (!value) {
    return fallbackWorkDate ? `${fallbackWorkDate}T${fallbackTime}` : '';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

function fromISTDateTimeLocal(localVal: string): string | null {
  if (!localVal) return null;
  return new Date(`${localVal}:00+05:30`).toISOString();
}

export function AttendanceEditModal({
  entry,
  workDate,
  onClose,
  onRegularized,
}: AttendanceEditModalProps) {
  const [firstPunchInLocal, setFirstPunchInLocal] = useState(() =>
    toISTDateTimeLocal(entry?.attendance?.firstPunchIn, workDate, '19:00')
  );
  const [lastPunchOutLocal, setLastPunchOutLocal] = useState(() =>
    entry?.attendance?.lastPunchOut ? toISTDateTimeLocal(entry.attendance.lastPunchOut) : ''
  );
  const [statusOverride, setStatusOverride] = useState<string>('AUTO');
  const [breakMinutesInput, setBreakMinutesInput] = useState<string>(() =>
    String(entry?.attendance?.totalBreakMinutes ?? 0)
  );
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entry) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || saving) return;
    setError(null);
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        attendanceRecordId: entry.attendance?.id,
        userId: entry.user.id,
        workDate,
        firstPunchIn: fromISTDateTimeLocal(firstPunchInLocal),
        lastPunchOut: lastPunchOutLocal ? fromISTDateTimeLocal(lastPunchOutLocal) : null,
        totalBreakMinutesOverride: Number(breakMinutesInput) || 0,
        reason,
      };

      if (statusOverride !== 'AUTO') {
        payload.status = statusOverride;
      }

      const res = await fetch('/api/admin/attendance/regularize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to regularize attendance record.');
        return;
      }

      onRegularized();
      onClose();
    } catch {
      setError('Network error while regularizing attendance record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 card-noise text-card-foreground space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[#ffd700]">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground font-serif">
                Regularize Attendance — {entry.user.name}
              </h3>
              <p className="text-xs text-muted-foreground font-serif">
                Work Date: <span className="font-mono text-foreground">{workDate}</span> (IST)
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reg-punch-in"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                First Punch-In (IST)
              </label>
              <input
                id="reg-punch-in"
                type="datetime-local"
                value={firstPunchInLocal}
                onChange={(e) => setFirstPunchInLocal(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-xs font-mono text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="reg-punch-out"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                Last Punch-Out (IST)
              </label>
              <input
                id="reg-punch-out"
                type="datetime-local"
                value={lastPunchOutLocal}
                onChange={(e) => setLastPunchOutLocal(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-xs font-mono text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reg-break-mins"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                Total Break Minutes
              </label>
              <input
                id="reg-break-mins"
                type="number"
                min="0"
                value={breakMinutesInput}
                onChange={(e) => setBreakMinutesInput(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="reg-status"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                Status Evaluation
              </label>
              <select
                id="reg-status"
                value={statusOverride}
                onChange={(e) => setStatusOverride(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
              >
                <option value="AUTO">Auto-Calculate from Net Hours</option>
                <option value="P">P — Present (Full Day)</option>
                <option value="HD">HD — Half Day</option>
                <option value="A">A — Absent</option>
                <option value="LV">LV — Approved Leave</option>
                <option value="WO">WO — Week Off</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-reason"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
            >
              Regularization Reason (Required)
            </label>
            <textarea
              id="reg-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this attendance record is being edited or regularized..."
              className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#ffd700]/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 font-serif"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Regularization</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

