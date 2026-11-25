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
  status: 'IN_PROGRESS' | 'P' | 'HD' | 'A' | 'WO' | 'LV' | 'ANOMALY_STALE';
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

  function formatMsToHMS(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function formatISTTime(dateStr?: string | null): string {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  useEffect(() => {
    fetchCurrentState();
  }, []);

  // Timer ticker
  useEffect(() => {
    if (state === 'IDLE' || state === 'COMPLETED' || !attendance?.firstPunchIn) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const punchInMs = new Date(attendance.firstPunchIn).getTime();

      // Calculate total break duration so far (completed breaks + active break if any)
      let breakDurationMs = 0;
      if (attendance.breaks && attendance.breaks.length > 0) {
        for (const b of attendance.breaks) {
          const bStart = new Date(b.breakStart).getTime();
          const bEnd = b.breakEnd ? new Date(b.breakEnd).getTime() : now;
          breakDurationMs += Math.max(0, bEnd - bStart);
        }
      }

      // Net working time = (now - punchIn) - breakDuration
      const totalElapsedMs = Math.max(0, now - punchInMs);
      const netWorkingMs = Math.max(0, totalElapsedMs - breakDurationMs);

      setElapsedWork(formatMsToHMS(netWorkingMs));

      if (state === 'ON_BREAK' && activeBreak?.breakStart) {
        const activeBreakStartMs = new Date(activeBreak.breakStart).getTime();
        const currentBreakMs = Math.max(0, now - activeBreakStartMs);
        setElapsedBreak(formatMsToHMS(currentBreakMs));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, attendance, activeBreak]);

  // Action Handlers
  async function handlePunchIn() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/punch-in', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setAttendance(data.data);
        setState('WORKING');
        onAttendanceUpdated?.();
      } else {
        setError(data.error?.message || 'Failed to punch in');
      }
    } catch {
      setError('Network error while punching in');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTakeBreak() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/break/start', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setActiveBreak(data.data);
        setState('ON_BREAK');
        fetchCurrentState();
        onAttendanceUpdated?.();
      } else {
        setError(data.error?.message || 'Failed to start break');
      }
    } catch {
      setError('Network error while starting break');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResumeWork() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/break/end', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setActiveBreak(null);
        setState('WORKING');
        fetchCurrentState();
        onAttendanceUpdated?.();
      } else {
        setError(data.error?.message || 'Failed to end break');
      }
    } catch {
      setError('Network error while resuming work');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePunchOut() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch('/api/attendance/punch-out', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setAttendance(data.data);
        setActiveBreak(null);
        setState('COMPLETED');
        onAttendanceUpdated?.();
      } else {
        setError(data.error?.message || 'Failed to punch out');
      }
    } catch {
      setError('Network error while punching out');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl card-noise text-card-foreground">
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-3 font-serif">
          <Loader2 className="w-5 h-5 animate-spin text-[#ffd700]" />
          <span>Synchronizing shift records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6 card-noise text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5 font-serif">
            <span>Shift Punch Card</span>
            {state === 'WORKING' && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                On Shift
              </span>
            )}
            {state === 'ON_BREAK' && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ffd700]/15 text-[#ffd700] border border-[#ffd700]/30">
                <span className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse"></span>
                On Break
              </span>
            )}
            {state === 'COMPLETED' && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Shift Sealed
              </span>
            )}
            {state === 'IDLE' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                Not Punched In
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-serif">
            {attendance?.shift ? attendance.shift.displayName : 'Standard IST Night Schedule'}
          </p>
        </div>

        {attendance?.workDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-secondary px-3 py-1.5 rounded-xl border border-border font-mono">
            <Calendar className="w-3.5 h-3.5 text-[#ffd700]" />
            <span>Work Date: {attendance.workDate}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-sm text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* State View 1: IDLE */}
      {state === 'IDLE' && (
        <div className="text-center py-6 space-y-4">
          <div className="max-w-md mx-auto text-sm text-muted-foreground font-serif">
            Ready to begin your shift? Punch in to start tracking your working hours.
            Your work date will be locked to today in Indian Standard Time.
          </div>
          <button
            onClick={handlePunchIn}
            disabled={actionLoading}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50 font-serif"
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
            <div className="bg-secondary border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-serif">Punch-In Time (IST)</div>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {formatISTTime(attendance?.firstPunchIn)}
              </div>
              {attendance?.isLate && (
                <div className="text-xs text-[#ffd700] mt-1 font-serif font-medium">
                  Late by {attendance.lateMinutes} mins
                </div>
              )}
            </div>

            <div className="bg-secondary border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-serif">Elapsed Working Time</div>
              <div className="text-xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-1 tabular-nums">
                {elapsedWork}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-serif">Excludes break durations</div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-serif">Total Breaks Taken</div>
              <div className="text-xl font-bold font-mono text-foreground mt-1">
                {attendance?.totalBreakMinutes || 0} mins
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-serif">
                {attendance?.breaks?.length || 0} break session(s)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleTakeBreak}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ffd700] hover:bg-[#ffe033] text-black font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 font-serif"
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 font-serif"
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
            <div className="bg-secondary border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-serif">Break Started (IST)</div>
              <div className="text-xl font-bold font-mono text-[#ffd700] mt-1">
                {formatISTTime(activeBreak?.breakStart)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-serif">Break in progress</div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-serif">Current Break Duration</div>
              <div className="text-xl font-bold font-mono text-[#ffd700] mt-1 tabular-nums">
                {elapsedBreak}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-serif">Live break counter</div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground font-serif">Net Work Recorded So Far</div>
              <div className="text-xl font-bold font-mono text-foreground mt-1 tabular-nums">
                {elapsedWork}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-serif">Timer paused while on break</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleResumeWork}
              disabled={actionLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 font-serif"
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 font-serif"
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
            <div className="bg-secondary border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground font-serif">First Punch-In</div>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                {formatISTTime(attendance.firstPunchIn)}
              </div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground font-serif">Last Punch-Out</div>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                {formatISTTime(attendance.lastPunchOut)}
              </div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground font-serif">Gross Elapsed</div>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                {(attendance.grossMinutes / 60).toFixed(1)}h ({attendance.grossMinutes}m)
              </div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground font-serif">Total Breaks</div>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                {attendance.totalBreakMinutes} mins
              </div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-3 col-span-2 sm:col-span-1">
              <div className="text-xs text-muted-foreground font-serif">Final Status</div>
              <div className="mt-1">
                {attendance.status === 'P' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                    Present (Full Day)
                  </span>
                )}
                {attendance.status === 'HD' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/30">
                    Half Day
                  </span>
                )}
                {attendance.status === 'A' && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30">
                    Absent (&lt;5h)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary px-4 py-2.5 rounded-xl border border-border font-serif">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>
                Net Working Time:{' '}
                <strong className="text-foreground font-mono">
                  {(attendance.netWorkMinutes / 60).toFixed(1)} hours ({attendance.netWorkMinutes} mins)
                </strong>
              </span>
            </div>
            {attendance.isLate && (
              <span className="text-[#ffd700] font-medium">
                Marked Late: {attendance.lateMinutes} mins
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
