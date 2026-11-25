'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, SlidersHorizontal, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LeaveBalance } from './LeaveHistoryList';

interface EmployeeBalanceRow {
  user: {
    id: string;
    name: string;
    email: string;
    empId?: string | null;
    role: { code: string; name: string };
  };
  balances: LeaveBalance[];
}

export function AdminLeaveBalancesManager() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [employees, setEmployees] = useState<EmployeeBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingOver, setRollingOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<{
    userId: string;
    userName: string;
    balance: LeaveBalance;
  } | null>(null);
  const [entitledDays, setEntitledDays] = useState('0');
  const [adjustedDays, setAdjustedDays] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBalances = useCallback(async (targetYear: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/leave-balances?year=${targetYear}`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setEmployees(json.data.employees);
      } else {
        setError(json.error?.message || 'Failed to load employee leave balances.');
      }
    } catch {
      setError('Network error loading employee leave balances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances(year);
  }, [year, fetchBalances]);

  async function handleRollover() {
    setRollingOver(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/leave-balances/carry-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromYear: year, toYear: year + 1 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Carry-forward rollover failed.');
        return;
      }
      setMessage(
        `Carried forward eligible unused balances from ${year} into ${year + 1} for ${json.processedUsers} employee(s).`
      );
      await fetchBalances(year);
    } catch {
      setError('Network error running carry-forward rollover.');
    } finally {
      setRollingOver(false);
    }
  }

  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/leave-balances/adjust', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editTarget.userId,
          leaveTypeId: editTarget.balance.leaveType.id,
          year,
          entitledDays: Number(entitledDays),
          adjustedDays: Number(adjustedDays),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to update employee quota.');
        return;
      }
      setEditTarget(null);
      await fetchBalances(year);
    } catch {
      setError('Network error updating employee quota.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <label htmlFor="balance-year" className="text-xs font-semibold text-muted-foreground font-serif">
            Year
          </label>
          <select
            id="balance-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl bg-secondary border border-border px-3 py-1.5 text-xs font-mono text-foreground"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleRollover}
          disabled={rollingOver}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 font-serif"
        >
          {rollingOver ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>
            Run Carry-Forward Rollover ({year} → {year + 1})
          </span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-[#ffd700]" />
          <span>Loading employee leave balances...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => (
            <div
              key={emp.user.id}
              className="bg-secondary border border-border rounded-xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground font-serif">
                  {emp.user.name}
                </span>
                {emp.user.empId && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-card border border-border text-muted-foreground">
                    {emp.user.empId}
                  </span>
                )}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-[#ffd700] border border-amber-400/30">
                  {emp.user.role.code}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {emp.balances.map((b) => (
                  <div
                    key={b.leaveType.id}
                    className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground font-serif">
                        {b.leaveType.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        Rem: <strong className="text-[#ffd700]">{b.remainingDays}</strong> /{' '}
                        {b.totalEntitlement} (Used {b.usedDays})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTarget({ userId: emp.user.id, userName: emp.user.name, balance: b });
                        setEntitledDays(String(b.entitledDays));
                        setAdjustedDays(String(b.adjustedDays));
                        setNotes(b.notes ?? '');
                      }}
                      className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-[#ffd700] cursor-pointer"
                      aria-label={`Edit ${emp.user.name} ${b.leaveType.code}`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjust Balance Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground font-serif">
              Adjust {editTarget.balance.leaveType.name} — {editTarget.userName} ({year})
            </h3>
            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="adj-entitled"
                  className="block text-xs font-semibold uppercase text-muted-foreground mb-1 font-serif"
                >
                  Base Annual Quota (Entitled Days)
                </label>
                <input
                  id="adj-entitled"
                  type="number"
                  step="0.5"
                  min="0"
                  value={entitledDays}
                  onChange={(e) => setEntitledDays(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
                />
              </div>

              <div>
                <label
                  htmlFor="adj-delta"
                  className="block text-xs font-semibold uppercase text-muted-foreground mb-1 font-serif"
                >
                  Manual Adjustment (+/- Days)
                </label>
                <input
                  id="adj-delta"
                  type="number"
                  step="0.5"
                  value={adjustedDays}
                  onChange={(e) => setAdjustedDays(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
                />
              </div>

              <div>
                <label
                  htmlFor="adj-notes"
                  className="block text-xs font-semibold uppercase text-muted-foreground mb-1 font-serif"
                >
                  Admin Notes
                </label>
                <input
                  id="adj-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prorated mid-year joiner / Comp-off grant"
                  className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  Save Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

