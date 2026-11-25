'use client';

import { X, Calendar } from 'lucide-react';
import { MonthDayAttendance } from '@/service/attendance.service';

interface DayDetailModalProps {
  day: MonthDayAttendance | null;
  onClose: () => void;
}

export function DayDetailModal({ day, onClose }: DayDetailModalProps) {
  if (!day) return null;

  function formatISTTime(utcDate?: Date | string | null) {
    if (!utcDate) return '--:--';
    return new Date(utcDate).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusLabel(status: MonthDayAttendance['status']) {
    switch (status) {
      case 'P':
        return { label: 'Present (Full Day)', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'HD':
        return { label: 'Half Day', color: 'bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/30' };
      case 'A':
        return { label: 'Absent', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
      case 'LV':
        return { label: 'Approved Leave', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
      case 'WO':
        return { label: 'Week Off', color: 'bg-muted text-muted-foreground border border-border' };
      case 'IN_PROGRESS':
        return { label: 'In Progress', color: 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30' };
      case 'ANOMALY_STALE':
        return { label: 'Stale Shift (>16h)', color: 'bg-rose-500/20 text-rose-400 border border-rose-500/40' };
      default:
        return { label: 'Unscheduled', color: 'bg-muted text-muted-foreground border border-border' };
    }
  }

  const statusBadge = getStatusLabel(day.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-5 p-6 card-noise text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[#ffd700]">
              <Calendar className="w-5 h-5 text-[#ffd700]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground font-serif">
                Attendance Details
              </h3>
              <p className="text-xs text-muted-foreground font-serif">
                {day.dayOfWeek}, {day.date}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shift & Status Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">Shift Schedule</div>
            <div className="text-sm font-bold text-foreground mt-1 font-serif">
              {day.shift ? day.shift.displayName : 'Standard Schedule'}
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">Recorded Status</div>
            <div className="mt-1">
              <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">First Punch-In (IST)</div>
            <div className="text-base font-bold font-mono text-foreground mt-1">
              {formatISTTime(day.firstPunchIn)}
            </div>
            {day.isLate && (
              <div className="text-xs text-[#ffd700] mt-1 font-serif font-medium">
                Tardy by {day.lateMinutes} mins
              </div>
            )}
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">Last Punch-Out (IST)</div>
            <div className="text-base font-bold font-mono text-foreground mt-1">
              {formatISTTime(day.lastPunchOut)}
            </div>
          </div>
        </div>

        {/* Duration Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-secondary border border-border rounded-xl p-3 text-center">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">Gross Hours</div>
            <div className="text-base font-bold font-mono text-foreground mt-1">
              {(day.grossMinutes / 60).toFixed(1)}h
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3 text-center">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">Total Breaks</div>
            <div className="text-base font-bold font-mono text-foreground mt-1">
              {day.totalBreakMinutes}m
            </div>
          </div>

          <div className="bg-secondary border border-border rounded-xl p-3 text-center">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase font-serif">Net Working</div>
            <div className="text-base font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-1">
              {(day.netWorkMinutes / 60).toFixed(1)}h
            </div>
          </div>
        </div>

        {/* Breaks Timeline */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider font-serif">
            Itemized Break Audit Trail ({day.breaks?.length || 0})
          </div>

          {day.breaks && day.breaks.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {day.breaks.map((brk, index) => (
                <div
                  key={brk.id}
                  className="flex items-center justify-between text-xs bg-secondary border border-border rounded-xl px-3 py-2 font-mono"
                >
                  <span className="text-muted-foreground font-serif">Break #{index + 1}</span>
                  <span className="text-foreground">
                    {formatISTTime(brk.breakStart)} &rarr; {formatISTTime(brk.breakEnd)}
                  </span>
                  <span className="text-[#ffd700] font-bold">
                    {brk.durationMinutes} mins
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-secondary border border-border rounded-xl p-3 text-center font-serif">
              No breaks recorded for this shift.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
