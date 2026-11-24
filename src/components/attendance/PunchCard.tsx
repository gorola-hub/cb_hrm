'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  LogOut,
  Timer,
} from 'lucide-react';

interface Shift {
  id: string;
  code: string;
  displayName: string;
  startTime: string;
  durationMins: number;
  graceMinutes: number;
}

interface BreakRecord {
  id: string;
  breakStart: string;
  breakEnd: string | null;
  durationMinutes: number;
}

interface AttendanceRecord {
  id: string;
  workDate: string;
  firstPunchIn: string;
  lastPunchOut: string | null;
  grossMinutes: number;
  totalBreakMinutes: number;
  netWorkMinutes: number;
  isLate: boolean;
  lateMinutes: number;
  status: 'IN_PROGRESS' | 'P' | 'HD' | 'A' | 'WO' | 'LV';
  shift?: Shift | null;
  breaks?: BreakRecord[];
}

interface PunchCardProps {
  onAttendanceUpdated?: () => void;
}

export function PunchCard({ onAttendanceUpdated }: PunchCardProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'IDLE' | 'WORKING' | 'ON_BREAK' | 'COMPLETED'>('IDLE');
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [activeBreak, setActiveBreak] = useState<BreakRecord | null>(null);
  const [elapsedWork, setElapsedWork] = useState<string>('00:00:00');
  const [elapsedBreak, setElapsedBreak] = useState<string>('00:00:00');

  // Fetch current shift state
  async function fetchCurrentState() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/today');
      const data = await res.json();

      if (data.state === 'ACTIVE' && data.record) {
        setAttendance(data.record);
        // Check if there is an open break
        const openBreak = data.record.breaks?.find((b: BreakRecord) => !b.breakEnd);
        if (openBreak) {
          setActiveBreak(openBreak);
          setState('ON_BREAK');
        } else {
          setActiveBreak(null);
          setState('WORKING');
        }
      } else if (data.state === 'COMPLETED' && data.record) {
        setAttendance(data.record);
        setActiveBreak(null);
        setState('COMPLETED');
      } else {
        setAttendance(null);
        setActiveBreak(null);
        setState('IDLE');
      }
    } catch {
      setError('Unable to load current attendance status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCurrentState();
  }, []);

  // Timer ticker
  useEffect(() => {
    if (state !== 'WORKING' && state !== 'ON_BREAK') return;

    function formatDuration(ms: number) {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    const interval = setInterval(() => {
      if (attendance?.firstPunchIn) {
        const start = new Date(attendance.firstPunchIn).getTime();
        const breakTotalMs = (attendance.totalBreakMinutes || 0) * 60000;
        const now = Date.now();
        setElapsedWork(formatDuration(now - start - breakTotalMs));
      }

      if (state === 'ON_BREAK' && activeBreak?.breakStart) {
        const breakStart = new Date(activeBreak.breakStart).getTime();
        setElapsedBreak(formatDuration(Date.now() - breakStart));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, attendance, activeBreak]);

  // Actions
  async function handlePunchIn() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/punch-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to punch in.');
      } else {
        await fetchCurrentState();
        onAttendanceUpdated?.();
      }
    } catch {
      setError('An unexpected network error occurred.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTakeBreak() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/break/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to start break.');
      } else {
        await fetchCurrentState();
        onAttendanceUpdated?.();
      }
    } catch {
      setError('An unexpected network error occurred.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResumeWork() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/break/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to resume work.');
      } else {
        await fetchCurrentState();
        onAttendanceUpdated?.();
      }
    } catch {
      setError('An unexpected network error occurred.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePunchOut() {
    const confirmPunchOut = window.confirm(
      state === 'ON_BREAK'
        ? 'You are currently on break. Punching out will automatically end your break and close the shift. Proceed?'
        : 'Are you sure you want to punch out and conclude your shift for today?'
    );
    if (!confirmPunchOut) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/punch-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to punch out.');
      } else {
        await fetchCurrentState();
        onAttendanceUpdated?.();
      }
    } catch {
      setError('An unexpected network error occurred.');
    } finally {
      setActionLoading(false);
    }
  }

  function formatISTTime(utcStr?: string | null) {
    if (!utcStr) return '--:--';
    return new Date(utcStr).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-center min-h-[220px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-sm font-medium">Checking shift status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>Shift Punch Card</span>
            {state === 'WORKING' && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                On Shift
              </span>
            )}
            {state === 'ON_BREAK' && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                On Break
              </span>
            )}
            {state === 'COMPLETED' && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Shift Sealed
              </span>
            )}
            {state === 'IDLE' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Not Punched In
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {attendance?.shift ? attendance.shift.displayName : 'Standard Schedule'}
          </p>
        </div>

        {attendance?.workDate && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Work Date: {attendance.workDate}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* State View 1: IDLE */}
      {state === 'IDLE' && (
        <div className="text-center py-6 space-y-4">
          <div className="max-w-md mx-auto text-sm text-slate-400">
            Ready to begin your shift? Punch in to start tracking your working hours.
            Your work date will be locked to today in Indian Standard Time.
          </div>
          <button
            onClick={handlePunchIn}
            disabled={actionLoading}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>Punch In Now</span>
          </button>
        </div>
      )}

      {/* State View 2: WORKING */}
      {state === 'WORKING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Punch-In Time (IST)</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {formatISTTime(attendance?.firstPunchIn)}
              </div>
              {attendance?.isLate && (
                <div className="text-xs text-amber-400 mt-1 font-medium">
                  Late by {attendance.lateMinutes} mins
                </div>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Elapsed Working Time</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                {elapsedWork}
              </div>
              <div className="text-xs text-slate-500 mt-1">Excludes break durations</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Total Breaks Taken</div>
              <div className="text-xl font-bold font-mono text-slate-300 mt-1">
                {attendance?.totalBreakMinutes || 0} mins
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {attendance?.breaks?.length || 0} break session(s)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleTakeBreak}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600/90 hover:bg-amber-500 text-white font-medium rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Coffee className="w-4 h-4" />
              )}
              <span>Take Break</span>
            </button>

            <button
              onClick={handlePunchOut}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Punch Out</span>
            </button>
          </div>
        </div>
      )}

      {/* State View 3: ON_BREAK */}
      {state === 'ON_BREAK' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Break Started (IST)</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {formatISTTime(activeBreak?.breakStart)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Break in progress</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Current Break Duration</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
                {elapsedBreak}
              </div>
              <div className="text-xs text-slate-500 mt-1">Live break counter</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Net Work Recorded So Far</div>
              <div className="text-xl font-bold font-mono text-slate-300 mt-1 tabular-nums">
                {elapsedWork}
              </div>
              <div className="text-xs text-slate-500 mt-1">Timer paused while on break</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleResumeWork}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>Back from Break</span>
            </button>

            <button
              onClick={handlePunchOut}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Punch Out & Auto-Close Break</span>
            </button>
          </div>
        </div>
      )}

      {/* State View 4: COMPLETED */}
      {state === 'COMPLETED' && attendance && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400">First Punch-In</div>
              <div className="text-base font-bold font-mono text-white mt-1">
                {formatISTTime(attendance.firstPunchIn)}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400">Last Punch-Out</div>
              <div className="text-base font-bold font-mono text-white mt-1">
                {formatISTTime(attendance.lastPunchOut)}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400">Gross Elapsed</div>
              <div className="text-base font-bold font-mono text-slate-300 mt-1">
                {(attendance.grossMinutes / 60).toFixed(1)}h ({attendance.grossMinutes}m)
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-400">Total Breaks</div>
              <div className="text-base font-bold font-mono text-slate-300 mt-1">
                {attendance.totalBreakMinutes} mins
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-400">Final Status</div>
              <div className="mt-1">
                {attendance.status === 'P' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Present (Full Day)
                  </span>
                )}
                {attendance.status === 'HD' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Half Day
                  </span>
                )}
                {attendance.status === 'A' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Absent (&lt;5h)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 px-4 py-2.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-emerald-400" />
              <span>
                Net Working Time:{' '}
                <strong className="text-white font-mono">
                  {(attendance.netWorkMinutes / 60).toFixed(1)} hours ({attendance.netWorkMinutes} mins)
                </strong>
              </span>
            </div>
            {attendance.isLate && (
              <span className="text-amber-400 font-medium">
                Marked Late: {attendance.lateMinutes} mins
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
