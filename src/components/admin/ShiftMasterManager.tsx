'use client';

import React, { useState } from 'react';
import { Clock, Plus, Power, Loader2, AlertCircle } from 'lucide-react';

export interface ShiftMasterItem {
  id: string;
  code: string;
  displayName: string;
  startTime: string;
  durationMins: number;
  graceMinutes: number;
  isActive: boolean;
  _count?: {
    employeeShifts: number;
  };
}

interface ShiftMasterManagerProps {
  shifts: ShiftMasterItem[];
  onRefresh: () => void;
}

export function ShiftMasterManager({ shifts, onRefresh }: ShiftMasterManagerProps) {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [startTime, setStartTime] = useState('19:00');
  const [durationMins, setDurationMins] = useState('510');
  const [graceMinutes, setGraceMinutes] = useState('15');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          displayName,
          startTime,
          durationMins: Number(durationMins),
          graceMinutes: Number(graceMinutes),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Unable to create shift.');
        return;
      }

      setCode('');
      setDisplayName('');
      onRefresh();
    } catch {
      setError('Network error creating shift.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(shift: ShiftMasterItem) {
    setError(null);
    const res = await fetch(`/api/admin/shifts/${shift.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !shift.isActive }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error?.message || 'Failed to update shift status.');
      return;
    }
    onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Create Shift Form */}
      <form
        onSubmit={handleCreate}
        className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Plus className="w-4 h-4 text-[#ffd700]" />
          <h2 className="text-base font-bold text-foreground font-serif">Define New IST Shift</h2>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="shift-code"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Shift Code
            </label>
            <input
              id="shift-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SHIFT_2000"
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="shift-display-name"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Display Name
            </label>
            <input
              id="shift-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="20:00 - 04:30 IST"
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="shift-start-time"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Start Time (IST)
            </label>
            <input
              id="shift-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="shift-duration"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Duration (mins)
            </label>
            <input
              id="shift-duration"
              type="number"
              min="1"
              max="1440"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
            />
          </div>

          <div>
            <label
              htmlFor="shift-grace"
              className="block text-[11px] font-semibold uppercase text-muted-foreground mb-1 font-serif"
            >
              Grace (mins)
            </label>
            <input
              id="shift-grace"
              type="number"
              min="0"
              max="180"
              value={graceMinutes}
              onChange={(e) => setGraceMinutes(e.target.value)}
              required
              className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-[#ffd700] border border-amber-400/60 hover:bg-zinc-800 cursor-pointer disabled:opacity-50 font-serif"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Create Shift</span>
          </button>
        </div>
      </form>

      {/* Catalog Grid */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Clock className="w-4 h-4 text-[#ffd700]" />
          <h3 className="text-base font-bold text-foreground font-serif">Master Shift Catalog</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-secondary border border-border rounded-xl p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground font-serif">
                    {shift.displayName}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      shift.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {shift.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs font-mono text-[#ffd700]">{shift.code}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  Start: {shift.startTime} IST • {(shift.durationMins / 60).toFixed(1)}h • Grace:{' '}
                  {shift.graceMinutes}m
                </div>
                {shift._count !== undefined && (
                  <div className="text-[11px] text-muted-foreground">
                    Active Employees:{' '}
                    <strong className="font-mono text-foreground">
                      {shift._count.employeeShifts}
                    </strong>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleToggleActive(shift)}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-foreground hover:border-[#ffd700]/50 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{shift.isActive ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

