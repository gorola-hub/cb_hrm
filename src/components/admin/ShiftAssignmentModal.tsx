'use client';

import React, { useMemo, useState } from 'react';
import { CalendarClock, Loader2, X, AlertCircle } from 'lucide-react';
import { ShiftMasterItem } from './ShiftMasterManager';

export interface ShiftEmployeeOption {
  id: string;
  name: string;
  email: string;
  empId?: string | null;
  role: { code: string; name: string };
}

interface ShiftAssignmentModalProps {
  isOpen: boolean;
  employees: ShiftEmployeeOption[];
  shifts: ShiftMasterItem[];
  onClose: () => void;
  onAssigned: () => void;
}

function getDefaultISTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function ShiftAssignmentModal({
  isOpen,
  employees,
  shifts,
  onClose,
  onAssigned,
}: ShiftAssignmentModalProps) {
  const activeShifts = useMemo(() => shifts.filter((s) => s.isActive), [shifts]);
  const [userId, setUserId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(getDefaultISTDate);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [autoClosePrevious, setAutoClosePrevious] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveUserId = userId || employees[0]?.id || '';
  const effectiveShiftId =
    shiftId && activeShifts.some((s) => s.id === shiftId)
      ? shiftId
      : activeShifts[0]?.id || '';

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !effectiveUserId || !effectiveShiftId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          shiftId: effectiveShiftId,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          autoClosePrevious,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to assign shift.');
        return;
      }
      onAssigned();
      onClose();
    } catch {
      setError('Network error while assigning shift.');
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
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground font-serif">Assign Employee Shift</h3>
              <p className="text-xs text-muted-foreground font-serif">
                Schedule a shift with an effective IST date range
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
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
              htmlFor="assign-employee"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
            >
              Employee
            </label>
            <select
              id="assign-employee"
              value={effectiveUserId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="assign-shift"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
            >
              Target Shift
            </label>
            <select
              id="assign-shift"
              value={effectiveShiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-sm text-foreground"
            >
              {activeShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="assign-from"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                Effective From (IST)
              </label>
              <input
                id="assign-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="assign-to"
                className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-serif"
              >
                Effective To (Optional)
              </label>
              <input
                id="assign-to"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoClosePrevious}
              onChange={(e) => setAutoClosePrevious(e.target.checked)}
            />
            <span>Automatically close current open-ended shift assignment</span>
          </label>

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
              disabled={saving || !effectiveUserId || !effectiveShiftId}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 font-serif"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Assign Shift</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

